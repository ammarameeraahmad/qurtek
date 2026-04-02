import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const COOKIE_NAME = "qurtek_admin_session";

function sessionSignature() {
  const secret = process.env.ADMIN_SESSION_SECRET || "qurtek-dev-session-secret";
  return createHash("sha256").update(secret).digest("hex");
}

export function getAdminCookieName() {
  return COOKIE_NAME;
}

export function createAdminSessionToken() {
  return sessionSignature();
}

export function isAdminAuthorized(req: NextRequest) {
  const value = req.cookies.get(COOKIE_NAME)?.value;
  return value === sessionSignature();
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Akses admin ditolak. Silakan login." }, { status: 401 });
}
