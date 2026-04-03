import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { findActivePetugasByPin } from "@/lib/petugas-store";
import { resolveTableName } from "@/lib/supabase-compat";

const PIN_REGEX = /^\d{6}$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pin = String(body.pin ?? "").trim();

    if (!PIN_REGEX.test(pin)) {
      return NextResponse.json({ error: "PIN harus 6 digit." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const petugasTable = await resolveTableName(supabase, "petugas");

    if (!petugasTable) {
      const localPetugas = await findActivePetugasByPin(pin);
      if (!localPetugas) {
        return NextResponse.json({ error: "PIN tidak valid." }, { status: 401 });
      }

      return NextResponse.json({
        data: {
          id: localPetugas.id,
          nama: localPetugas.nama,
          no_hp: localPetugas.no_hp,
          area: localPetugas.area,
          is_active: localPetugas.is_active,
        },
      });
    }

    const { data, error } = await supabase
      .from(petugasTable)
      .select("*")
      .eq("pin", pin)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.is_active === false) {
      return NextResponse.json({ error: "PIN tidak valid." }, { status: 401 });
    }

    return NextResponse.json({
      data: {
        id: data.id,
        nama: data.nama ?? "",
        no_hp: data.no_hp ?? data.no_hp_petugas ?? null,
        area: data.area ?? null,
        is_active: data.is_active ?? true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login petugas gagal." },
      { status: 500 }
    );
  }
}
