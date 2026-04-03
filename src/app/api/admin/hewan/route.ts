import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { deriveLegacyKelompokId, normalizeKelompokName } from "@/lib/kelompok-compat";
import {
  getReadableErrorMessage,
  isMissingColumnError,
  resolveTableName,
} from "@/lib/supabase-compat";

async function generateKodeHewan() {
  const supabase = getSupabaseServerClient();
  const hewanTable = await resolveTableName(supabase, "hewan");
  if (!hewanTable) return `HWN-${Date.now().toString().slice(-6)}`;

  const { count, error } = await supabase.from(hewanTable).select("id", { count: "exact", head: true });

  if (error) throw error;
  const next = (count ?? 0) + 1;
  return `HWN-${String(next).padStart(3, "0")}`;
}

async function resolveKelompokId(kelompokNama: string | null) {
  const trimmed = normalizeKelompokName(kelompokNama);
  if (!trimmed) return { kelompokId: null as string | null, viaKelompokTable: false };

  const supabase = getSupabaseServerClient();
  const kelompokTable = await resolveTableName(supabase, "kelompok");

  if (!kelompokTable) {
    return {
      kelompokId: deriveLegacyKelompokId(trimmed),
      viaKelompokTable: false,
    };
  }

  const { data: existing } = await supabase
    .from(kelompokTable)
    .select("id")
    .eq("nama", trimmed)
    .maybeSingle();

  if (existing?.id) {
    return { kelompokId: existing.id, viaKelompokTable: true };
  }

  const { data: created, error } = await supabase
    .from(kelompokTable)
    .insert([{ nama: trimmed }])
    .select("id")
    .single();

  if (error) throw error;
  return { kelompokId: created.id, viaKelompokTable: true };
}

async function attachHewanToKelompok(kelompokId: string | null, hewanId: string) {
  if (!kelompokId) return;

  const supabase = getSupabaseServerClient();
  const kelompokTable = await resolveTableName(supabase, "kelompok");
  if (!kelompokTable) return;

  const { error } = await supabase
    .from(kelompokTable)
    .update({ hewan_id: hewanId })
    .eq("id", kelompokId);

  if (error) throw error;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const hewanTable = await resolveTableName(supabase, "hewan");

    if (!hewanTable) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase.from(hewanTable).select("*");

    if (error) throw error;

    const mapped = (data ?? []).map((item, index) => ({
      id: item.id,
      kode: item.kode ?? item.kode_hewan ?? item.code ?? item.qr_code ?? `HWN-${String(index + 1).padStart(3, "0")}`,
      jenis: item.jenis ?? item.jenis_qurban ?? "sapi",
      warna: item.warna ?? item.warna_bulu ?? null,
      berat_est: item.berat_est ?? item.berat ?? item.berat_estimasi ?? null,
      qr_code_url: item.qr_code_url ?? item.qr_url ?? null,
      status: item.status ?? "registered",
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
      { error: getReadableErrorMessage(error, "Failed to fetch hewan.") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const hewanTable = await resolveTableName(supabase, "hewan");
    if (!hewanTable) {
      return NextResponse.json({ error: "Tabel hewan belum tersedia di Supabase." }, { status: 503 });
    }

    const body = await req.json();

    const jenis = String(body.jenis ?? "sapi").trim();
    const warna = body.warna ? String(body.warna).trim() : null;
    const beratEst = body.berat_est ? Number(body.berat_est) : null;
    const kelompokNama = body.kelompok_nama ? String(body.kelompok_nama) : null;

    const kode = body.kode ? String(body.kode).trim() : await generateKodeHewan();

    if (!["sapi", "kambing"].includes(jenis)) {
      return NextResponse.json({ error: "Jenis hewan harus sapi atau kambing." }, { status: 400 });
    }

    const { kelompokId, viaKelompokTable } = await resolveKelompokId(kelompokNama);

    const payloads: Array<Record<string, unknown>> = [
      {
        kode,
        jenis,
        warna,
        berat_est: Number.isNaN(beratEst) ? null : beratEst,
        status: "registered",
      },
      {
        kode,
        jenis,
        status: "registered",
      },
      {
        qr_code: kode,
        jenis,
        status: "registered",
        kelompok_id: kelompokId,
      },
      {
        qr_code: kode,
        jenis,
        status: "registered",
      },
    ];

    let inserted: Record<string, unknown> | null = null;
    let insertError: unknown = null;

    for (const payload of payloads) {
      const result = await supabase.from(hewanTable).insert([payload]).select("*").single();

      if (!result.error) {
        inserted = result.data;
        insertError = null;
        break;
      }

      insertError = result.error;
      if (!isMissingColumnError(result.error)) {
        break;
      }
    }

    if (insertError) throw insertError;
    if (!inserted) throw new Error("Insert hewan gagal tanpa data hasil.");

    if (viaKelompokTable) {
      await attachHewanToKelompok(kelompokId, String(inserted.id));
    }

    const normalized = {
      id: inserted.id,
      kode: inserted.kode ?? inserted.kode_hewan ?? inserted.code ?? inserted.qr_code ?? kode,
      jenis: inserted.jenis ?? inserted.jenis_qurban ?? jenis,
      warna: inserted.warna ?? inserted.warna_bulu ?? null,
      berat_est: inserted.berat_est ?? inserted.berat ?? inserted.berat_estimasi ?? null,
      qr_code_url: inserted.qr_code_url ?? inserted.qr_url ?? null,
      status: inserted.status ?? "registered",
      created_at: inserted.created_at ?? null,
    };

    return NextResponse.json({ data: normalized }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to create hewan.") },
      { status: 500 }
    );
  }
}
