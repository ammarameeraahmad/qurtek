import { NextRequest, NextResponse } from "next/server";
import { generateShohibulToken } from "@/lib/token";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { getReadableErrorMessage, resolveTableName } from "@/lib/supabase-compat";

async function resolveKelompokId(kelompokNama?: string | null) {
  if (!kelompokNama) return null;

  const supabase = getSupabaseServerClient();
  const kelompokTable = await resolveTableName(supabase, "kelompok");
  if (!kelompokTable) return null;

  const trimmed = kelompokNama.trim();
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from(kelompokTable)
    .select("id")
    .eq("nama", trimmed)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: inserted, error } = await supabase
    .from(kelompokTable)
    .insert([{ nama: trimmed }])
    .select("id")
    .single();

  if (error) throw error;
  return inserted.id;
}

async function createUniqueToken() {
  const supabase = getSupabaseServerClient();
  const shohibulTable = await resolveTableName(supabase, "shohibul");
  if (!shohibulTable) return generateShohibulToken();

  for (let i = 0; i < 8; i += 1) {
    const token = generateShohibulToken();
    const { count, error } = await supabase
      .from(shohibulTable)
      .select("id", { count: "exact", head: true })
      .eq("unique_token", token);

    if (error) throw error;
    if (!count) return token;
  }

  throw new Error("Failed to generate unique shohibul token.");
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const shohibulTable = await resolveTableName(supabase, "shohibul");

    if (!shohibulTable) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase.from(shohibulTable).select("*");

    if (error) throw error;

    const mapped = (data ?? []).map((item) => ({
      id: item.id,
      nama: item.nama ?? "",
      no_whatsapp: item.no_whatsapp ?? item.whatsapp ?? "",
      jenis_qurban: item.jenis_qurban ?? item.jenis ?? "sapi",
      tipe: item.tipe ?? item.porsi ?? "1/7",
      kelompok_id: item.kelompok_id ?? null,
      unique_token: item.unique_token ?? item.token ?? "",
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
    const kelompokNama = body.kelompok_nama ? String(body.kelompok_nama) : null;

    if (!nama || !noWhatsapp) {
      return NextResponse.json({ error: "Nama dan No. WhatsApp wajib diisi." }, { status: 400 });
    }

    if (!["sapi", "kambing"].includes(jenisQurban)) {
      return NextResponse.json({ error: "Jenis qurban harus sapi atau kambing." }, { status: 400 });
    }

    const kelompokId = await resolveKelompokId(kelompokNama);
    const token = await createUniqueToken();

    const primaryInsert = await supabase
      .from(shohibulTable)
      .insert([
        {
          nama,
          no_whatsapp: noWhatsapp,
          jenis_qurban: jenisQurban,
          tipe,
          kelompok_id: kelompokId,
          unique_token: token,
        },
      ])
      .select("*")
      .single();

    let data = primaryInsert.data;
    let error = primaryInsert.error;

    // Legacy schema fallback
    if (error) {
      const legacyInsert = await supabase
        .from(shohibulTable)
        .insert([
          {
            nama,
            whatsapp: noWhatsapp,
            kelompok_id: kelompokId,
          },
        ])
        .select("*")
        .single();

      data = legacyInsert.data;
      error = legacyInsert.error;
    }

    if (error) throw error;

    const normalized = {
      id: data.id,
      nama: data.nama ?? nama,
      no_whatsapp: data.no_whatsapp ?? data.whatsapp ?? noWhatsapp,
      jenis_qurban: data.jenis_qurban ?? data.jenis ?? jenisQurban,
      tipe: data.tipe ?? data.porsi ?? tipe,
      kelompok_id: data.kelompok_id ?? kelompokId,
      unique_token: data.unique_token ?? data.token ?? token,
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
