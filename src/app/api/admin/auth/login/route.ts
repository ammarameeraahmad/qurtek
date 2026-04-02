import { NextRequest, NextResponse } from "next/server";
import { createAdminSessionToken, getAdminCookieName } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "").trim();

    const expectedUsername = process.env.ADMIN_USERNAME || "admin";
    const expectedPassword = process.env.ADMIN_PASSWORD || "admin123456";

    if (username !== expectedUsername || password !== expectedPassword) {
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
