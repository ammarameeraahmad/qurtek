import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";

async function generateKodeHewan() {
  const supabase = getSupabaseServerClient();
  const { count, error } = await supabase.from("hewan").select("id", { count: "exact", head: true });

  if (error) throw error;
  const next = (count ?? 0) + 1;
  return `HWN-${String(next).padStart(3, "0")}`;
}

async function resolveKelompok(kelompokNama: string | null, hewanId: string) {
  if (!kelompokNama) return null;

  const supabase = getSupabaseServerClient();
  const trimmed = kelompokNama.trim();
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from("kelompok")
    .select("id")
    .eq("nama", trimmed)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("kelompok").update({ hewan_id: hewanId }).eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("kelompok")
    .insert([{ nama: trimmed, hewan_id: hewanId }])
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("hewan")
      .select("id,kode,jenis,warna,berat_est,qr_code_url,status,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch hewan." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const body = await req.json();

    const jenis = String(body.jenis ?? "sapi").trim();
    const warna = body.warna ? String(body.warna).trim() : null;
    const beratEst = body.berat_est ? Number(body.berat_est) : null;
    const kelompokNama = body.kelompok_nama ? String(body.kelompok_nama) : null;

    const kode = body.kode ? String(body.kode).trim() : await generateKodeHewan();

    if (!["sapi", "kambing"].includes(jenis)) {
      return NextResponse.json({ error: "Jenis hewan harus sapi atau kambing." }, { status: 400 });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("hewan")
      .insert([
        {
          kode,
          jenis,
          warna,
          berat_est: Number.isNaN(beratEst) ? null : beratEst,
          status: "registered",
        },
      ])
      .select("id,kode,jenis,warna,berat_est,qr_code_url,status,created_at")
      .single();

    if (insertError) throw insertError;

    await resolveKelompok(kelompokNama, inserted.id);

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create hewan." },
      { status: 500 }
    );
  }
}
