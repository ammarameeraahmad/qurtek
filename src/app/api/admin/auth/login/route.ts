import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminSessionToken, getAdminCookieName } from "@/lib/admin-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

function constantTimeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    key: "admin-login",
    maxRequests: 5,
    windowMs: 60_000,
    message: "Terlalu banyak percobaan login admin. Coba lagi dalam 1 menit.",
  });
  if (limited) return limited;

  try {
    const body = await req.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "").trim();

    const expectedUsername = process.env.ADMIN_USERNAME;
    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!expectedUsername || !expectedPassword) {
      return NextResponse.json(
        { error: "Konfigurasi admin belum lengkap." },
        { status: 503 }
      );
    }

    if (
      !constantTimeEqual(username, expectedUsername) ||
      !constantTimeEqual(password, expectedPassword)
    ) {
      return NextResponse.json({ error: "Username/password admin salah." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(getAdminCookieName(), createAdminSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login admin gagal." }, { status: 500 });
  }
}
