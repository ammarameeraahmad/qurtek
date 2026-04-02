import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();

    const [hewanResult, dokumentasiResult] = await Promise.all([
      supabase.from("hewan").select("id,kode,jenis,status,berat_est"),
      supabase.from("dokumentasi").select("id,hewan_id"),
    ]);

    if (hewanResult.error) throw hewanResult.error;
    if (dokumentasiResult.error) throw dokumentasiResult.error;

    const docCountByHewan = new Map<string, number>();
    for (const doc of dokumentasiResult.data ?? []) {
      docCountByHewan.set(doc.hewan_id, (docCountByHewan.get(doc.hewan_id) ?? 0) + 1);
    }

    const header = ["kode_hewan", "jenis_hewan", "status_hewan", "berat_est", "total_media"];
    const lines = [header.join(",")];

    for (const hewan of hewanResult.data ?? []) {
      const row = [
        csvEscape(hewan.kode),
        csvEscape(hewan.jenis),
        csvEscape(hewan.status),
        csvEscape(hewan.berat_est),
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
      { error: error instanceof Error ? error.message : "Gagal export laporan." },
      { status: 500 }
    );
  }
}
