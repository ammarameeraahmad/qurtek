import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { getReadableErrorMessage, isMissingTableError, resolveTableName } from "@/lib/supabase-compat";

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const [hewanTable, dokumentasiTable] = await Promise.all([
      resolveTableName(supabase, "hewan"),
      resolveTableName(supabase, "dokumentasi"),
    ]);

    if (!hewanTable) {
      return NextResponse.json({ error: "Tabel hewan belum tersedia di Supabase." }, { status: 503 });
    }

    const [hewanResult, dokumentasiResult] = await Promise.all([
      supabase.from(hewanTable).select("*"),
      dokumentasiTable ? supabase.from(dokumentasiTable).select("*") : Promise.resolve({ data: [], error: null }),
    ]);

    if (hewanResult.error) throw hewanResult.error;
    if (dokumentasiResult.error && !isMissingTableError(dokumentasiResult.error)) {
      throw dokumentasiResult.error;
    }

    const docCountByHewan = new Map<string, number>();
    for (const doc of dokumentasiResult.data ?? []) {
      const hewanId = doc.hewan_id ?? doc.hewan_qurban_id;
      if (!hewanId) continue;
      docCountByHewan.set(hewanId, (docCountByHewan.get(hewanId) ?? 0) + 1);
    }

    const header = ["kode_hewan", "jenis_hewan", "status_hewan", "berat_est", "total_media"];
    const lines = [header.join(",")];

    for (const hewan of hewanResult.data ?? []) {
      const kode = hewan.kode ?? hewan.kode_hewan ?? hewan.code ?? hewan.id;
      const jenis = hewan.jenis ?? hewan.jenis_qurban ?? "";
      const status = hewan.status ?? "";
      const berat = hewan.berat_est ?? hewan.berat ?? hewan.berat_estimasi ?? null;

      const row = [
        csvEscape(kode),
        csvEscape(jenis),
        csvEscape(status),
        csvEscape(berat),
        csvEscape(docCountByHewan.get(hewan.id) ?? 0),
      ];
      lines.push(row.join(","));
    }

    const csv = lines.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="laporan-qurtek-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Gagal export laporan.") },
      { status: 500 }
    );
  }
}
