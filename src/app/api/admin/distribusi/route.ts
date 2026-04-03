import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { getReadableErrorMessage, isMissingTableError, resolveTableName } from "@/lib/supabase-compat";

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const distribusiTable = await resolveTableName(supabase, "distribusi");

    if (!distribusiTable) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase
      .from(distribusiTable)
      .select("*");

    if (error && isMissingTableError(error)) {
      return NextResponse.json({ data: [] });
    }

    if (error) throw error;

    const mapped = (data ?? []).map((item) => ({
      id: item.id,
      hewan_id: item.hewan_id ?? item.hewan_qurban_id ?? "",
      shohibul_id: item.shohibul_id ?? item.shohibul_qurban_id ?? "",
      berat_kg: item.berat_kg ?? item.berat ?? null,
      foto_serah: item.foto_serah ?? item.foto ?? null,
      diterima_at: item.diterima_at ?? item.created_at ?? null,
    }));

    mapped.sort((a, b) => {
      const aTs = a.diterima_at ? Date.parse(a.diterima_at) : 0;
      const bTs = b.diterima_at ? Date.parse(b.diterima_at) : 0;
      return bTs - aTs;
    });

    return NextResponse.json({ data: mapped });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Gagal mengambil data distribusi.") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const distribusiTable = await resolveTableName(supabase, "distribusi");
    if (!distribusiTable) {
      return NextResponse.json(
        { error: "Tabel distribusi belum tersedia di Supabase. Jalankan schema terbaru." },
        { status: 503 }
      );
    }

    const body = await req.json();

    const hewanId = String(body.hewan_id ?? "").trim();
    const shohibulId = String(body.shohibul_id ?? "").trim();
    const beratKg = body.berat_kg ? Number(body.berat_kg) : null;

    if (!hewanId || !shohibulId) {
      return NextResponse.json({ error: "hewan_id dan shohibul_id wajib diisi." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(distribusiTable)
      .insert([
        {
          hewan_id: hewanId,
          shohibul_id: shohibulId,
          berat_kg: Number.isNaN(beratKg) ? null : beratKg,
          diterima_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();

    if (error) throw error;

    const normalized = {
      id: data.id,
      hewan_id: data.hewan_id ?? data.hewan_qurban_id ?? hewanId,
      shohibul_id: data.shohibul_id ?? data.shohibul_qurban_id ?? shohibulId,
      berat_kg:
        data.berat_kg ??
        data.berat ??
        (Number.isNaN(beratKg) || typeof beratKg !== "number" ? null : beratKg),
      foto_serah: data.foto_serah ?? data.foto ?? null,
      diterima_at: data.diterima_at ?? data.created_at ?? null,
    };

    return NextResponse.json({ data: normalized }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Gagal menyimpan distribusi.") },
      { status: 500 }
    );
  }
}
