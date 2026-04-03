import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { addPetugasToLocalStore, readPetugasLocalStore } from "@/lib/petugas-store";
import { getReadableErrorMessage, isMissingTableError, resolveTableName } from "@/lib/supabase-compat";

const PIN_REGEX = /^\d{6}$/;

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const petugasTable = await resolveTableName(supabase, "petugas");

    if (!petugasTable) {
      const localRows = await readPetugasLocalStore();
      localRows.sort((a, b) => a.nama.localeCompare(b.nama));
      return NextResponse.json({ data: localRows });
    }

    const { data, error } = await supabase
      .from(petugasTable)
      .select("*");

    if (error && isMissingTableError(error)) {
      const localRows = await readPetugasLocalStore();
      localRows.sort((a, b) => a.nama.localeCompare(b.nama));
      return NextResponse.json({ data: localRows });
    }

    if (error) throw error;

    const mapped = (data ?? []).map((item) => ({
      id: item.id,
      nama: item.nama ?? "",
      no_hp: item.no_hp ?? item.no_hp_petugas ?? null,
      area: item.area ?? null,
      pin: item.pin ?? "000000",
      is_active: item.is_active ?? true,
    }));

    mapped.sort((a, b) => a.nama.localeCompare(b.nama));

    return NextResponse.json({ data: mapped });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to fetch petugas.") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const petugasTable = await resolveTableName(supabase, "petugas");

    const body = await req.json();

    const nama = String(body.nama ?? "").trim();
    const noHp = body.no_hp ? String(body.no_hp).trim() : null;
    const area = body.area ? String(body.area).trim() : null;
    const pin = String(body.pin ?? "").trim();

    if (!nama || !PIN_REGEX.test(pin)) {
      return NextResponse.json(
        { error: "Nama dan PIN 6 digit wajib diisi." },
        { status: 400 }
      );
    }

    if (!petugasTable) {
      const data = await addPetugasToLocalStore({
        nama,
        no_hp: noHp,
        area,
        pin,
      });

      return NextResponse.json({ data }, { status: 201 });
    }

    const { data, error } = await supabase
      .from(petugasTable)
      .insert([
        {
          nama,
          no_hp: noHp,
          area,
          pin,
          is_active: true,
        },
      ])
      .select("*")
      .single();

    if (error) throw error;

    const normalized = {
      id: data.id,
      nama: data.nama ?? nama,
      no_hp: data.no_hp ?? noHp,
      area: data.area ?? area,
      pin: data.pin ?? pin,
      is_active: data.is_active ?? true,
    };

    return NextResponse.json({ data: normalized }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to create petugas.") },
      { status: 500 }
    );
  }
}
