import { NextResponse } from "next/server";
import { clearPetugasSessionCookie } from "@/lib/petugas-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearPetugasSessionCookie(response);
  return response;
}
