import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { TAHAP_URUTAN } from "@/lib/stages";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readPetugasSession, unauthorizedPetugasResponse } from "@/lib/petugas-auth";
import {
  getReadableErrorMessage,
  isMissingColumnError,
  resolveTableName,
} from "@/lib/supabase-compat";

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"]);

type InsertedRow = Record<string, unknown>;

function getExtFromType(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "video/webm") return "webm";
  if (type === "video/quicktime") return "mov";
  return "mp4";
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    key: "petugas-upload",
    maxRequests: 30,
    windowMs: 60_000,
    message: "Terlalu banyak upload. Coba lagi dalam 1 menit.",
  });
  if (limited) return limited;

  const petugasSession = readPetugasSession(req);
  if (!petugasSession) return unauthorizedPetugasResponse();

  try {
    const supabase = getSupabaseServerClient();
    const form = await req.formData();

    const file = form.get("file");
    const hewanId = String(form.get("hewanId") ?? "").trim();
    const tahap = String(form.get("tahap") ?? "").trim();
    const tipeMedia = String(form.get("tipeMedia") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File wajib diisi." }, { status: 400 });
    }

    if (!hewanId || !tahap || !tipeMedia) {
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

    const hewanTable = await resolveTableName(supabase, "hewan");
    if (!hewanTable) {
      return NextResponse.json({ error: "Tabel hewan belum tersedia." }, { status: 503 });
    }

    const { data: hewan, error: hewanError } = await supabase
      .from(hewanTable)
      .select("id,area")
      .eq("id", hewanId)
      .maybeSingle();

    if (hewanError) throw hewanError;
    if (!hewan) {
      return NextResponse.json({ error: "Hewan tidak ditemukan." }, { status: 404 });
    }

    const hewanArea = typeof hewan.area === "string" ? hewan.area.trim() : "";
    const petugasArea = petugasSession.area?.trim() ?? "";
    if (hewanArea && petugasArea && hewanArea.toLowerCase() !== petugasArea.toLowerCase()) {
      return NextResponse.json(
        { error: "Hewan ini bukan di area tugas Anda." },
        { status: 403 }
      );
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

    const dokumentasiTable = await resolveTableName(supabase, "dokumentasi");
    if (!dokumentasiTable) {
      return NextResponse.json(
        { error: "Tabel dokumentasi belum tersedia di Supabase." },
        { status: 503 }
      );
    }

    const uploadedPath = uploadData.path || path;

    const payloads: Array<Record<string, unknown>> = [
      {
        hewan_id: hewanId,
        petugas_id: petugasSession.id,
        tahap,
        tipe_media: tipeMedia,
        media_url: uploadedPath,
        file_size: file.size,
        captured_at: now.toISOString(),
        is_synced: true,
      },
      {
        hewan_qurban_id: hewanId,
        petugas_qurban_id: petugasSession.id,
        tahap,
        tipe_media: tipeMedia,
        media_url: uploadedPath,
        file_size: file.size,
        captured_at: now.toISOString(),
        is_synced: true,
      },
      {
        hewan_id: hewanId,
        petugas_id: petugasSession.id,
        tahap,
        media_type: tipeMedia,
        url: uploadedPath,
        file_size: file.size,
        captured_at: now.toISOString(),
        is_synced: true,
      },
    ];

    let inserted: InsertedRow | null = null;
    let insertError: unknown = null;

    for (const payload of payloads) {
      const result = await supabase
        .from(dokumentasiTable)
        .insert([payload])
        .select("*")
        .single();

      if (!result.error) {
        inserted = result.data;
        insertError = null;
        break;
      }

      insertError = result.error;
      if (!isMissingColumnError(result.error)) {
        break;
      }
    }

    if (insertError) throw insertError;
    if (!inserted) throw new Error("Gagal menyimpan dokumentasi.");

    const mediaPath =
      typeof inserted.media_url === "string"
        ? inserted.media_url
        : typeof inserted.url === "string"
          ? inserted.url
          : uploadedPath;

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(mediaPath).data.publicUrl;

    const normalized = {
      id: inserted.id,
      hewan_id: inserted.hewan_id ?? inserted.hewan_qurban_id ?? hewanId,
      petugas_id: inserted.petugas_id ?? inserted.petugas_qurban_id ?? petugasSession.id,
      tahap: inserted.tahap ?? tahap,
      tipe_media: inserted.tipe_media ?? inserted.media_type ?? tipeMedia,
      media_url: mediaPath,
      file_size: inserted.file_size ?? file.size,
      captured_at: inserted.captured_at ?? now.toISOString(),
      uploaded_at: inserted.uploaded_at ?? inserted.created_at ?? now.toISOString(),
      public_url: publicUrl,
    };

    return NextResponse.json({ data: normalized }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Upload media gagal.") },
      { status: 500 }
    );
  }
}
