import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import {
  deriveLegacyKelompokId,
  guessLegacyKelompokNameFromId,
  normalizeKelompokName,
} from "@/lib/kelompok-compat";
import {
  getReadableErrorMessage,
  isMissingColumnError,
  resolveExistingColumn,
  resolveTableName,
} from "@/lib/supabase-compat";

type GenericRow = Record<string, unknown>;

type HewanColumns = {
  kode: string | null;
  jenis: string | null;
  warna: string | null;
  beratEst: string | null;
  status: string | null;
  kelompokId: string | null;
  kelompokNama: string | null;
  qrCodeUrl: string | null;
  createdAt: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function humanizeKelompokIdIfPossible(raw: string | null) {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (UUID_REGEX.test(trimmed)) return null;

  return trimmed;
}

function formatKelompokLabelFromId(raw: string | null) {
  return guessLegacyKelompokNameFromId(raw) || humanizeKelompokIdIfPossible(raw);
}

async function generateKodeHewan() {
  const supabase = getSupabaseServerClient();
  const hewanTable = await resolveTableName(supabase, "hewan");
  if (!hewanTable) return `HWN-${Date.now().toString().slice(-6)}`;

  const { count, error } = await supabase.from(hewanTable).select("id", { count: "exact", head: true });

  if (error) throw error;
  const next = (count ?? 0) + 1;
  return `HWN-${String(next).padStart(3, "0")}`;
}

async function resolveKelompokId(kelompokNama: string | null) {
  const trimmed = normalizeKelompokName(kelompokNama);

  const supabase = getSupabaseServerClient();
  const kelompokTable = await resolveTableName(supabase, "kelompok");

  if (!trimmed) {
    return {
      kelompokId: null as string | null,
      viaKelompokTable: Boolean(kelompokTable),
    };
  }

  if (!kelompokTable) {
    return {
      kelompokId: deriveLegacyKelompokId(trimmed),
      viaKelompokTable: false,
    };
  }

  const { data: existing } = await supabase
    .from(kelompokTable)
    .select("id")
    .eq("nama", trimmed)
    .maybeSingle();

  if (existing?.id) {
    return { kelompokId: existing.id, viaKelompokTable: true };
  }

  const { data: created, error } = await supabase
    .from(kelompokTable)
    .insert([{ nama: trimmed }])
    .select("id")
    .single();

  if (error) throw error;
  return { kelompokId: created.id, viaKelompokTable: true };
}

async function resolveHewanColumns(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  tableName: string
): Promise<HewanColumns> {
  const [kode, jenis, warna, beratEst, status, kelompokId, kelompokNama, qrCodeUrl, createdAt] = await Promise.all([
    resolveExistingColumn(supabase, tableName, ["kode", "kode_hewan", "code", "qr_code"]),
    resolveExistingColumn(supabase, tableName, ["jenis", "jenis_qurban"]),
    resolveExistingColumn(supabase, tableName, ["warna", "warna_bulu", "ciri_ciri", "ciri", "deskripsi"]),
    resolveExistingColumn(supabase, tableName, ["berat_est", "berat", "berat_estimasi", "berat_kg"]),
    resolveExistingColumn(supabase, tableName, ["status"]),
    resolveExistingColumn(supabase, tableName, ["kelompok_id", "group_id"]),
    resolveExistingColumn(supabase, tableName, ["kelompok_nama", "kelompok", "nama_kelompok", "group_name"]),
    resolveExistingColumn(supabase, tableName, ["qr_code_url", "qr_url"]),
    resolveExistingColumn(supabase, tableName, ["created_at"]),
  ]);

  return {
    kode,
    jenis,
    warna,
    beratEst,
    status,
    kelompokId,
    kelompokNama,
    qrCodeUrl,
    createdAt,
  };
}

function readString(row: GenericRow, key: string | null) {
  if (!key) return null;
  const value = row[key];
  if (value == null) return null;

  const normalized = String(value).trim();
  return normalized || null;
}

function readNumber(row: GenericRow, key: string | null) {
  if (!key) return null;
  const value = row[key];
  if (value == null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

async function syncHewanToKelompok(kelompokId: string | null, hewanId: string) {
  if (!hewanId) return;

  const supabase = getSupabaseServerClient();
  const kelompokTable = await resolveTableName(supabase, "kelompok");
  if (!kelompokTable) return;

  for (const relationColumn of ["hewan_id", "hewan_qurban_id"]) {
    const clearResult = await supabase
      .from(kelompokTable)
      .update({ [relationColumn]: null })
      .eq(relationColumn, hewanId);

    if (clearResult.error) {
      if (isMissingColumnError(clearResult.error)) continue;
      throw clearResult.error;
    }

    if (kelompokId) {
      const assignResult = await supabase
        .from(kelompokTable)
        .update({ [relationColumn]: hewanId })
        .eq("id", kelompokId);

      if (assignResult.error) {
        if (isMissingColumnError(assignResult.error)) continue;
        throw assignResult.error;
      }
    }

    return;
  }
}

async function persistHewanKelompokTextFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  hewanTable: string,
  hewanId: string,
  kelompokNama: string | null,
  viaKelompokTable: boolean
) {
  const normalized = normalizeKelompokName(kelompokNama) || null;

  const textColumns = ["kelompok_nama", "kelompok", "nama_kelompok", "group_name"];
  for (const column of textColumns) {
    const { error } = await supabase
      .from(hewanTable)
      .update({ [column]: normalized })
      .eq("id", hewanId);

    if (!error) return;
    if (isMissingColumnError(error)) continue;
  }

  if (!viaKelompokTable) {
    await supabase
      .from(hewanTable)
      .update({ kelompok_id: normalized })
      .eq("id", hewanId);
  }
}

function buildHewanPayloadVariants(
  columns: HewanColumns,
  input: {
    kode: string;
    jenis: string;
    warna: string | null;
    beratEst: number | null;
    status: string;
    kelompokId: string | null;
    kelompokNama: string | null;
  }
) {
  const dynamicPayload: Record<string, unknown> = {};

  if (columns.kode) dynamicPayload[columns.kode] = input.kode;
  if (columns.jenis) dynamicPayload[columns.jenis] = input.jenis;
  if (columns.warna) dynamicPayload[columns.warna] = input.warna;
  if (columns.beratEst) dynamicPayload[columns.beratEst] = input.beratEst;
  if (columns.status) dynamicPayload[columns.status] = input.status;
  if (columns.kelompokId) dynamicPayload[columns.kelompokId] = input.kelompokId;
  if (columns.kelompokNama) dynamicPayload[columns.kelompokNama] = input.kelompokNama;

  const variants: Array<Record<string, unknown>> = [
    dynamicPayload,
    {
      kode: input.kode,
      jenis: input.jenis,
      warna: input.warna,
      berat_est: input.beratEst,
      status: input.status,
      kelompok_id: input.kelompokId,
      kelompok_nama: input.kelompokNama,
    },
    {
      kode: input.kode,
      jenis: input.jenis,
      warna_bulu: input.warna,
      berat_estimasi: input.beratEst,
      status: input.status,
      kelompok: input.kelompokNama,
    },
    {
      qr_code: input.kode,
      jenis: input.jenis,
      ciri_ciri: input.warna,
      berat: input.beratEst,
      status: input.status,
      kelompok_id: input.kelompokId,
      kelompok: input.kelompokNama,
    },
    {
      qr_code: input.kode,
      jenis: input.jenis,
      status: input.status,
      kelompok_id: input.kelompokId,
    },
  ];

  return variants.filter((payload) => Object.keys(payload).length > 0);
}

function normalizeHewanRow(
  row: GenericRow,
  fallback: {
    kode: string;
    jenis: string;
    warna: string | null;
    berat_est: number | null;
    status: string;
    kelompok_id: string | null;
    kelompok_nama: string | null;
  },
  columns: HewanColumns
) {
  return {
    id: String(row.id ?? ""),
    kode:
      readString(row, columns.kode) ??
      (typeof row.kode === "string"
        ? row.kode
        : typeof row.kode_hewan === "string"
          ? row.kode_hewan
          : typeof row.code === "string"
            ? row.code
            : typeof row.qr_code === "string"
              ? row.qr_code
              : fallback.kode),
    jenis:
      (readString(row, columns.jenis) ??
        (typeof row.jenis === "string"
          ? row.jenis
          : typeof row.jenis_qurban === "string"
            ? row.jenis_qurban
            : fallback.jenis)) as "sapi" | "kambing",
    warna:
      readString(row, columns.warna) ??
      (typeof row.warna === "string"
        ? row.warna
        : typeof row.warna_bulu === "string"
          ? row.warna_bulu
          : typeof row.ciri_ciri === "string"
            ? row.ciri_ciri
            : fallback.warna),
    berat_est:
      readNumber(row, columns.beratEst) ??
      (typeof row.berat_est === "number"
        ? row.berat_est
        : typeof row.berat === "number"
          ? row.berat
          : typeof row.berat_estimasi === "number"
            ? row.berat_estimasi
            : fallback.berat_est),
    qr_code_url:
      readString(row, columns.qrCodeUrl) ??
      (typeof row.qr_code_url === "string"
        ? row.qr_code_url
        : typeof row.qr_url === "string"
          ? row.qr_url
          : null),
    status:
      readString(row, columns.status) ??
      (typeof row.status === "string" ? row.status : fallback.status),
    kelompok_id:
      readString(row, columns.kelompokId) ??
      (typeof row.kelompok_id === "string" ? row.kelompok_id : fallback.kelompok_id),
    kelompok_nama:
      readString(row, columns.kelompokNama) ??
      (typeof row.kelompok_nama === "string"
        ? row.kelompok_nama
        : typeof row.kelompok === "string"
          ? row.kelompok
          : fallback.kelompok_nama) ??
      formatKelompokLabelFromId(
        readString(row, columns.kelompokId) ??
          (typeof row.kelompok_id === "string" ? row.kelompok_id : fallback.kelompok_id)
      ),
    created_at:
      readString(row, columns.createdAt) ??
      (typeof row.created_at === "string" ? row.created_at : null),
  };
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const [hewanTable, kelompokTable] = await Promise.all([
      resolveTableName(supabase, "hewan"),
      resolveTableName(supabase, "kelompok"),
    ]);

    if (!hewanTable) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase.from(hewanTable).select("*");

    if (error) throw error;

    const columns = await resolveHewanColumns(supabase, hewanTable);

    const kelompokNameById = new Map<string, string>();
    const kelompokNameByHewanId = new Map<string, string>();

    if (kelompokTable) {
      const { data: kelompokRows, error: kelompokError } = await supabase
        .from(kelompokTable)
        .select("*");

      if (kelompokError && !isMissingColumnError(kelompokError)) {
        throw kelompokError;
      }

      for (const row of (kelompokRows ?? []) as GenericRow[]) {
        if (typeof row.id !== "string") continue;

        const nama = row.nama != null ? String(row.nama).trim() : "";
        if (nama) {
          kelompokNameById.set(row.id, nama);

          if (typeof row.hewan_id === "string") {
            kelompokNameByHewanId.set(row.hewan_id, nama);
          }
          if (typeof row.hewan_qurban_id === "string") {
            kelompokNameByHewanId.set(row.hewan_qurban_id, nama);
          }
        }
      }
    }

    const mapped = ((data ?? []) as GenericRow[]).map((item, index) => {
      const id = String(item.id ?? "");
      const kelompokId =
        readString(item, columns.kelompokId) ??
        (typeof item.kelompok_id === "string" ? item.kelompok_id : null);

      const kelompokNamaFromRow =
        readString(item, columns.kelompokNama) ??
        (typeof item.kelompok_nama === "string"
          ? item.kelompok_nama
          : typeof item.kelompok === "string"
            ? item.kelompok
            : null);

      return {
        id,
        kode:
          readString(item, columns.kode) ??
          (typeof item.kode === "string"
            ? item.kode
            : typeof item.kode_hewan === "string"
              ? item.kode_hewan
              : typeof item.code === "string"
                ? item.code
                : typeof item.qr_code === "string"
                  ? item.qr_code
                  : `HWN-${String(index + 1).padStart(3, "0")}`),
        jenis:
          (readString(item, columns.jenis) ??
            (typeof item.jenis === "string"
              ? item.jenis
              : typeof item.jenis_qurban === "string"
                ? item.jenis_qurban
                : "sapi")) as "sapi" | "kambing",
        warna:
          readString(item, columns.warna) ??
          (typeof item.warna === "string"
            ? item.warna
            : typeof item.warna_bulu === "string"
              ? item.warna_bulu
              : typeof item.ciri_ciri === "string"
                ? item.ciri_ciri
                : null),
        berat_est:
          readNumber(item, columns.beratEst) ??
          (typeof item.berat_est === "number"
            ? item.berat_est
            : typeof item.berat === "number"
              ? item.berat
              : typeof item.berat_estimasi === "number"
                ? item.berat_estimasi
                : null),
        qr_code_url:
          readString(item, columns.qrCodeUrl) ??
          (typeof item.qr_code_url === "string"
            ? item.qr_code_url
            : typeof item.qr_url === "string"
              ? item.qr_url
              : null),
        status:
          readString(item, columns.status) ??
          (typeof item.status === "string" ? item.status : "registered"),
        kelompok_id: kelompokId,
        kelompok_nama:
          kelompokNamaFromRow?.trim() ||
          kelompokNameByHewanId.get(id) ||
          (kelompokId ? kelompokNameById.get(kelompokId) ?? null : null) ||
          formatKelompokLabelFromId(kelompokId),
        created_at:
          readString(item, columns.createdAt) ??
          (typeof item.created_at === "string" ? item.created_at : null),
      };
    });

    mapped.sort((a, b) => {
      const aTs = a.created_at ? Date.parse(a.created_at) : 0;
      const bTs = b.created_at ? Date.parse(b.created_at) : 0;
      return bTs - aTs;
    });

    return NextResponse.json({ data: mapped });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to fetch hewan.") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const hewanTable = await resolveTableName(supabase, "hewan");
    if (!hewanTable) {
      return NextResponse.json({ error: "Tabel hewan belum tersedia di Supabase." }, { status: 503 });
    }

    const body = await req.json();

    const columns = await resolveHewanColumns(supabase, hewanTable);

    const jenis = String(body.jenis ?? "sapi").trim();
    const warna = body.warna ? String(body.warna).trim() : null;
    const beratEstRaw = body.berat_est ? Number(body.berat_est) : null;
    const beratEst = Number.isNaN(beratEstRaw) ? null : beratEstRaw;
    const kelompokNama = normalizeKelompokName(body.kelompok_nama ? String(body.kelompok_nama) : null) || null;

    const kode = body.kode ? String(body.kode).trim() : await generateKodeHewan();

    if (!["sapi", "kambing"].includes(jenis)) {
      return NextResponse.json({ error: "Jenis hewan harus sapi atau kambing." }, { status: 400 });
    }

    const { kelompokId, viaKelompokTable } = await resolveKelompokId(kelompokNama);

    const payloads = buildHewanPayloadVariants(columns, {
      kode,
      jenis,
      warna,
      beratEst,
      status: "registered",
      kelompokId,
      kelompokNama,
    });

    let inserted: Record<string, unknown> | null = null;
    let insertError: unknown = null;

    for (const payload of payloads) {
      const result = await supabase.from(hewanTable).insert([payload]).select("*").single();

      if (!result.error) {
        inserted = result.data;
        insertError = null;
        break;
      }

      insertError = result.error;
      if (!isMissingColumnError(result.error)) {
        break;
      }
    }

    if (insertError) throw insertError;
    if (!inserted) throw new Error("Insert hewan gagal tanpa data hasil.");

    if (viaKelompokTable) {
      await syncHewanToKelompok(kelompokId, String(inserted.id));
    }

    await persistHewanKelompokTextFallback(
      supabase,
      hewanTable,
      String(inserted.id),
      kelompokNama,
      viaKelompokTable
    );

    const normalized = normalizeHewanRow(
      inserted,
      {
        kode,
        jenis,
        warna,
        berat_est: beratEst,
        status: "registered",
        kelompok_id: kelompokId,
        kelompok_nama: kelompokNama,
      },
      columns
    );

    return NextResponse.json({ data: normalized }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to create hewan.") },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const hewanTable = await resolveTableName(supabase, "hewan");
    if (!hewanTable) {
      return NextResponse.json({ error: "Tabel hewan belum tersedia di Supabase." }, { status: 503 });
    }

    const body = await req.json();

    const columns = await resolveHewanColumns(supabase, hewanTable);

    const id = String(body.id ?? "").trim();
    const jenis = String(body.jenis ?? "sapi").trim();
    const warna = body.warna ? String(body.warna).trim() : null;
    const beratEstRaw = body.berat_est ? Number(body.berat_est) : null;
    const beratEst = Number.isNaN(beratEstRaw) ? null : beratEstRaw;
    const kelompokNama = normalizeKelompokName(body.kelompok_nama ? String(body.kelompok_nama) : null) || null;
    const status = body.status ? String(body.status).trim() : "registered";
    const kode = body.kode ? String(body.kode).trim() : "";

    if (!id || !kode) {
      return NextResponse.json({ error: "ID dan kode hewan wajib diisi." }, { status: 400 });
    }

    if (!["sapi", "kambing"].includes(jenis)) {
      return NextResponse.json({ error: "Jenis hewan harus sapi atau kambing." }, { status: 400 });
    }

    const { kelompokId, viaKelompokTable } = await resolveKelompokId(kelompokNama);

    const payloads = buildHewanPayloadVariants(columns, {
      kode,
      jenis,
      warna,
      beratEst,
      status,
      kelompokId,
      kelompokNama,
    });

    let updated: Record<string, unknown> | null = null;
    let updateError: unknown = null;

    for (const payload of payloads) {
      const result = await supabase
        .from(hewanTable)
        .update(payload)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (!result.error) {
        updated = result.data;
        updateError = null;
        break;
      }

      updateError = result.error;
      if (!isMissingColumnError(result.error)) {
        break;
      }
    }

    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json({ error: "Data hewan tidak ditemukan." }, { status: 404 });
    }

    if (viaKelompokTable) {
      await syncHewanToKelompok(kelompokId, String(updated.id));
    }

    await persistHewanKelompokTextFallback(
      supabase,
      hewanTable,
      String(updated.id),
      kelompokNama,
      viaKelompokTable
    );

    const normalized = normalizeHewanRow(
      updated,
      {
        kode,
        jenis,
        warna,
        berat_est: beratEst,
        status,
        kelompok_id: kelompokId,
        kelompok_nama: kelompokNama,
      },
      columns
    );

    return NextResponse.json({ data: normalized });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to update hewan.") },
      { status: 500 }
    );
  }
}
