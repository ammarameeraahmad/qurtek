import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("distribusi")
      .select("id,hewan_id,shohibul_id,berat_kg,foto_serah,diterima_at")
      .order("diterima_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengambil data distribusi." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const body = await req.json();

    const hewanId = String(body.hewan_id ?? "").trim();
    const shohibulId = String(body.shohibul_id ?? "").trim();
    const beratKg = body.berat_kg ? Number(body.berat_kg) : null;

    if (!hewanId || !shohibulId) {
      return NextResponse.json({ error: "hewan_id dan shohibul_id wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("distribusi")
      .insert([
        {
          hewan_id: hewanId,
          shohibul_id: shohibulId,
          berat_kg: Number.isNaN(beratKg) ? null : beratKg,
          diterima_at: new Date().toISOString(),
        },
      ])
      .select("id,hewan_id,shohibul_id,berat_kg,foto_serah,diterima_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan distribusi." },
      { status: 500 }
    );
  }
}
