import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { TAHAP_URUTAN, LABEL_TAHAP } from "@/lib/stages";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readPetugasSession, unauthorizedPetugasResponse } from "@/lib/petugas-auth";
import { guessLegacyKelompokNameFromId } from "@/lib/kelompok-compat";
import {
  getMissingColumnName,
  getReadableErrorMessage,
  isMissingColumnError,
  resolveExistingColumn,
  resolveTableName,
} from "@/lib/supabase-compat";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv"]);

function normalizeTahapKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function normalizeTahap(tahap: string): string {
  if (!tahap) return tahap;
  const normalized = normalizeTahapKey(tahap);
  const found = (TAHAP_URUTAN as readonly string[]).find((t) => normalizeTahapKey(t) === normalized);
  if (found) return found;

  for (const tahapKey of TAHAP_URUTAN as readonly string[]) {
    const label = LABEL_TAHAP[tahapKey as keyof typeof LABEL_TAHAP];
    if (label && normalizeTahapKey(label) === normalized) return tahapKey;
  }

  return normalized || tahap;
}

type GenericRow = Record<string, unknown>;

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

async function queryRowsByHewanId(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  tableName: string,
  selectClause: string,
  hewanId: string,
  hewanCode: string | null = null,
  extraIds: string[] = []
) {
  const probes: Array<{ column: string; value: string }> = [];
  const relationValues = Array.from(new Set([hewanId, ...extraIds].filter(Boolean)));

  for (const value of relationValues) {
    probes.push(
      { column: "hewan_id", value },
      { column: "hewan_qurban_id", value },
      { column: "id_hewan", value },
      { column: "kelompok_id", value },
      { column: "kelompok_qurban_id", value }
    );
  }

  if (hewanCode) {
    probes.push(
      { column: "kode_hewan", value: hewanCode },
      { column: "kode", value: hewanCode },
      { column: "qr_code", value: hewanCode },
      { column: "hewan_kode", value: hewanCode }
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
      if (!missingColumn) {
        break;
      }

      const nextColumns = selectColumns.filter((item) => item !== missingColumn);
      if (nextColumns.length === selectColumns.length) {
        break;
      }
      selectColumns = nextColumns;
    }
  }

  if (hadSuccessfulQuery) return [] as GenericRow[];
  return [] as GenericRow[];
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

function getExt(path: string) {
  const clean = path.split("?")[0] ?? path;
  const index = clean.lastIndexOf(".");
  if (index < 0) return "";
  return clean.slice(index + 1).toLowerCase();
}

function inferMediaType(path: string): "foto" | "video" {
  const ext = getExt(path);
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "foto";
}

function inferTahapFromPath(path: string) {
  const fileName = path.split("/").pop() ?? "";
  const raw = fileName.split("-")[0] ?? "";
  return normalizeTahap(raw);
}

async function loadStorageFallbackMedia(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  bucket: string,
  references: string[]
) {
  const year = String(new Date().getFullYear());
  const prefixes = Array.from(new Set(references.filter(Boolean))).flatMap((ref) => [
    `${year}/${ref}`,
    ref,
  ]);

  const items: Array<{ path: string; tahap: string; tipe_media: "foto" | "video" }> = [];
  const seenPaths = new Set<string>();

  for (const prefix of prefixes) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "desc" },
    });

    if (error || !data) continue;

    for (const entry of data) {
      if (!entry?.name || entry.id === null) continue;

      const fullPath = `${prefix}/${entry.name}`;
      if (seenPaths.has(fullPath)) continue;

      const ext = getExt(fullPath);
      if (!IMAGE_EXTENSIONS.has(ext) && !VIDEO_EXTENSIONS.has(ext)) continue;

      seenPaths.add(fullPath);
      items.push({
        path: fullPath,
        tahap: inferTahapFromPath(fullPath),
        tipe_media: inferMediaType(fullPath),
      });
    }
  }

  return items;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kode: string }> }
) {
  const limited = enforceRateLimit(req, {
    key: "petugas-hewan",
    maxRequests: 120,
    windowMs: 60_000,
    message: "Terlalu banyak request scan hewan. Coba lagi dalam 1 menit.",
  });
  if (limited) return limited;

  const petugasSession = readPetugasSession(req);
  if (!petugasSession) return unauthorizedPetugasResponse();

  try {
    const { kode } = await params;
    const trimmedKode = String(kode ?? "").trim().toUpperCase();
    if (!trimmedKode) {
      return NextResponse.json({ error: "Kode hewan wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const [hewanTable, kelompokTable, statusTable, dokumentasiTable, shohibulTable] = await Promise.all([
      resolveTableName(supabase, "hewan"),
      resolveTableName(supabase, "kelompok"),
      resolveTableName(supabase, "status_tracking"),
      resolveTableName(supabase, "dokumentasi"),
      resolveTableName(supabase, "shohibul"),
    ]);

    if (!hewanTable) {
      return NextResponse.json({ error: "Tabel hewan belum tersedia." }, { status: 503 });
    }

    const kodeColumn = await resolveExistingColumn(supabase, hewanTable, [
      "kode",
      "kode_hewan",
      "code",
      "qr_code",
    ]);

    if (!kodeColumn) {
      return NextResponse.json({ error: "Kolom kode hewan tidak ditemukan." }, { status: 500 });
    }

    const { data: hewan, error: hewanError } = await supabase
      .from(hewanTable)
      .select("*")
      .eq(kodeColumn, trimmedKode)
      .maybeSingle();

    if (hewanError) throw hewanError;
    if (!hewan) {
      return NextResponse.json({ error: "Hewan tidak ditemukan." }, { status: 404 });
    }

    const hewanRow = hewan as Record<string, unknown>;
    const hewanArea = [hewanRow.area, hewanRow.wilayah, hewanRow.zona, hewanRow.lokasi]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .find((value) => value.length > 0) ?? "";
    const petugasArea = petugasSession.area?.trim() ?? "";
    if (hewanArea && petugasArea && hewanArea.toLowerCase() !== petugasArea.toLowerCase()) {
      return NextResponse.json(
        { error: "Hewan ini bukan di area tugas Anda." },
        { status: 403 }
      );
    }

    const hewanId = String(hewan.id);
    const hewanCode = pickFirstString(hewan as GenericRow, ["kode", "kode_hewan", "qr_code", "code"]);

    let kelompok: { id: string; nama: string } | null = null;
    let kelompokNamaFallback: string | null =
      pickFirstString(hewan as GenericRow, ["kelompok_nama", "kelompok", "nama_kelompok", "group_name"]) ??
      null;

    if (kelompokTable) {
      for (const relationColumn of ["hewan_id", "hewan_qurban_id"]) {
        const { data, error } = await supabase
          .from(kelompokTable)
          .select("id,nama")
          .eq(relationColumn, hewanId)
          .maybeSingle();

        if (!error) {
          if (data?.id) {
            kelompok = {
              id: String(data.id),
              nama: String(data.nama ?? "Kelompok"),
            };
          }
          break;
        }

        if (isMissingColumnError(error)) continue;
        throw error;
      }
    }

    const hewanKelompokId = typeof hewan.kelompok_id === "string" ? hewan.kelompok_id : null;

    if (!kelompokNamaFallback && hewanKelompokId) {
      kelompokNamaFallback = guessLegacyKelompokNameFromId(hewanKelompokId);
    }

    if (!kelompokNamaFallback && shohibulTable && hewanKelompokId) {
      const { data: shohibulGroupRow, error: shohibulGroupError } = await supabase
        .from(shohibulTable)
        .select("*")
        .eq("kelompok_id", hewanKelompokId)
        .limit(1)
        .maybeSingle();

      if (!shohibulGroupError) {
        kelompokNamaFallback = pickFirstString(shohibulGroupRow as GenericRow, [
          "kelompok_nama",
          "kelompok",
          "nama_kelompok",
          "group_name",
        ]);
      } else if (!isMissingColumnError(shohibulGroupError)) {
        throw shohibulGroupError;
      }
    }

    if (!kelompok && hewanKelompokId && kelompokTable) {
      const { data: kelompokById, error: kelompokByIdError } = await supabase
        .from(kelompokTable)
        .select("id,nama")
        .eq("id", hewanKelompokId)
        .maybeSingle();

      if (kelompokByIdError && !isMissingColumnError(kelompokByIdError)) {
        throw kelompokByIdError;
      }

      if (kelompokById?.id) {
        kelompok = {
          id: String(kelompokById.id),
          nama: String(kelompokById.nama ?? "Kelompok"),
        };
      }
    }

    if (!kelompok && hewanKelompokId) {
      kelompok = {
        id: hewanKelompokId,
        nama: kelompokNamaFallback ?? "Belum ada kelompok",
      };
    }

    const kelompokId = kelompok?.id ?? hewanKelompokId;

    let shohibul: Array<{ id: string; nama: string }> = [];
    if (shohibulTable && kelompokId) {
      const { data, error } = await supabase
        .from(shohibulTable)
        .select("id,nama")
        .eq("kelompok_id", kelompokId)
        .order("nama", { ascending: true });

      if (error && !isMissingColumnError(error)) {
        throw error;
      }

      shohibul = (data ?? [])
        .filter((item) => typeof item.id === "string")
        .map((item) => ({
          id: String(item.id),
          nama: String(item.nama ?? "Shohibul"),
        }));
    }

    const trackingRows = statusTable
      ? await queryRowsByHewanId(
          supabase,
          statusTable,
          "id,tahap,tipe_tahapan,stage,status_tahap,waktu,catatan,petugas_id,petugas_qurban_id,created_at",
          hewanId,
          hewanCode
        )
      : [];

    const dokumentasiRows = dokumentasiTable
      ? await queryRowsByHewanId(
          supabase,
          dokumentasiTable,
          "id,tahap,tipe_tahapan,tipe_media,media_type,jenis_media,media_url,url,url_media,thumbnail_url,uploaded_at,waktu_upload,created_at,captured_at,waktu_capture",
          hewanId,
          hewanCode,
          kelompokId ? [kelompokId] : []
        )
      : [];

    const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "qurban_media";
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

    const dokumentasiFromTable = dokumentasiRows
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

        // Normalisasi tahap agar cocok dengan TAHAP_URUTAN
        const tahapRaw =
          typeof item.tahap === "string"
            ? item.tahap
            : typeof item.tipe_tahapan === "string"
              ? item.tipe_tahapan
              : "";
        const tahap = normalizeTahap(tahapRaw);

        return {
          id: typeof item.id === "string" ? item.id : `media-${index}`,
          tahap,
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
        return bTs - aTs;
      });

    let dokumentasi = dokumentasiFromTable;

    if (dokumentasi.length === 0) {
      const fallbackItems = await loadStorageFallbackMedia(
        supabase,
        bucket,
        [hewanId, hewanCode ?? "", kelompokId ?? ""]
      );

      if (fallbackItems.length > 0) {
        const fallbackSignedMap = await loadSignedUrlMap(
          supabase,
          bucket,
          fallbackItems.map((item) => item.path)
        );

        dokumentasi = fallbackItems.map((item, index) => ({
          id: `fallback-${index}-${item.path}`,
          tahap: item.tahap,
          tipe_media: item.tipe_media,
          media_url: item.path,
          thumbnail_url: null,
          captured_at: null,
          uploaded_at: null,
          media_public_url:
            fallbackSignedMap.get(item.path) ??
            supabase.storage.from(bucket).getPublicUrl(item.path).data.publicUrl,
          thumbnail_public_url: null,
        }));
      }
    }

    trackingRows.sort((a, b) => {
      const aTime = Date.parse(String(a.waktu ?? a.created_at ?? "")) || 0;
      const bTime = Date.parse(String(b.waktu ?? b.created_at ?? "")) || 0;
      return aTime - bTime;
    });

    const tahapSelesai = new Set(
      trackingRows
        .map((item) => {
          const tahapRaw =
            typeof item.tahap === "string"
              ? item.tahap
              : typeof item.tipe_tahapan === "string"
                ? item.tipe_tahapan
                : typeof item.stage === "string"
                  ? item.stage
                  : typeof item.status_tahap === "string"
                    ? item.status_tahap
                    : "";
          return normalizeTahap(tahapRaw);
        })
        .filter((value) => (TAHAP_URUTAN as readonly string[]).includes(value))
    );

    const mediaCountByTahap: Record<string, number> = {};
    for (const tahap of TAHAP_URUTAN) mediaCountByTahap[tahap] = 0;

    for (const item of dokumentasi) {
      const tahap = typeof item.tahap === "string" ? item.tahap : "";
      if (!tahap) continue;
      mediaCountByTahap[tahap] = (mediaCountByTahap[tahap] ?? 0) + 1;
    }

    const normalizedHewan = {
      id: hewanId,
      kode:
        typeof hewan[kodeColumn] === "string"
          ? String(hewan[kodeColumn])
          : trimmedKode,
      jenis:
        (typeof hewan.jenis === "string"
          ? hewan.jenis
          : typeof hewan.jenis_qurban === "string"
            ? hewan.jenis_qurban
            : "sapi") as "sapi" | "kambing",
      warna:
        typeof hewan.warna === "string"
          ? hewan.warna
          : typeof hewan.warna_bulu === "string"
            ? hewan.warna_bulu
            : null,
      berat_est:
        typeof hewan.berat_est === "number"
          ? hewan.berat_est
          : typeof hewan.berat === "number"
            ? hewan.berat
            : null,
      status: typeof hewan.status === "string" ? hewan.status : "registered",
    };

    return NextResponse.json({
      data: {
        hewan: normalizedHewan,
        kelompok,
        shohibul,
        status_tracking: trackingRows,
        dokumentasi,
        checklist: TAHAP_URUTAN.map((tahap) => ({
          tahap,
          // Fallback: treat stage as done when media exists even if status rows are not readable.
          selesai: tahapSelesai.has(tahap) || (mediaCountByTahap[tahap] ?? 0) > 0,
          media: mediaCountByTahap[tahap] ?? 0,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Gagal mengambil detail hewan.") },
      { status: 500 }
    );
  }
}
