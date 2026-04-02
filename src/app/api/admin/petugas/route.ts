import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("petugas")
      .select("id,nama,no_hp,area,pin,is_active")
      .order("nama", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch petugas." },
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
    const noHp = body.no_hp ? String(body.no_hp).trim() : null;
    const area = body.area ? String(body.area).trim() : null;
    const pin = String(body.pin ?? "").trim();

    if (!nama || !pin || pin.length !== 6) {
      return NextResponse.json(
        { error: "Nama dan PIN 6 digit wajib diisi." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("petugas")
      .insert([
        {
          nama,
          no_hp: noHp,
          area,
          pin,
          is_active: true,
        },
      ])
      .select("id,nama,no_hp,area,pin,is_active")
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create petugas." },
      { status: 500 }
    );
  }
}
