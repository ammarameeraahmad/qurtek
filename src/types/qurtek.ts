export type JenisQurban = "sapi" | "kambing";

export type HewanStatus =
  | "registered"
  | "ready"
  | "slaughtering"
  | "processing"
  | "distributing"
  | "done";

export type TahapDokumentasi =
  | "hewan_tiba"
  | "penyembelihan"
  | "pengulitan"
  | "pemotongan"
  | "penimbangan"
  | "pengemasan"
  | "distribusi";

export type TipeMedia = "foto" | "video";

export interface Shohibul {
  id: string;
  nama: string;
  no_whatsapp: string;
  jenis_qurban: JenisQurban;
  tipe: string;
  kelompok_id: string | null;
  unique_token: string;
  created_at: string;
}

export interface Hewan {
  id: string;
  kode: string;
  jenis: JenisQurban;
  warna: string | null;
  berat_est: number | null;
  qr_code_url: string | null;
  status: HewanStatus;
  created_at: string;
}

export interface Dokumentasi {
  id: string;
  hewan_id: string;
  petugas_id: string | null;
  tahap: TahapDokumentasi;
  tipe_media: TipeMedia;
  media_url: string;
  thumbnail_url: string | null;
  file_size: number | null;
  captured_at: string | null;
  uploaded_at: string;
  is_synced: boolean;
}
