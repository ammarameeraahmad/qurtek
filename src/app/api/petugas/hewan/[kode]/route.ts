import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { TAHAP_URUTAN } from "@/lib/stages";
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

type GenericRow = Record<string, unknown>;

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
  hewanId: string
) {
  const initialColumns = selectClause
    .split(",")
    .map((column) => column.trim())
    .filter((column) => column.length > 0);

  for (const column of ["hewan_id", "hewan_qurban_id", "id_hewan"]) {
    let selectColumns = [...initialColumns];

    while (selectColumns.length > 0) {
      const { data, error } = await supabase
        .from(tableName)
        .select(selectColumns.join(","))
        .eq(column, hewanId);

      if (!error) {
        return (data ?? []) as unknown as GenericRow[];
      }

      if (!isMissingColumnError(error)) throw error;

      const missingColumn = getMissingColumnName(error);
      if (!missingColumn) break;

      const nextColumns = selectColumns.filter((item) => item !== missingColumn);
      if (nextColumns.length === selectColumns.length) break;
      selectColumns = nextColumns;
    }
  }

  return [] as GenericRow[];
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
          "id,tahap,waktu,catatan,petugas_id,petugas_qurban_id,created_at",
          hewanId
        )
      : [];

    const dokumentasiRows = dokumentasiTable
      ? await queryRowsByHewanId(
          supabase,
          dokumentasiTable,
          "id,tahap,tipe_tahapan,tipe_media,media_type,jenis_media,uploaded_at,waktu_upload,created_at",
          hewanId
        )
      : [];

    trackingRows.sort((a, b) => {
      const aTime = Date.parse(String(a.waktu ?? a.created_at ?? "")) || 0;
      const bTime = Date.parse(String(b.waktu ?? b.created_at ?? "")) || 0;
      return aTime - bTime;
    });

    const tahapSelesai = new Set(
      trackingRows
        .map((item) => (typeof item.tahap === "string" ? item.tahap : ""))
        .filter((value) => value.length > 0)
    );

    const mediaCountByTahap: Record<string, number> = {};
    for (const tahap of TAHAP_URUTAN) mediaCountByTahap[tahap] = 0;

    for (const item of dokumentasiRows) {
      const tahap =
        typeof item.tahap === "string"
          ? item.tahap
          : typeof item.tipe_tahapan === "string"
            ? item.tipe_tahapan
            : "";
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
        dokumentasi: dokumentasiRows,
        checklist: TAHAP_URUTAN.map((tahap) => ({
          tahap,
          selesai: tahapSelesai.has(tahap),
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
