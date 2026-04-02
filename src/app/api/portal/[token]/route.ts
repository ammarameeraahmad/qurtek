import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { LABEL_TAHAP, TAHAP_URUTAN } from "@/lib/stages";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseServerClient();
    const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "qurban_media";

    const { data: shohibul, error: shohibulError } = await supabase
      .from("shohibul")
      .select("id,nama,no_whatsapp,jenis_qurban,tipe,kelompok_id,unique_token")
      .eq("unique_token", token)
      .maybeSingle();

    if (shohibulError) throw shohibulError;
    if (!shohibul) {
      return NextResponse.json({ error: "Link shohibul tidak valid." }, { status: 404 });
    }

    if (!shohibul.kelompok_id) {
      return NextResponse.json({
        data: {
          shohibul,
          hewan: null,
          status_tracking: [],
          dokumentasi: [],
          timeline: [],
        },
      });
    }

    const { data: kelompok, error: kelompokError } = await supabase
      .from("kelompok")
      .select("id,nama,hewan_id")
      .eq("id", shohibul.kelompok_id)
      .single();

    if (kelompokError) throw kelompokError;

    if (!kelompok.hewan_id) {
      return NextResponse.json({
        data: {
          shohibul,
          kelompok,
          hewan: null,
          status_tracking: [],
          dokumentasi: [],
          timeline: [],
        },
      });
    }

    const { data: hewan, error: hewanError } = await supabase
      .from("hewan")
      .select("id,kode,jenis,warna,berat_est,status")
      .eq("id", kelompok.hewan_id)
      .single();

    if (hewanError) throw hewanError;

    const [statusResult, dokumentasiResult] = await Promise.all([
      supabase
        .from("status_tracking")
        .select("id,tahap,waktu,catatan")
        .eq("hewan_id", hewan.id)
        .order("waktu", { ascending: true }),
      supabase
        .from("dokumentasi")
        .select("id,tahap,tipe_media,media_url,thumbnail_url,captured_at,uploaded_at")
        .eq("hewan_id", hewan.id)
        .order("uploaded_at", { ascending: true }),
    ]);

    if (statusResult.error) throw statusResult.error;
    if (dokumentasiResult.error) throw dokumentasiResult.error;

    const dokumentasi = (dokumentasiResult.data ?? []).map((item) => ({
      ...item,
      media_public_url: supabase.storage.from(bucket).getPublicUrl(item.media_url).data.publicUrl,
      thumbnail_public_url: item.thumbnail_url
        ? supabase.storage.from(bucket).getPublicUrl(item.thumbnail_url).data.publicUrl
        : null,
    }));

    const statusByTahap = new Map((statusResult.data ?? []).map((item) => [item.tahap, item]));
    const mediaCountByTahap = new Map<string, number>();

    for (const media of dokumentasi) {
      mediaCountByTahap.set(media.tahap, (mediaCountByTahap.get(media.tahap) ?? 0) + 1);
    }

    const timeline = TAHAP_URUTAN.map((tahap) => {
      const status = statusByTahap.get(tahap);
      return {
        tahap,
        label: LABEL_TAHAP[tahap],
        status: status ? "done" : "pending",
        waktu: status?.waktu ?? null,
        media: mediaCountByTahap.get(tahap) ?? 0,
      };
    });

    return NextResponse.json({
      data: {
        shohibul,
        kelompok,
        hewan,
        status_tracking: statusResult.data ?? [],
        dokumentasi,
        timeline,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat portal shohibul." },
      { status: 500 }
    );
  }
}
