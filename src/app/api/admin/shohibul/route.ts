import { NextRequest, NextResponse } from "next/server";
import { generateShohibulToken } from "@/lib/token";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";

async function resolveKelompokId(kelompokNama?: string | null) {
  if (!kelompokNama) return null;

  const supabase = getSupabaseServerClient();
  const trimmed = kelompokNama.trim();
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from("kelompok")
    .select("id")
    .eq("nama", trimmed)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: inserted, error } = await supabase
    .from("kelompok")
    .insert([{ nama: trimmed }])
    .select("id")
    .single();

  if (error) throw error;
  return inserted.id;
}

async function createUniqueToken() {
  const supabase = getSupabaseServerClient();

  for (let i = 0; i < 8; i += 1) {
    const token = generateShohibulToken();
    const { count, error } = await supabase
      .from("shohibul")
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

    const { data, error } = await supabase
      .from("shohibul")
      .select("id,nama,no_whatsapp,jenis_qurban,tipe,kelompok_id,unique_token,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch shohibul." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
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

    const { data, error } = await supabase
      .from("shohibul")
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
      .select("id,nama,no_whatsapp,jenis_qurban,tipe,kelompok_id,unique_token,created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create shohibul." },
      { status: 500 }
    );
  }
}
