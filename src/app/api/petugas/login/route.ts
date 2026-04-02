import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pin = String(body.pin ?? "").trim();

    if (pin.length !== 6) {
      return NextResponse.json({ error: "PIN harus 6 digit." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("petugas")
      .select("id,nama,no_hp,area,is_active")
      .eq("pin", pin)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "PIN tidak valid." }, { status: 401 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login petugas gagal." },
      { status: 500 }
    );
  }
}
