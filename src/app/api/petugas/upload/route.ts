import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { TAHAP_URUTAN } from "@/lib/stages";

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function getExtFromType(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "video/webm") return "webm";
  if (type === "video/quicktime") return "mov";
  return "mp4";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const form = await req.formData();

    const file = form.get("file");
    const hewanId = String(form.get("hewanId") ?? "").trim();
    const petugasId = String(form.get("petugasId") ?? "").trim();
    const tahap = String(form.get("tahap") ?? "").trim();
    const tipeMedia = String(form.get("tipeMedia") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File wajib diisi." }, { status: 400 });
    }

    if (!hewanId || !petugasId || !tahap || !tipeMedia) {
      return NextResponse.json({ error: "Data upload belum lengkap." }, { status: 400 });
    }

    if (!["foto", "video"].includes(tipeMedia)) {
      return NextResponse.json({ error: "Tipe media harus foto atau video." }, { status: 400 });
    }

    if (!TAHAP_URUTAN.includes(tahap as (typeof TAHAP_URUTAN)[number])) {
      return NextResponse.json({ error: "Tahap dokumentasi tidak valid." }, { status: 400 });
    }

    const isImage = ALLOWED_IMAGE.has(file.type);
    const isVideo = ALLOWED_VIDEO.has(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: "Format file harus JPG/PNG/WEBP/MP4/WEBM/MOV." },
        { status: 400 }
      );
    }

    const maxBytes = isImage ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "Ukuran file melebihi batas." }, { status: 400 });
    }

    const ext = getExtFromType(file.type);
    const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "qurban_media";
    const now = new Date();
    const year = String(now.getFullYear());
    const safeTahap = tahap.replace(/[^a-z_]/g, "");
    const path = `${year}/${hewanId}/${safeTahap}-${Date.now()}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: inserted, error: insertError } = await supabase
      .from("dokumentasi")
      .insert([
        {
          hewan_id: hewanId,
          petugas_id: petugasId,
          tahap,
          tipe_media: tipeMedia,
          media_url: uploadData.path,
          file_size: file.size,
          captured_at: now.toISOString(),
          is_synced: true,
        },
      ])
      .select("id,hewan_id,petugas_id,tahap,tipe_media,media_url,file_size,captured_at,uploaded_at")
      .single();

    if (insertError) throw insertError;

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(uploadData.path).data.publicUrl;

    return NextResponse.json({ data: { ...inserted, public_url: publicUrl } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload media gagal." },
      { status: 500 }
    );
  }
}
