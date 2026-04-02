import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();

    const [
      sapiResult,
      kambingResult,
      shohibulResult,
      hewanResult,
      dokumentasiResult,
      pushResult,
      petugasResult,
    ] = await Promise.all([
      supabase.from("hewan").select("id", { count: "exact", head: true }).eq("jenis", "sapi"),
      supabase.from("hewan").select("id", { count: "exact", head: true }).eq("jenis", "kambing"),
      supabase.from("shohibul").select("id", { count: "exact", head: true }),
      supabase.from("hewan").select("id,status"),
      supabase.from("dokumentasi").select("hewan_id"),
      supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("petugas").select("id,nama,area,is_active"),
    ]);

    const hewanData = hewanResult.data ?? [];
    const dokumentasiData = dokumentasiResult.data ?? [];
    const hewanWithMedia = new Set(dokumentasiData.map((item) => item.hewan_id));

    const lengkap = hewanData.filter((item) => hewanWithMedia.has(item.id)).length;
    const belum = Math.max(hewanData.length - lengkap, 0);

    const metrics = {
      sapi: sapiResult.count ?? 0,
      kambing: kambingResult.count ?? 0,
      shohibul: shohibulResult.count ?? 0,
      totalHewan: hewanData.length,
      dokumentasiLengkap: lengkap,
      dokumentasiBelum: belum,
      pushSubscribed: pushResult.count ?? 0,
      petugasOnline: (petugasResult.data ?? []).filter((item) => item.is_active).length,
    };

    return NextResponse.json({
      metrics,
      hewan: hewanData,
      petugas: petugasResult.data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load dashboard." },
      { status: 500 }
    );
  }
}
