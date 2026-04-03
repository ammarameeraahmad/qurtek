import { NextRequest, NextResponse } from "next/server";
import { generateShohibulToken } from "@/lib/token";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { deriveLegacyKelompokId, normalizeKelompokName } from "@/lib/kelompok-compat";
import {
  getReadableErrorMessage,
  isMissingColumnError,
  resolveTableName,
} from "@/lib/supabase-compat";

type InsertResult = {
  data: Record<string, unknown> | null;
  error: unknown;
};

type ShohibulUpsertInput = {
  nama: string;
  noWhatsapp: string;
  jenisQurban: string;
  tipe: string;
  kelompokId: string | null;
  kelompokNama: string | null;
  token?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readFirstString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  return "";
}

function humanizeKelompokIdIfPossible(raw: unknown) {
  if (typeof raw !== "string") return "";

  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (UUID_REGEX.test(trimmed)) return "";

  return trimmed;
}

async function resolveShohibulTokenColumn(supabase: ReturnType<typeof getSupabaseServerClient>, tableName: string) {
  const candidates = ["unique_token", "link_unik", "token"];

  for (const column of candidates) {
    const { error } = await supabase.from(tableName).select(column).limit(1);
    if (!error) return column;
    if (isMissingColumnError(error)) continue;
    return null;
  }

  return null;
}

async function resolveKelompokInfo(kelompokNama?: string | null) {
  const trimmed = normalizeKelompokName(kelompokNama);

  const supabase = getSupabaseServerClient();
  const kelompokTable = await resolveTableName(supabase, "kelompok");

  if (!trimmed) {
    return {
      kelompokId: null as string | null,
      hasKelompokTable: Boolean(kelompokTable),
    };
  }

  // Legacy schema does not have kelompok table, only kelompok_id on shohibul/hewan.
  if (!kelompokTable) {
    return {
      kelompokId: deriveLegacyKelompokId(trimmed),
      hasKelompokTable: false,
    };
  }

  const { data: existing } = await supabase
    .from(kelompokTable)
    .select("id")
    .eq("nama", trimmed)
    .maybeSingle();

  if (existing?.id) {
    return {
      kelompokId: existing.id,
      hasKelompokTable: true,
    };
  }

  const { data: inserted, error } = await supabase
    .from(kelompokTable)
    .insert([{ nama: trimmed }])
    .select("id")
    .single();

  if (error) throw error;
  return {
    kelompokId: inserted.id,
    hasKelompokTable: true,
  };
}

async function persistKelompokTextFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  shohibulTable: string,
  id: string,
  kelompokNama: string | null,
  hasKelompokTable: boolean
) {
  const normalized = normalizeKelompokName(kelompokNama) || null;

  const textColumns = ["kelompok_nama", "kelompok", "nama_kelompok", "group_name"];
  for (const column of textColumns) {
    const { error } = await supabase
      .from(shohibulTable)
      .update({ [column]: normalized })
      .eq("id", id);

    if (!error) return;
    if (isMissingColumnError(error)) continue;
  }

  if (!hasKelompokTable) {
    await supabase
      .from(shohibulTable)
      .update({ kelompok_id: normalized })
      .eq("id", id);
  }
}

async function createUniqueToken() {
  const supabase = getSupabaseServerClient();
  const shohibulTable = await resolveTableName(supabase, "shohibul");
  if (!shohibulTable) return generateShohibulToken();

  const tokenColumn = await resolveShohibulTokenColumn(supabase, shohibulTable);
  if (!tokenColumn) return generateShohibulToken();

  for (let i = 0; i < 8; i += 1) {
    const token = generateShohibulToken();
    const { count, error } = await supabase
      .from(shohibulTable)
      .select("id", { count: "exact", head: true })
      .eq(tokenColumn, token);

    // If token column probing is not supported in this schema, skip uniqueness guard.
    if (error) return token;
    if (!count) return token;
  }

  throw new Error("Failed to generate unique shohibul token.");
}

function buildShohibulPayloadCandidates(input: ShohibulUpsertInput) {
  const modernByKelompokId = {
    nama: input.nama,
    kelompok_id: input.kelompokId,
    no_whatsapp: input.noWhatsapp,
    jenis_qurban: input.jenisQurban,
    tipe: input.tipe,
  };

  const modernByKelompokNama = {
    nama: input.nama,
    kelompok_nama: input.kelompokNama,
    no_whatsapp: input.noWhatsapp,
    jenis_qurban: input.jenisQurban,
    tipe: input.tipe,
  };

  const modernByKelompokText = {
    nama: input.nama,
    kelompok: input.kelompokNama,
    no_whatsapp: input.noWhatsapp,
    jenis_qurban: input.jenisQurban,
    tipe: input.tipe,
  };

  const modernMinimalByKelompokId = {
    nama: input.nama,
    kelompok_id: input.kelompokId,
    no_whatsapp: input.noWhatsapp,
    tipe: input.tipe,
  };

  const legacyByKelompokId = {
    nama: input.nama,
    kelompok_id: input.kelompokId,
    whatsapp: input.noWhatsapp,
    jenis: input.jenisQurban,
    porsi: input.tipe,
  };

  const legacyByKelompokText = {
    nama: input.nama,
    kelompok: input.kelompokNama,
    whatsapp: input.noWhatsapp,
    jenis: input.jenisQurban,
    porsi: input.tipe,
  };

  const legacyMinimalByKelompokId = {
    nama: input.nama,
    kelompok_id: input.kelompokId,
    whatsapp: input.noWhatsapp,
    porsi: input.tipe,
  };

  const modernMinimalByKelompokText = {
    nama: input.nama,
    kelompok: input.kelompokNama,
    no_whatsapp: input.noWhatsapp,
    tipe: input.tipe,
  };

  const legacyMinimalByKelompokText = {
    nama: input.nama,
    kelompok: input.kelompokNama,
    whatsapp: input.noWhatsapp,
    porsi: input.tipe,
  };

  const basePayloads = [
    modernByKelompokId,
    modernByKelompokNama,
    modernByKelompokText,
    modernMinimalByKelompokId,
    modernMinimalByKelompokText,
    legacyByKelompokId,
    legacyByKelompokText,
    legacyMinimalByKelompokId,
    legacyMinimalByKelompokText,
  ];

  if (!input.token) {
    return basePayloads;
  }

  return basePayloads.flatMap((payload) => [
    {
      ...payload,
      unique_token: input.token,
    },
    {
      ...payload,
      link_unik: input.token,
    },
    {
      ...payload,
      token: input.token,
    },
  ]);
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const [shohibulTable, kelompokTable] = await Promise.all([
      resolveTableName(supabase, "shohibul"),
      resolveTableName(supabase, "kelompok"),
    ]);

    if (!shohibulTable) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase.from(shohibulTable).select("*");

    if (error) throw error;

    const kelompokNameById = new Map<string, string>();
    if (kelompokTable) {
      const { data: kelompokRows, error: kelompokError } = await supabase
        .from(kelompokTable)
        .select("id,nama");

      if (kelompokError && !isMissingColumnError(kelompokError)) {
        throw kelompokError;
      }

      for (const row of kelompokRows ?? []) {
        if (typeof row.id !== "string") continue;
        kelompokNameById.set(row.id, String(row.nama ?? ""));
      }
    }

    const mapped = (data ?? []).map((item) => ({
      id: item.id,
      nama: item.nama ?? "",
      no_whatsapp: item.no_whatsapp ?? item.whatsapp ?? "",
      jenis_qurban: item.jenis_qurban ?? item.jenis ?? "sapi",
      tipe: item.tipe ?? item.porsi ?? "1/7",
      kelompok_id: item.kelompok_id ?? item.group_id ?? item.kelompok_qurban_id ?? null,
      kelompok_nama:
        readFirstString(item, ["kelompok_nama", "kelompok", "nama_kelompok", "group_name"]) ||
        (typeof item.kelompok_id === "string" ? (kelompokNameById.get(item.kelompok_id) ?? "") : "") ||
        humanizeKelompokIdIfPossible(item.kelompok_id ?? item.group_id ?? item.kelompok_qurban_id),
      unique_token: item.unique_token ?? item.link_unik ?? item.token ?? "",
      created_at: item.created_at ?? null,
    }));

    mapped.sort((a, b) => {
      const aTs = a.created_at ? Date.parse(a.created_at) : 0;
      const bTs = b.created_at ? Date.parse(b.created_at) : 0;
      return bTs - aTs;
    });

    return NextResponse.json({ data: mapped });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to fetch shohibul.") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const shohibulTable = await resolveTableName(supabase, "shohibul");
    if (!shohibulTable) {
      return NextResponse.json({ error: "Tabel shohibul belum tersedia di Supabase." }, { status: 503 });
    }

    const body = await req.json();

    const nama = String(body.nama ?? "").trim();
    const noWhatsapp = String(body.no_whatsapp ?? "").trim();
    const jenisQurban = String(body.jenis_qurban ?? "sapi").trim();
    const tipe = String(body.tipe ?? "1/7").trim();
    const kelompokNama = normalizeKelompokName(body.kelompok_nama ? String(body.kelompok_nama) : null) || null;

    if (!nama || !noWhatsapp) {
      return NextResponse.json({ error: "Nama dan No. WhatsApp wajib diisi." }, { status: 400 });
    }

    if (!["sapi", "kambing"].includes(jenisQurban)) {
      return NextResponse.json({ error: "Jenis qurban harus sapi atau kambing." }, { status: 400 });
    }

    const kelompokInfo = await resolveKelompokInfo(kelompokNama);
    const kelompokId = kelompokInfo.kelompokId;
    const token = await createUniqueToken();

    const payloads = buildShohibulPayloadCandidates({
      nama,
      noWhatsapp,
      jenisQurban,
      tipe,
      kelompokId,
      kelompokNama,
      token,
    });

    let data: Record<string, unknown> | null = null;
    let error: unknown = null;

    for (const payload of payloads) {
      const result: InsertResult = await supabase
        .from(shohibulTable)
        .insert([payload])
        .select("*")
        .single();

      if (!result.error) {
        data = result.data;
        error = null;
        break;
      }

      error = result.error;
      if (!isMissingColumnError(result.error)) {
        break;
      }
    }

    if (error) throw error;
    if (!data) throw new Error("Insert shohibul gagal tanpa data hasil.");

    await persistKelompokTextFallback(
      supabase,
      shohibulTable,
      String(data.id),
      kelompokNama,
      kelompokInfo.hasKelompokTable
    );

    const normalized = {
      id: data.id,
      nama: data.nama ?? nama,
      no_whatsapp: data.no_whatsapp ?? data.whatsapp ?? noWhatsapp,
      jenis_qurban: data.jenis_qurban ?? data.jenis ?? jenisQurban,
      tipe: data.tipe ?? data.porsi ?? tipe,
      kelompok_id: data.kelompok_id ?? kelompokId,
      kelompok_nama:
        readFirstString(data, ["kelompok_nama", "kelompok", "nama_kelompok", "group_name"]) ||
        kelompokNama ||
        humanizeKelompokIdIfPossible(data.kelompok_id),
      unique_token: data.unique_token ?? data.link_unik ?? data.token ?? token,
      created_at: data.created_at ?? null,
    };

    return NextResponse.json({ data: normalized }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to create shohibul.") },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const shohibulTable = await resolveTableName(supabase, "shohibul");
    if (!shohibulTable) {
      return NextResponse.json({ error: "Tabel shohibul belum tersedia di Supabase." }, { status: 503 });
    }

    const body = await req.json();

    const id = String(body.id ?? "").trim();
    const nama = String(body.nama ?? "").trim();
    const noWhatsapp = String(body.no_whatsapp ?? "").trim();
    const jenisQurban = String(body.jenis_qurban ?? "sapi").trim();
    const tipe = String(body.tipe ?? "1/7").trim();
    const kelompokNama = normalizeKelompokName(body.kelompok_nama ? String(body.kelompok_nama) : null) || null;

    if (!id || !nama || !noWhatsapp) {
      return NextResponse.json({ error: "ID, nama, dan No. WhatsApp wajib diisi." }, { status: 400 });
    }

    if (!["sapi", "kambing"].includes(jenisQurban)) {
      return NextResponse.json({ error: "Jenis qurban harus sapi atau kambing." }, { status: 400 });
    }

    const kelompokInfo = await resolveKelompokInfo(kelompokNama);
    const kelompokId = kelompokInfo.kelompokId;
    const payloads = buildShohibulPayloadCandidates({
      nama,
      noWhatsapp,
      jenisQurban,
      tipe,
      kelompokId,
      kelompokNama,
    });

    let data: Record<string, unknown> | null = null;
    let error: unknown = null;

    for (const payload of payloads) {
      const result = await supabase
        .from(shohibulTable)
        .update(payload)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (!result.error) {
        data = result.data;
        error = null;
        break;
      }

      error = result.error;
      if (!isMissingColumnError(result.error)) {
        break;
      }
    }

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Data shohibul tidak ditemukan." }, { status: 404 });
    }

    await persistKelompokTextFallback(
      supabase,
      shohibulTable,
      String(data.id),
      kelompokNama,
      kelompokInfo.hasKelompokTable
    );

    const normalized = {
      id: data.id,
      nama: data.nama ?? nama,
      no_whatsapp: data.no_whatsapp ?? data.whatsapp ?? noWhatsapp,
      jenis_qurban: data.jenis_qurban ?? data.jenis ?? jenisQurban,
      tipe: data.tipe ?? data.porsi ?? tipe,
      kelompok_id: data.kelompok_id ?? kelompokId,
      kelompok_nama:
        readFirstString(data, ["kelompok_nama", "kelompok", "nama_kelompok", "group_name"]) ||
        kelompokNama ||
        humanizeKelompokIdIfPossible(data.kelompok_id),
      unique_token: data.unique_token ?? data.link_unik ?? data.token ?? "",
      created_at: data.created_at ?? null,
    };

    return NextResponse.json({ data: normalized });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to update shohibul.") },
      { status: 500 }
    );
  }
}
