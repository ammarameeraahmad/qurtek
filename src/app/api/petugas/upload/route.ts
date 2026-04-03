import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { TAHAP_URUTAN } from "@/lib/stages";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readPetugasSession, unauthorizedPetugasResponse } from "@/lib/petugas-auth";
import {
  getReadableErrorMessage,
  resolveExistingColumn,
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

function toUploadDiagnostics(error: unknown, bucket: string) {
  const message = getReadableErrorMessage(error, "Upload ke storage gagal.");
  const lower = message.toLowerCase();

  if (lower.includes("bucket") && (lower.includes("not found") || lower.includes("does not exist"))) {
    return `Bucket storage '${bucket}' tidak ditemukan. Periksa nama bucket di env NEXT_PUBLIC_STORAGE_BUCKET atau buat bucket tersebut di Supabase.`;
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("permission") ||
    lower.includes("not authorized") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden")
  ) {
    const serviceKeyReady = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!serviceKeyReady) {
      return "Upload ditolak oleh policy storage. Kemungkinan SUPABASE_SERVICE_ROLE_KEY belum diset di server/deploy atau policy insert bucket belum dibuat.";
    }
    return "Upload ditolak oleh policy storage bucket. Periksa policy INSERT pada storage.objects untuk bucket ini.";
  }

  return message;
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
    const hewanCode = [hewanRow.kode, hewanRow.kode_hewan, hewanRow.qr_code, hewanRow.code]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .find((value) => value.length > 0) ?? null;
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

    if (uploadError) {
      return NextResponse.json(
        { error: toUploadDiagnostics(uploadError, bucket) },
        { status: 500 }
      );
    }

    const dokumentasiTable = await resolveTableName(supabase, "dokumentasi");
    if (!dokumentasiTable) {
      return NextResponse.json(
        { error: "Tabel dokumentasi belum tersedia di Supabase." },
        { status: 503 }
      );
    }

    const uploadedPath = uploadData.path || path;

    const [
      hewanRefColumn,
      petugasRefColumn,
      tahapColumn,
      mediaTypeColumn,
      mediaPathColumn,
      fileSizeColumn,
      capturedAtColumn,
      isSyncedColumn,
    ] = await Promise.all([
      resolveExistingColumn(supabase, dokumentasiTable, ["hewan_id", "hewan_qurban_id", "id_hewan"]),
      resolveExistingColumn(supabase, dokumentasiTable, ["petugas_id", "petugas_qurban_id", "id_petugas"]),
      resolveExistingColumn(supabase, dokumentasiTable, ["tahap", "tipe_tahapan", "stage"]),
      resolveExistingColumn(supabase, dokumentasiTable, ["tipe_media", "media_type", "jenis_media"]),
      resolveExistingColumn(supabase, dokumentasiTable, ["media_url", "url", "url_media"]),
      resolveExistingColumn(supabase, dokumentasiTable, ["file_size", "ukuran_file"]),
      resolveExistingColumn(supabase, dokumentasiTable, ["captured_at", "waktu_capture"]),
      resolveExistingColumn(supabase, dokumentasiTable, ["is_synced", "tersinkron"]),
    ]);

    if (!hewanRefColumn || !tahapColumn || !mediaTypeColumn || !mediaPathColumn) {
      return NextResponse.json(
        {
          error:
            "Kolom inti tabel dokumentasi tidak lengkap. Jalankan migrasi Supabase terbaru (termasuk kolom hewan/tahap/media).",
        },
        { status: 500 }
      );
    }

    const payload: Record<string, unknown> = {
      [hewanRefColumn]: ["kode_hewan", "kode", "qr_code"].includes(hewanRefColumn)
        ? (hewanCode ?? hewanId)
        : hewanId,
      [tahapColumn]: tahap,
      [mediaTypeColumn]: tipeMedia,
      [mediaPathColumn]: uploadedPath,
    };

    if (petugasRefColumn) payload[petugasRefColumn] = petugasSession.id;
    if (fileSizeColumn) payload[fileSizeColumn] = file.size;
    if (capturedAtColumn) payload[capturedAtColumn] = now.toISOString();
    if (isSyncedColumn) payload[isSyncedColumn] = true;

    const { data: insertedData, error: insertError } = await supabase
      .from(dokumentasiTable)
      .insert([payload])
      .select("*")
      .single();

    if (insertError) throw insertError;

    const inserted = (insertedData ?? null) as InsertedRow | null;
    if (!inserted) throw new Error("Gagal menyimpan dokumentasi.");

    const mediaPath =
      typeof inserted.media_url === "string"
        ? inserted.media_url
        : typeof inserted.url === "string"
          ? inserted.url
          : typeof inserted.url_media === "string"
            ? inserted.url_media
          : uploadedPath;

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(mediaPath).data.publicUrl;

    const normalized = {
      id: inserted.id,
      hewan_id: inserted.hewan_id ?? inserted.hewan_qurban_id ?? inserted.id_hewan ?? hewanId,
      petugas_id:
        inserted.petugas_id ?? inserted.petugas_qurban_id ?? inserted.id_petugas ?? petugasSession.id,
      tahap: inserted.tahap ?? inserted.tipe_tahapan ?? tahap,
      tipe_media: inserted.tipe_media ?? inserted.media_type ?? inserted.jenis_media ?? tipeMedia,
      media_url: mediaPath,
      file_size: inserted.file_size ?? inserted.ukuran_file ?? file.size,
      captured_at: inserted.captured_at ?? inserted.waktu_capture ?? now.toISOString(),
      uploaded_at: inserted.uploaded_at ?? inserted.waktu_upload ?? inserted.created_at ?? now.toISOString(),
      public_url: publicUrl,
    };

    return NextResponse.json({ data: normalized }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Upload media gagal." },
      { status: 500 }
    );
  }
}
