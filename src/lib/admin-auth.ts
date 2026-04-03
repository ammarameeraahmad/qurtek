import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "qurtek_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type AdminPayload = {
  sub: "admin";
  iat: number;
  exp: number;
};

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET (>=32 chars) wajib diset di environment.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function parseAdminSessionToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payloadBase64, providedSignature] = parts;
  const expectedSignature = sign(payloadBase64);
  if (!safeEqual(expectedSignature, providedSignature)) return false;

  let payload: AdminPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8")) as AdminPayload;
  } catch {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.sub !== "admin") return false;
  if (!payload.iat || !payload.exp) return false;
  if (payload.exp < now || payload.iat > now + 60) return false;
  return true;
}

export function getAdminCookieName() {
  return COOKIE_NAME;
}

export function createAdminSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminPayload = {
    sub: "admin",
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadBase64}.${sign(payloadBase64)}`;
}

export function isAdminAuthorized(req: NextRequest) {
  const value = req.cookies.get(COOKIE_NAME)?.value;
  if (!value) return false;

  try {
    return parseAdminSessionToken(value);
  } catch {
    return false;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Akses admin ditolak. Silakan login." }, { status: 401 });
}
