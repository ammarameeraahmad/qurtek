import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { SHOHIBUL_TOKEN_LENGTH } from "@/lib/token";
import {
  getReadableErrorMessage,
  isMissingColumnError,
  resolveExistingColumn,
  resolveTableName,
} from "@/lib/supabase-compat";

const configuredMin = Number(process.env.PORTAL_TOKEN_MIN_LENGTH ?? String(SHOHIBUL_TOKEN_LENGTH));
const TOKEN_MIN_LEN = Number.isFinite(configuredMin)
  ? Math.min(Math.max(configuredMin, 6), 120)
  : SHOHIBUL_TOKEN_LENGTH;
const TOKEN_REGEX = new RegExp(`^[A-Za-z0-9_-]{${TOKEN_MIN_LEN},120}$`);

function isValidEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = enforceRateLimit(req, {
    key: "portal-subscribe",
    maxRequests: 20,
    windowMs: 60_000,
    message: "Terlalu banyak percobaan aktivasi notifikasi. Coba lagi dalam 1 menit.",
  });
  if (limited) return limited;

  try {
    const { token } = await params;
    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: "Format token tidak valid." }, { status: 400 });
    }

    const body = await req.json();

    const endpoint = String(body?.endpoint ?? "").trim();
    const p256dh = String(body?.keys?.p256dh ?? "").trim();
    const auth = String(body?.keys?.auth ?? "").trim();

    console.log("[SUBSCRIBE] Received subscription request:", {
      token: token.substring(0, 10) + "...",
      endpoint: endpoint.substring(0, 50) + "...",
      hasP256dh: !!p256dh,
      hasAuth: !!auth,
    });

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Subscription tidak valid." }, { status: 400 });
    }

    if (!isValidEndpoint(endpoint)) {
      return NextResponse.json({ error: "Endpoint subscription tidak valid." }, { status: 400 });
    }

    if (endpoint.length > 2048) {
      return NextResponse.json({ error: "Endpoint terlalu panjang." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const shohibulTable = await resolveTableName(supabase, "shohibul");
    if (!shohibulTable) {
      return NextResponse.json({ error: "Tabel shohibul belum tersedia." }, { status: 503 });
    }

    const tokenColumn = await resolveExistingColumn(supabase, shohibulTable, [
      "unique_token",
      "link_unik",
      "token",
    ]);

    if (!tokenColumn) {
      return NextResponse.json({ error: "Kolom token shohibul tidak ditemukan." }, { status: 500 });
    }

    const { data: shohibul, error: shohibulError } = await supabase
      .from(shohibulTable)
      .select("id")
      .eq(tokenColumn, token)
      .maybeSingle();

    if (shohibulError) throw shohibulError;
    if (!shohibul) {
      return NextResponse.json({ error: "Link shohibul tidak valid." }, { status: 404 });
    }

    console.log("[SUBSCRIBE] Found shohibul:", { id: shohibul.id });

    const pushTable = await resolveTableName(supabase, "push_subscriptions");

    if (!pushTable) {
      return NextResponse.json({ error: "Tabel push_subscriptions belum tersedia." }, { status: 503 });
    }

    const upsertPayloads = [
      {
        shohibul_id: shohibul.id,
        endpoint,
        p256dh_key: p256dh,
        auth_key: auth,
        is_active: true,
      },
      {
        shohibul_id: shohibul.id,
        endpoint,
        p256dh,
        auth,
        is_active: true,
      },
    ];

    let upserted = false;
    let upsertError: unknown = null;

    console.log("[SUBSCRIBE] Attempting to upsert subscription:", {
      shohibul_id: shohibul.id,
      endpoint: endpoint.substring(0, 50) + "...",
    });

    for (const payload of upsertPayloads) {
      const result = await supabase
        .from(pushTable)
        .upsert(payload, { onConflict: "endpoint" });

      if (!result.error) {
        upserted = true;
        upsertError = null;
        console.log("[SUBSCRIBE] Subscription saved successfully");
        break;
      }

      upsertError = result.error;
      console.log("[SUBSCRIBE] Upsert attempt failed:", result.error);
      if (!isMissingColumnError(result.error)) break;
    }

    if (!upserted && upsertError) throw upsertError;

    console.log("[SUBSCRIBE] Subscription completed successfully");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[SUBSCRIBE] Error:", error);
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Gagal menyimpan subscription.") },
      { status: 500 }
    );
  }
}
