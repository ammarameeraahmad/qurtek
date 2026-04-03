import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    key: "qr-generate",
    maxRequests: 120,
    windowMs: 60_000,
    message: "Terlalu banyak generate QR. Coba lagi dalam 1 menit.",
  });
  if (limited) return limited;

  try {
    const text = req.nextUrl.searchParams.get("text") ?? "";

    if (!text.trim()) {
      return NextResponse.json({ error: "Parameter text wajib diisi." }, { status: 400 });
    }

    if (text.length > 512) {
      return NextResponse.json({ error: "Parameter text terlalu panjang (maks 512 karakter)." }, { status: 400 });
    }

    const dataUrl = await QRCode.toDataURL(text, {
      width: 360,
      margin: 1,
    });

    return NextResponse.json({ dataUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat QR code." },
      { status: 500 }
    );
  }
}
