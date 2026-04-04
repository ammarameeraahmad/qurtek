import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { mapTahapToHewanStatus, TAHAP_URUTAN } from "@/lib/stages";
import { sendPushToTargets } from "@/lib/push";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readPetugasSession, unauthorizedPetugasResponse } from "@/lib/petugas-auth";
import {
  getReadableErrorMessage,
  isMissingColumnError,
  resolveExistingColumn,
  resolveTableName,
} from "@/lib/supabase-compat";

type GenericRow = Record<string, unknown>;

function normalizeTahapKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function normalizeTahap(tahap: string): string {
  if (!tahap) return tahap;

  const normalized = normalizeTahapKey(tahap);
  const found = (TAHAP_URUTAN as readonly string[]).find(
    (item) => normalizeTahapKey(item) === normalized
  );
  if (found) return found;

  const aliasMap: Record<string, string> = {
    disembelih: "penyembelihan",
    siap_diambil: "distribusi",
    siap_ambil: "distribusi",
  };

  return aliasMap[normalized] ?? normalized;
}

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

async function resolveKelompokIdForHewan(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  kelompokTable: string | null,
  hewan: GenericRow,
  hewanId: string
) {
  if (!kelompokTable) {
    return typeof hewan.kelompok_id === "string" ? hewan.kelompok_id : null;
  }

  for (const column of ["hewan_id", "hewan_qurban_id"]) {
    const { data, error } = await supabase
      .from(kelompokTable)
      .select("id")
      .eq(column, hewanId)
      .maybeSingle();

    if (!error) {
      if (data?.id) return String(data.id);
      continue;
    }

    if (isMissingColumnError(error)) continue;
    throw error;
  }

  return typeof hewan.kelompok_id === "string" ? hewan.kelompok_id : null;
}

async function loadShohibulTargets(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  shohibulTable: string | null,
  kelompokId: string | null,
  hewanId: string,
  hewanCode: string | null,
  origin: string
) {
  if (!shohibulTable) return [] as Array<{ shohibulId: string; portalUrl: string }>;

  const tokenColumn = await resolveExistingColumn(supabase, shohibulTable, [
    "unique_token",
    "link_unik",
    "token",
  ]);
  if (!tokenColumn) return [];

  const probes: Array<{ column: string; value: string | null }> = [
    { column: "kelompok_id", value: kelompokId },
    { column: "group_id", value: kelompokId },
    { column: "kelompok_qurban_id", value: kelompokId },
    { column: "hewan_id", value: hewanId },
    { column: "hewan_qurban_id", value: hewanId },
    { column: "id_hewan", value: hewanId },
  ];

  if (hewanCode) {
    probes.push(
      { column: "kode_hewan", value: hewanCode },
      { column: "kode", value: hewanCode },
      { column: "qr_code", value: hewanCode }
    );
  }

  const targetsById = new Map<string, { shohibulId: string; portalUrl: string }>();

  for (const probe of probes) {
    const value = probe.value?.trim();
    if (!value) continue;

    const { data, error } = await supabase
      .from(shohibulTable)
      .select("*")
      .eq(probe.column, value);

    if (error) {
      if (isMissingColumnError(error)) continue;
      throw error;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    for (const item of rows) {
      const token = item[tokenColumn];
      const id = item.id;

      if (typeof token !== "string" || !token.trim() || typeof id !== "string" || !id.trim()) {
        continue;
      }

      targetsById.set(id, {
        shohibulId: id,
        portalUrl: `${origin}/d/${token}`,
      });
    }
  }

  return Array.from(targetsById.values());
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    key: "petugas-status",
    maxRequests: 40,
    windowMs: 60_000,
    message: "Terlalu banyak update status. Coba lagi dalam 1 menit.",
  });
  if (limited) return limited;

  const petugasSession = readPetugasSession(req);
  if (!petugasSession) return unauthorizedPetugasResponse();

  try {
    const body = await req.json();
    const hewanId = String(body.hewanId ?? "").trim();
    const tahapInput = String(body.tahap ?? "").trim();
    const tahap = normalizeTahap(tahapInput);
    const catatan = body.catatan ? String(body.catatan).trim() : null;

    console.log("[STATUS] Received status update request:", {
      hewanId,
      tahap,
      tahapInput,
      catatan,
    });

    if (!hewanId || !tahap) {
      return NextResponse.json({ error: "Data update status belum lengkap." }, { status: 400 });
    }

    if (!TAHAP_URUTAN.includes(tahap as (typeof TAHAP_URUTAN)[number])) {
      return NextResponse.json({ error: "Tahap status tidak valid." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const [hewanTable, statusTable, kelompokTable, shohibulTable] = await Promise.all([
      resolveTableName(supabase, "hewan"),
      resolveTableName(supabase, "status_tracking"),
      resolveTableName(supabase, "kelompok"),
      resolveTableName(supabase, "shohibul"),
    ]);

    if (!hewanTable) {
      return NextResponse.json({ error: "Tabel hewan belum tersedia." }, { status: 503 });
    }

    if (!statusTable) {
      return NextResponse.json({ error: "Tabel status tracking belum tersedia." }, { status: 503 });
    }

    const { data: hewan, error: hewanError } = await supabase
      .from(hewanTable)
      .select("*")
      .eq("id", hewanId)
      .maybeSingle();

    if (hewanError) throw hewanError;
    if (!hewan) {
      return NextResponse.json({ error: "Hewan tidak ditemukan." }, { status: 404 });
    }

    const hewanRow = hewan as Record<string, unknown>;
    const hewanArea = [hewanRow.area, hewanRow.wilayah, hewanRow.zona, hewanRow.lokasi]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .find((value) => value.length > 0) ?? "";
    const petugasArea = petugasSession.area?.trim() ?? "";
    if (hewanArea && petugasArea && hewanArea.toLowerCase() !== petugasArea.toLowerCase()) {
      return NextResponse.json(
        { error: "Hewan ini bukan di area tugas Anda." },
        { status: 403 }
      );
    }

    const kode =
      typeof hewan.kode === "string"
        ? hewan.kode
        : typeof hewan.qr_code === "string"
          ? hewan.qr_code
          : typeof hewan.code === "string"
            ? hewan.code
            : hewanId;

    console.log("[STATUS] Processing status update for hewan:", { id: hewanId, kode, tahap });

    let trackingRow: GenericRow | null = null;

    const payloads: Array<Record<string, unknown>> = [
      {
        hewan_id: hewanId,
        tahap,
        catatan,
        petugas_id: petugasSession.id,
      },
      {
        hewan_qurban_id: hewanId,
        tahap,
        catatan,
        petugas_qurban_id: petugasSession.id,
      },
      {
        hewan_id: hewanId,
        tahap,
        catatan,
      },
    ];

    let trackingError: unknown = null;

    for (const payload of payloads) {
      const result = await supabase
        .from(statusTable)
        .insert([payload])
        .select("*")
        .single();

      if (!result.error) {
        trackingRow = result.data;
        trackingError = null;
        break;
      }

      trackingError = result.error;
      if (!isMissingColumnError(result.error)) {
        break;
      }
    }

    if (trackingError) throw trackingError;

    const updateResult = await supabase
      .from(hewanTable)
      .update({ status: mapTahapToHewanStatus(tahap as (typeof TAHAP_URUTAN)[number]) })
      .eq("id", hewanId);

    if (updateResult.error && !isMissingColumnError(updateResult.error)) {
      throw updateResult.error;
    }

    console.log("[STATUS] Status tracking saved, loading shohibul targets...");

    const kelompokId = await resolveKelompokIdForHewan(supabase, kelompokTable, hewan, hewanId);
    const targets = await loadShohibulTargets(
      supabase,
      shohibulTable,
      kelompokId,
      hewanId,
      kode,
      req.nextUrl.origin
    );

    console.log("[STATUS] Found shohibul targets:", targets.length);

    let pushResult = { sent: 0, skipped: 0 };
    if (targets.length > 0) {
      console.log("[STATUS] Sending push notification...");
      pushResult = await sendPushToTargets(targets, {
        title: "Qurtek",
        message: buildStatusMessage(tahap, kode),
      });
      console.log("[STATUS] Push result:", pushResult);
    } else {
      console.log("[STATUS] No targets found, skipping push notification");
    }

    const waktu = new Date().toISOString();

    const normalized = {
      id: trackingRow?.id ?? null,
      hewan_id: trackingRow?.hewan_id ?? trackingRow?.hewan_qurban_id ?? hewanId,
      tahap: trackingRow?.tahap ?? tahap,
      waktu: trackingRow?.waktu ?? trackingRow?.created_at ?? waktu,
      catatan: trackingRow?.catatan ?? catatan,
      petugas_id: trackingRow?.petugas_id ?? trackingRow?.petugas_qurban_id ?? petugasSession.id,
    };

    console.log("[STATUS] Status update completed successfully");
    return NextResponse.json({ data: normalized, pushResult });
  } catch (error) {
    console.error("[STATUS] Error:", error);
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Gagal update status.") },
      { status: 500 }
    );
  }
}
