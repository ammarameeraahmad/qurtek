import { supabase } from "@/lib/supabase";

export async function uploadMedia({
  file,
  hewanId,
  tahap,
  jenisMedia, // 'foto' | 'video'
}: {
  file: File;
  hewanId: string;
  tahap: string;
  jenisMedia: string;
}) {
  // Nama file: HWN-001/tahap-foto-2026-04-03T12-00-00.jpg
  const ext = file.name.split('.').pop();
  const fileName = `${hewanId}/${tahap}-${jenisMedia}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from("qurban_media")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });
  if (error) throw error;
  // Simpan ke tabel dokumentasi
  const { data: doc, error: docErr } = await supabase
    .from("dokumentasi")
    .insert([
      {
        hewan_id: hewanId,
        url_media: data.path,
        jenis_media: jenisMedia,
        tipe_tahapan: tahap,
      },
    ]);
  if (docErr) throw docErr;
  return data.path;
}
