import { HewanStatus, TahapDokumentasi } from "@/types/qurtek";

export const TAHAP_URUTAN: TahapDokumentasi[] = [
  "hewan_tiba",
  "penyembelihan",
  "pengulitan",
  "pemotongan",
  "penimbangan",
  "pengemasan",
  "distribusi",
];

export const LABEL_TAHAP: Record<TahapDokumentasi, string> = {
  hewan_tiba: "Hewan Tiba",
  penyembelihan: "Disembelih",
  pengulitan: "Pengulitan",
  pemotongan: "Pemotongan",
  penimbangan: "Penimbangan",
  pengemasan: "Pengemasan",
  distribusi: "Siap Diambil",
};

export function mapTahapToHewanStatus(tahap: TahapDokumentasi): HewanStatus {
  if (tahap === "hewan_tiba") return "ready";
  if (tahap === "penyembelihan") return "slaughtering";
  if (["pengulitan", "pemotongan", "penimbangan", "pengemasan"].includes(tahap)) {
    return "processing";
  }
  if (tahap === "distribusi") return "done";
  return "registered";
}

export function getProgressFromStage(tahapSelesai: TahapDokumentasi[]) {
  const selesai = TAHAP_URUTAN.filter((item) => tahapSelesai.includes(item)).length;
  const total = TAHAP_URUTAN.length;
  const percent = Math.round((selesai / total) * 100);
  return { selesai, total, percent };
}
