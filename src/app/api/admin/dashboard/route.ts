import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { readPetugasLocalStore } from "@/lib/petugas-store";
import {
  getReadableErrorMessage,
  isMissingTableError,
  resolveTableName,
} from "@/lib/supabase-compat";

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();

    const [hewanTable, shohibulTable, dokumentasiTable, pushTable, petugasTable] = await Promise.all([
      resolveTableName(supabase, "hewan"),
      resolveTableName(supabase, "shohibul"),
      resolveTableName(supabase, "dokumentasi"),
      resolveTableName(supabase, "push_subscriptions"),
      resolveTableName(supabase, "petugas"),
    ]);

    const localPetugas = petugasTable ? null : await readPetugasLocalStore();

    const [hewanResult, shohibulResult, dokumentasiResult, pushResult, petugasResult] = await Promise.all([
      hewanTable ? supabase.from(hewanTable).select("*") : Promise.resolve({ data: [], error: null }),
      shohibulTable ? supabase.from(shohibulTable).select("*") : Promise.resolve({ data: [], error: null }),
      dokumentasiTable ? supabase.from(dokumentasiTable).select("*") : Promise.resolve({ data: [], error: null }),
      pushTable ? supabase.from(pushTable).select("*") : Promise.resolve({ data: [], error: null }),
      petugasTable ? supabase.from(petugasTable).select("*") : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [hewanResult, shohibulResult, dokumentasiResult, pushResult, petugasResult]) {
      if (result.error && !isMissingTableError(result.error)) {
        throw result.error;
      }
    }

    const hewanData = (hewanResult.data ?? []).map((item) => ({
      id: item.id,
      jenis: (item.jenis ?? item.jenis_qurban ?? "") as string,
      status: item.status,
    }));

    const dokumentasiData = dokumentasiResult.data ?? [];
    const hewanWithMedia = new Set(
      dokumentasiData
        .map((item) => item.hewan_id ?? item.hewan_qurban_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    );

    const lengkap = hewanData.filter((item) => hewanWithMedia.has(item.id)).length;
    const belum = Math.max(hewanData.length - lengkap, 0);

    const sapi = hewanData.filter((item) => item.jenis === "sapi").length;
    const kambing = hewanData.filter((item) => item.jenis === "kambing").length;
    const pushSubscribed = (pushResult.data ?? []).filter((item) => item.is_active !== false).length;
    const petugasOnline = localPetugas
      ? localPetugas.filter((item) => item.is_active !== false).length
      : (petugasResult.data ?? []).filter((item) => item.is_active !== false).length;

    const metrics = {
      sapi,
      kambing,
      shohibul: (shohibulResult.data ?? []).length,
      totalHewan: hewanData.length,
      dokumentasiLengkap: lengkap,
      dokumentasiBelum: belum,
      pushSubscribed,
      petugasOnline,
    };

    return NextResponse.json({
      metrics,
      hewan: hewanData,
      petugas: localPetugas ?? (petugasResult.data ?? []),
    });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to load dashboard.") },
      { status: 500 }
    );
  }
}
