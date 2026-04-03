import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "qurtek_petugas_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type PetugasTokenPayload = {
  sub: string;
  nama: string;
  area: string | null;
  iat: number;
  exp: number;
};

export type PetugasSession = {
  id: string;
  nama: string;
  area: string | null;
};

function getSecret() {
  return (
    process.env.PETUGAS_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    "qurtek-dev-petugas-session-secret"
  );
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

export function createPetugasSessionToken(session: PetugasSession) {
  const now = Math.floor(Date.now() / 1000);
  const payload: PetugasTokenPayload = {
    sub: session.id,
    nama: session.nama,
    area: session.area,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

function parsePetugasSessionToken(token: string): PetugasSession | null {
  const [payloadBase64, providedSignature] = token.split(".");
  if (!payloadBase64 || !providedSignature) return null;

  const expectedSignature = sign(payloadBase64);
  if (!safeEqual(expectedSignature, providedSignature)) return null;

  let payload: PetugasTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8")) as PetugasTokenPayload;
  } catch {
    return null;
  }

  if (!payload?.sub || !payload?.nama || !payload?.exp) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return {
    id: payload.sub,
    nama: payload.nama,
    area: payload.area ?? null,
  };
}

export function readPetugasSession(req: NextRequest) {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  return parsePetugasSessionToken(raw);
}

export function setPetugasSessionCookie(response: NextResponse, session: PetugasSession) {
  response.cookies.set(COOKIE_NAME, createPetugasSessionToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearPetugasSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function unauthorizedPetugasResponse() {
  return NextResponse.json(
    { error: "Sesi petugas tidak valid. Silakan login ulang." },
    { status: 401 }
  );
}
