import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { TAHAP_URUTAN } from "@/lib/stages";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kode: string }> }
) {
  try {
    const { kode } = await params;
    const supabase = getSupabaseServerClient();

    const { data: hewan, error: hewanError } = await supabase
      .from("hewan")
      .select("id,kode,jenis,warna,berat_est,status")
      .eq("kode", kode)
      .maybeSingle();

    if (hewanError) throw hewanError;
    if (!hewan) {
      return NextResponse.json({ error: "Hewan tidak ditemukan." }, { status: 404 });
    }

    const [kelompokResult, trackingResult, dokumentasiResult] = await Promise.all([
      supabase.from("kelompok").select("id,nama").eq("hewan_id", hewan.id).maybeSingle(),
      supabase
        .from("status_tracking")
        .select("id,tahap,waktu,catatan,petugas_id")
        .eq("hewan_id", hewan.id)
        .order("waktu", { ascending: true }),
      supabase
        .from("dokumentasi")
        .select("id,tahap,tipe_media,uploaded_at")
        .eq("hewan_id", hewan.id)
        .order("uploaded_at", { ascending: true }),
    ]);

    const kelompok = kelompokResult.data;

    const { data: shohibul, error: shohibulError } = kelompok?.id
      ? await supabase
          .from("shohibul")
          .select("id,nama")
          .eq("kelompok_id", kelompok.id)
          .order("nama", { ascending: true })
      : { data: [], error: null };

    if (shohibulError) throw shohibulError;

    const mediaCountByTahap: Record<string, number> = {};
    for (const tahap of TAHAP_URUTAN) mediaCountByTahap[tahap] = 0;

    for (const item of dokumentasiResult.data ?? []) {
      mediaCountByTahap[item.tahap] = (mediaCountByTahap[item.tahap] ?? 0) + 1;
    }

    const statusByTahap = new Set((trackingResult.data ?? []).map((item) => item.tahap));

    return NextResponse.json({
      data: {
        hewan,
        kelompok,
        shohibul: shohibul ?? [],
        status_tracking: trackingResult.data ?? [],
        dokumentasi: dokumentasiResult.data ?? [],
        checklist: TAHAP_URUTAN.map((tahap) => ({
          tahap,
          selesai: statusByTahap.has(tahap),
          media: mediaCountByTahap[tahap] ?? 0,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengambil detail hewan." },
      { status: 500 }
    );
  }
}
