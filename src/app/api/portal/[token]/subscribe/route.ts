import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  getReadableErrorMessage,
  isMissingColumnError,
  resolveExistingColumn,
  resolveTableName,
} from "@/lib/supabase-compat";

const configuredMin = Number(process.env.PORTAL_TOKEN_MIN_LENGTH ?? "24");
const TOKEN_MIN_LEN = Number.isFinite(configuredMin)
  ? Math.min(Math.max(configuredMin, 6), 120)
  : 24;
const TOKEN_REGEX = new RegExp(`^[A-Za-z0-9_-]{${TOKEN_MIN_LEN},120}$`);
const ALLOW_INLINE_PUSH_SUBSCRIPTION_FALLBACK =
  process.env.ALLOW_INLINE_PUSH_SUBSCRIPTION_FALLBACK === "true";

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

    const pushTable = await resolveTableName(supabase, "push_subscriptions");

    if (pushTable) {
      const { data: existing, error: existingError } = await supabase
        .from(pushTable)
        .select("id")
        .eq("endpoint", endpoint)
        .eq("shohibul_id", shohibul.id)
        .maybeSingle();

      if (existingError && !isMissingColumnError(existingError)) {
        throw existingError;
      }

      if (existing?.id) {
        const updatePayloads = [
          { p256dh_key: p256dh, auth_key: auth, is_active: true },
          { p256dh: p256dh, auth: auth, is_active: true },
        ];

        let updated = false;
        let updateError: unknown = null;

        for (const payload of updatePayloads) {
          const result = await supabase
            .from(pushTable)
            .update(payload)
            .eq("id", existing.id);

          if (!result.error) {
            updated = true;
            updateError = null;
            break;
          }

          updateError = result.error;
          if (!isMissingColumnError(result.error)) break;
        }

        if (!updated && updateError) throw updateError;
      } else {
        const insertPayloads = [
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

        let inserted = false;
        let insertError: unknown = null;

        for (const payload of insertPayloads) {
          const result = await supabase.from(pushTable).insert([payload]);
          if (!result.error) {
            inserted = true;
            insertError = null;
            break;
          }

          insertError = result.error;
          if (!isMissingColumnError(result.error)) break;
        }

        if (!inserted && insertError) throw insertError;
      }
    }

    if (ALLOW_INLINE_PUSH_SUBSCRIPTION_FALLBACK) {
      // Optional mirror for legacy deployments. Keep disabled by default.
      const inlineSubscription = {
        endpoint,
        keys: {
          p256dh,
          auth,
        },
      };

      const inlinePayloads = [
        { push_subscription: inlineSubscription },
        { subscription: inlineSubscription },
      ];

      let inlineUpdated = false;
      let inlineUpdateError: unknown = null;

      for (const payload of inlinePayloads) {
        const result = await supabase
          .from(shohibulTable)
          .update(payload)
          .eq("id", shohibul.id);

        if (!result.error) {
          inlineUpdated = true;
          inlineUpdateError = null;
          break;
        }

        inlineUpdateError = result.error;
        if (!isMissingColumnError(result.error)) break;
      }

      if (!inlineUpdated && inlineUpdateError && !isMissingColumnError(inlineUpdateError)) {
        throw inlineUpdateError;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Gagal menyimpan subscription.") },
      { status: 500 }
    );
  }
}
