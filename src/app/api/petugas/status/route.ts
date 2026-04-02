import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { mapTahapToHewanStatus, TAHAP_URUTAN } from "@/lib/stages";
import { sendPushToTargets } from "@/lib/push";

function buildStatusMessage(tahap: string, kode: string) {
  if (tahap === "hewan_tiba") return `Hewan qurban Anda (${kode}) sudah siap di area penyembelihan.`;
  if (tahap === "penyembelihan") return `Alhamdulillah! Hewan qurban Anda (${kode}) telah disembelih.`;
  if (tahap === "pengulitan") return `Proses pengulitan untuk hewan qurban Anda (${kode}) sedang berlangsung.`;
  if (tahap === "pemotongan") return `Daging qurban Anda (${kode}) sedang dalam proses pemotongan.`;
  if (tahap === "penimbangan") return `Daging qurban Anda (${kode}) sedang ditimbang.`;
  if (tahap === "pengemasan") return `Daging qurban Anda (${kode}) sedang dikemas.`;
  if (tahap === "distribusi") return `Daging qurban Anda (${kode}) sudah siap diambil.`;
  return `Status qurban Anda (${kode}) telah diperbarui.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const hewanId = String(body.hewanId ?? "").trim();
    const petugasId = String(body.petugasId ?? "").trim();
    const tahap = String(body.tahap ?? "").trim();
    const catatan = body.catatan ? String(body.catatan).trim() : null;

    if (!hewanId || !petugasId || !tahap) {
      return NextResponse.json({ error: "Data update status belum lengkap." }, { status: 400 });
    }

    if (!TAHAP_URUTAN.includes(tahap as (typeof TAHAP_URUTAN)[number])) {
      return NextResponse.json({ error: "Tahap status tidak valid." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: hewan, error: hewanError } = await supabase
      .from("hewan")
      .select("id,kode")
      .eq("id", hewanId)
      .single();

    if (hewanError) throw hewanError;

    const [trackingResult, updateResult] = await Promise.all([
      supabase
        .from("status_tracking")
        .insert([
          {
            hewan_id: hewanId,
            tahap,
            catatan,
            petugas_id: petugasId,
          },
        ])
        .select("id,hewan_id,tahap,waktu,catatan,petugas_id")
        .single(),
      supabase
        .from("hewan")
        .update({ status: mapTahapToHewanStatus(tahap as (typeof TAHAP_URUTAN)[number]) })
        .eq("id", hewanId),
    ]);

    if (trackingResult.error) throw trackingResult.error;
    if (updateResult.error) throw updateResult.error;

    const { data: kelompok } = await supabase
      .from("kelompok")
      .select("id")
      .eq("hewan_id", hewanId)
      .maybeSingle();

    if (kelompok?.id) {
      const { data: shohibul } = await supabase
        .from("shohibul")
        .select("id,unique_token")
        .eq("kelompok_id", kelompok.id);

      const origin = req.nextUrl.origin;
      const targets = (shohibul ?? []).map((item) => ({
        shohibulId: item.id,
        portalUrl: `${origin}/d/${item.unique_token}`,
      }));

      await sendPushToTargets(targets, {
        title: "Qurtek",
        message: buildStatusMessage(tahap, hewan.kode),
      });
    }

    return NextResponse.json({ data: trackingResult.data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal update status." },
      { status: 500 }
    );
  }
}
