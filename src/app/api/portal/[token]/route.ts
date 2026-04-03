import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { LABEL_TAHAP, TAHAP_URUTAN } from "@/lib/stages";
import { enforceRateLimit } from "@/lib/rate-limit";
import { guessLegacyKelompokNameFromId } from "@/lib/kelompok-compat";
import {
  getMissingColumnName,
  getReadableErrorMessage,
  isMissingColumnError,
  resolveExistingColumn,
  resolveTableName,
} from "@/lib/supabase-compat";

type GenericRow = Record<string, unknown>;

const TOKEN_REGEX = /^[A-Za-z0-9_-]{6,120}$/;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

function pickFirstString(row: GenericRow | null, keys: string[]) {
  if (!row) return null;

  for (const key of keys) {
    const value = row[key];
    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

async function queryRowsByHewanRef(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  tableName: string,
  selectClause: string,
  hewanId: string,
  hewanCode: string | null = null
) {
  const probes: Array<{ column: string; value: string }> = [
    { column: "hewan_id", value: hewanId },
    { column: "hewan_qurban_id", value: hewanId },
    { column: "id_hewan", value: hewanId },
  ];

  if (hewanCode) {
    probes.push(
      { column: "kode_hewan", value: hewanCode },
      { column: "kode", value: hewanCode },
      { column: "qr_code", value: hewanCode }
    );
  }

  const initialColumns = selectClause
    .split(",")
    .map((column) => column.trim())
    .filter((column) => column.length > 0);

  let hadSuccessfulQuery = false;

  for (const { column, value } of probes) {
    let selectColumns = [...initialColumns];

    while (selectColumns.length > 0) {
      const { data, error } = await supabase
        .from(tableName)
        .select(selectColumns.join(","))
        .eq(column, value);

      if (!error) {
        hadSuccessfulQuery = true;
        const rows = (data ?? []) as unknown as GenericRow[];
        if (rows.length > 0) return rows;
        break;
      }

      if (!isMissingColumnError(error)) throw error;

      const missingColumn = getMissingColumnName(error);
      if (!missingColumn) break;

      const nextColumns = selectColumns.filter((item) => item !== missingColumn);
      if (nextColumns.length === selectColumns.length) break;
      selectColumns = nextColumns;
    }
  }

  if (hadSuccessfulQuery) return [] as GenericRow[];
  return [] as GenericRow[];
}

async function resolveShohibulByToken(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  token: string
) {
  const shohibulTable = await resolveTableName(supabase, "shohibul");
  if (!shohibulTable) return null;

  const tokenColumn = await resolveExistingColumn(supabase, shohibulTable, [
    "unique_token",
    "link_unik",
    "token",
  ]);
  if (!tokenColumn) return null;

  const { data, error } = await supabase
    .from(shohibulTable)
    .select("*")
    .eq(tokenColumn, token)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    tokenColumn,
    row: data as GenericRow,
  };
}

async function loadSignedUrlMap(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  bucket: string,
  paths: string[]
) {
  if (!paths.length) return new Map<string, string>();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return new Map<string, string>();

  const result = new Map<string, string>();
  for (const item of data) {
    if (item?.path && item?.signedUrl) {
      result.set(item.path, item.signedUrl);
    }
  }
  return result;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = enforceRateLimit(req, {
    key: "portal-view",
    maxRequests: 120,
    windowMs: 60_000,
    message: "Terlalu banyak request portal. Coba lagi dalam 1 menit.",
  });
  if (limited) return limited;

  try {
    const { token } = await params;
    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: "Format link portal tidak valid." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "qurban_media";

    const [shohibulResolved, kelompokTable, hewanTable, statusTable, dokumentasiTable] = await Promise.all([
      resolveShohibulByToken(supabase, token),
      resolveTableName(supabase, "kelompok"),
      resolveTableName(supabase, "hewan"),
      resolveTableName(supabase, "status_tracking"),
      resolveTableName(supabase, "dokumentasi"),
    ]);

    if (!shohibulResolved) {
      return NextResponse.json({ error: "Link shohibul tidak valid." }, { status: 404 });
    }

    const shohibul = shohibulResolved.row;
    const kelompokId = typeof shohibul.kelompok_id === "string" ? shohibul.kelompok_id : null;

    let kelompok: GenericRow | null = null;
    if (kelompokTable && kelompokId) {
      const { data: kelompokData, error: kelompokError } = await supabase
        .from(kelompokTable)
        .select("*")
        .eq("id", kelompokId)
        .maybeSingle();

      if (kelompokError && !isMissingColumnError(kelompokError)) throw kelompokError;
      kelompok = (kelompokData as GenericRow | null) ?? null;
    }

    let hewan: GenericRow | null = null;
    if (hewanTable) {
      const hewanIdFromKelompok =
        kelompok && typeof kelompok.hewan_id === "string"
          ? kelompok.hewan_id
          : null;

      const hewanIdFromShohibul =
        typeof shohibul.hewan_id === "string"
          ? shohibul.hewan_id
          : typeof shohibul.hewan_qurban_id === "string"
            ? shohibul.hewan_qurban_id
            : null;

      if (hewanIdFromKelompok || hewanIdFromShohibul) {
        const hewanId = hewanIdFromKelompok || hewanIdFromShohibul;
        const { data: hewanById, error: hewanByIdError } = await supabase
          .from(hewanTable)
          .select("*")
          .eq("id", hewanId)
          .maybeSingle();

        if (hewanByIdError) throw hewanByIdError;
        hewan = (hewanById as GenericRow | null) ?? null;
      }

      if (!hewan && kelompokId) {
        const { data: hewanByKelompok, error: hewanByKelompokError } = await supabase
          .from(hewanTable)
          .select("*")
          .eq("kelompok_id", kelompokId)
          .maybeSingle();

        if (hewanByKelompokError && !isMissingColumnError(hewanByKelompokError)) {
          throw hewanByKelompokError;
        }

        hewan = (hewanByKelompok as GenericRow | null) ?? null;
      }
    }

    if (kelompokTable && !kelompok && hewan?.id) {
      for (const relationColumn of ["hewan_id", "hewan_qurban_id"]) {
        const { data: kelompokByHewan, error: kelompokByHewanError } = await supabase
          .from(kelompokTable)
          .select("*")
          .eq(relationColumn, String(hewan.id))
          .maybeSingle();

        if (!kelompokByHewanError) {
          kelompok = (kelompokByHewan as GenericRow | null) ?? null;
          if (kelompok?.id) break;
          continue;
        }

        if (isMissingColumnError(kelompokByHewanError)) continue;
        throw kelompokByHewanError;
      }
    }

    if (!hewan) {
      const fallbackKelompokNama =
        pickFirstString(kelompok, ["nama"]) ??
        pickFirstString(shohibul, ["kelompok_nama", "kelompok", "nama_kelompok", "group_name", "group"]) ??
        guessLegacyKelompokNameFromId(kelompokId);

      return NextResponse.json({
        data: {
          shohibul: {
            id: shohibul.id,
            nama: shohibul.nama ?? "",
            no_whatsapp: shohibul.no_whatsapp ?? shohibul.whatsapp ?? "",
            jenis_qurban: shohibul.jenis_qurban ?? shohibul.jenis ?? null,
            tipe: shohibul.tipe ?? shohibul.porsi ?? "1/7",
            kelompok_id: shohibul.kelompok_id ?? null,
            unique_token:
              shohibul[shohibulResolved.tokenColumn] ??
              shohibul.unique_token ??
              shohibul.link_unik ??
              shohibul.token ??
              token,
          },
          kelompok: kelompok
            ? {
                id: kelompok.id,
                nama: fallbackKelompokNama ?? "Kelompok",
                hewan_id: kelompok.hewan_id ?? null,
              }
            : fallbackKelompokNama || kelompokId
              ? {
                  id: kelompokId ?? `manual-${shohibul.id}`,
                  nama: fallbackKelompokNama ?? "Belum ada kelompok",
                  hewan_id: null,
                }
              : null,
          hewan: null,
          status_tracking: [],
          dokumentasi: [],
          timeline: [],
        },
      });
    }

    const hewanId = String(hewan.id);
    const hewanCode = pickFirstString(hewan, ["kode", "kode_hewan", "qr_code", "code"]);

    const [statusRows, dokumentasiRows] = await Promise.all([
      statusTable
        ? queryRowsByHewanRef(
            supabase,
            statusTable,
            "id,tahap,waktu,catatan,created_at",
            hewanId,
            hewanCode
          )
        : Promise.resolve([] as GenericRow[]),
      dokumentasiTable
        ? queryRowsByHewanRef(
            supabase,
            dokumentasiTable,
            "id,tahap,tipe_tahapan,tipe_media,media_type,jenis_media,media_url,url,url_media,thumbnail_url,captured_at,waktu_capture,uploaded_at,waktu_upload,created_at",
            hewanId,
            hewanCode
          )
        : Promise.resolve([] as GenericRow[]),
    ]);

    const statusTracking = statusRows
      .map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `status-${index}`,
        tahap: typeof item.tahap === "string" ? item.tahap : "",
        waktu:
          typeof item.waktu === "string"
            ? item.waktu
            : typeof item.created_at === "string"
              ? item.created_at
              : null,
        catatan: typeof item.catatan === "string" ? item.catatan : null,
      }))
      .filter((item) => item.tahap)
      .sort((a, b) => {
        const aTs = Date.parse(a.waktu ?? "") || 0;
        const bTs = Date.parse(b.waktu ?? "") || 0;
        return aTs - bTs;
      });

    const rawPaths = new Set<string>();
    for (const item of dokumentasiRows) {
      const mediaPath =
        typeof item.media_url === "string"
          ? item.media_url
          : typeof item.url === "string"
            ? item.url
            : typeof item.url_media === "string"
              ? item.url_media
              : "";
      const thumbnailPath = typeof item.thumbnail_url === "string" ? item.thumbnail_url : "";

      if (mediaPath) rawPaths.add(mediaPath);
      if (thumbnailPath) rawPaths.add(thumbnailPath);
    }

    const signedUrlMap = await loadSignedUrlMap(supabase, bucket, Array.from(rawPaths));

    const dokumentasi = dokumentasiRows
      .map((item, index) => {
        const mediaPath =
          typeof item.media_url === "string"
            ? item.media_url
            : typeof item.url === "string"
              ? item.url
              : typeof item.url_media === "string"
                ? item.url_media
                : "";
        const thumbnailPath = typeof item.thumbnail_url === "string" ? item.thumbnail_url : "";

        if (!mediaPath) return null;

        return {
          id: typeof item.id === "string" ? item.id : `media-${index}`,
          tahap:
            typeof item.tahap === "string"
              ? item.tahap
              : typeof item.tipe_tahapan === "string"
                ? item.tipe_tahapan
                : "",
          tipe_media:
            (typeof item.tipe_media === "string"
              ? item.tipe_media
              : typeof item.media_type === "string"
                ? item.media_type
                : typeof item.jenis_media === "string"
                  ? item.jenis_media
                  : "foto") as "foto" | "video",
          media_url: mediaPath,
          thumbnail_url: thumbnailPath || null,
          captured_at:
            typeof item.captured_at === "string"
              ? item.captured_at
              : typeof item.waktu_capture === "string"
                ? item.waktu_capture
                : null,
          uploaded_at:
            typeof item.uploaded_at === "string"
              ? item.uploaded_at
              : typeof item.waktu_upload === "string"
                ? item.waktu_upload
                : typeof item.created_at === "string"
                  ? item.created_at
                  : null,
          media_public_url:
            signedUrlMap.get(mediaPath) ??
            supabase.storage.from(bucket).getPublicUrl(mediaPath).data.publicUrl,
          thumbnail_public_url: thumbnailPath
            ? (signedUrlMap.get(thumbnailPath) ??
              supabase.storage.from(bucket).getPublicUrl(thumbnailPath).data.publicUrl)
            : null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        const aTs = Date.parse(a.uploaded_at ?? "") || 0;
        const bTs = Date.parse(b.uploaded_at ?? "") || 0;
        return aTs - bTs;
      });

    const statusByTahap = new Map(statusTracking.map((item) => [item.tahap, item]));
    const mediaCountByTahap = new Map<string, number>();

    for (const media of dokumentasi) {
      mediaCountByTahap.set(media.tahap, (mediaCountByTahap.get(media.tahap) ?? 0) + 1);
    }

    const timeline = TAHAP_URUTAN.map((tahap) => {
      const status = statusByTahap.get(tahap);
      return {
        tahap,
        label: LABEL_TAHAP[tahap],
        status: status ? "done" : "pending",
        waktu: status?.waktu ?? null,
        media: mediaCountByTahap.get(tahap) ?? 0,
      };
    });

    const fallbackKelompokNama =
      pickFirstString(kelompok, ["nama"]) ??
      pickFirstString(shohibul, ["kelompok_nama", "kelompok", "nama_kelompok", "group_name", "group"]) ??
      pickFirstString(hewan, ["kelompok_nama", "kelompok", "nama_kelompok", "group_name", "group"]) ??
      guessLegacyKelompokNameFromId(kelompokId);

    const normalizedKelompok = kelompok
      ? {
          id: kelompok.id,
          nama: fallbackKelompokNama ?? "Kelompok",
          hewan_id: kelompok.hewan_id ?? hewan.id,
        }
      : kelompokId || fallbackKelompokNama
        ? {
            id: kelompokId ?? `manual-${hewan.id}`,
            nama: fallbackKelompokNama ?? "Belum ada kelompok",
            hewan_id: hewan.id,
          }
        : null;

    const normalizedShohibul = {
      id: shohibul.id,
      nama: shohibul.nama ?? "",
      no_whatsapp: shohibul.no_whatsapp ?? shohibul.whatsapp ?? "",
      jenis_qurban: shohibul.jenis_qurban ?? shohibul.jenis ?? null,
      tipe: shohibul.tipe ?? shohibul.porsi ?? "1/7",
      kelompok_id: shohibul.kelompok_id ?? null,
      unique_token:
        shohibul[shohibulResolved.tokenColumn] ??
        shohibul.unique_token ??
        shohibul.link_unik ??
        shohibul.token ??
        token,
    };

    const normalizedHewan = {
      id: hewan.id,
      kode:
        hewan.kode ??
        hewan.kode_hewan ??
        hewan.code ??
        hewan.qr_code ??
        hewan.id,
      jenis: hewan.jenis ?? hewan.jenis_qurban ?? "sapi",
      warna: hewan.warna ?? hewan.warna_bulu ?? null,
      berat_est: hewan.berat_est ?? hewan.berat ?? hewan.berat_estimasi ?? null,
      status: hewan.status ?? "registered",
    };

    return NextResponse.json({
      data: {
        shohibul: normalizedShohibul,
        kelompok: normalizedKelompok,
        hewan: normalizedHewan,
        status_tracking: statusTracking,
        dokumentasi,
        timeline,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Gagal memuat portal shohibul.") },
      { status: 500 }
    );
  }
}
