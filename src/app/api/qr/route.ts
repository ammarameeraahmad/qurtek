import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(req: NextRequest) {
  try {
    const text = req.nextUrl.searchParams.get("text") ?? "";

    if (!text.trim()) {
      return NextResponse.json({ error: "Parameter text wajib diisi." }, { status: 400 });
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
