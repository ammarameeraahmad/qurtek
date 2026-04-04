import webPush from "web-push";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isMissingColumnError, resolveTableName } from "@/lib/supabase-compat";

type NormalizedSubscription = {
  id?: string;
  shohibul_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
};

let isConfigured = false;

function configureWebPush() {
  if (isConfigured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@qurtek.id";

  console.log("[PUSH] configureWebPush called", {
    hasPublicKey: !!publicKey,
    hasPrivateKey: !!privateKey,
    publicKeyPrefix: publicKey?.substring(0, 20),
    subject,
  });

  if (!publicKey || !privateKey) {
    console.log("[PUSH] Missing VAPID keys, skipping configuration");
    return;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  isConfigured = true;
  console.log("[PUSH] Web Push configured successfully");
}

async function loadSubscriptionsFromPushTable(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  pushTable: string,
  targetIds: string[]
) {
  const selectCandidates = [
    "id, shohibul_id, endpoint, p256dh_key, auth_key",
    "id, shohibul_id, endpoint, p256dh, auth",
  ];

  for (const selectClause of selectCandidates) {
    const { data, error } = await supabase
      .from(pushTable)
      .select(selectClause)
      .in("shohibul_id", targetIds)
      .eq("is_active", true);

    if (error) {
      if (isMissingColumnError(error)) continue;
      console.error("[PUSH] Error loading subscriptions:", error);
      return [] as NormalizedSubscription[];
    }

    const rows = (data ?? []) as unknown[];
    const normalized: NormalizedSubscription[] = [];

    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;

      const shohibulId =
        typeof item.shohibul_id === "string" ? item.shohibul_id.trim() : "";
      const endpoint =
        typeof item.endpoint === "string" ? item.endpoint.trim() : "";
      const p256dhKey =
        typeof item.p256dh_key === "string"
          ? item.p256dh_key.trim()
          : typeof item.p256dh === "string"
            ? item.p256dh.trim()
            : "";
      const authKey =
        typeof item.auth_key === "string"
          ? item.auth_key.trim()
          : typeof item.auth === "string"
            ? item.auth.trim()
            : "";

      if (!shohibulId || !endpoint || !p256dhKey || !authKey) {
        continue;
      }

      normalized.push({
        id: typeof item.id === "string" ? item.id : undefined,
        shohibul_id: shohibulId,
        endpoint,
        p256dh_key: p256dhKey,
        auth_key: authKey,
      });
    }

    return normalized;
  }

  return [] as NormalizedSubscription[];
}

export async function sendPushToTargets(
  targets: Array<{ shohibulId: string; portalUrl: string }>,
  payload: { title: string; message: string }
) {
  console.log("[PUSH] Starting push notification...", {
    targetsCount: targets.length,
    title: payload.title,
    message: payload.message,
  });

  configureWebPush();

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  console.log("[PUSH] VAPID config check:", {
    hasPublicKey: !!publicKey,
    hasPrivateKey: !!privateKey,
    publicKeyPrefix: publicKey?.substring(0, 20),
  });

  if (!publicKey || !privateKey || targets.length === 0) {
    console.log("[PUSH] Early return - missing keys or no targets");
    return { sent: 0, skipped: targets.length };
  }

  const targetById = new Map(targets.map((item) => [item.shohibulId, item.portalUrl]));
  const targetIds = Array.from(targetById.keys());

  const supabase = getSupabaseServerClient();
  const pushTable = await resolveTableName(supabase, "push_subscriptions");
  if (!pushTable) {
    console.log("[PUSH] No push_subscriptions table found");
    return { sent: 0, skipped: targets.length };
  }

  console.log("[PUSH] Loading subscriptions for targetIds:", targetIds);
  const subscriptions = await loadSubscriptionsFromPushTable(supabase, pushTable, targetIds);

  console.log("[PUSH] Found subscriptions:", subscriptions.length);

  if (!subscriptions.length) {
    console.log("[PUSH] No active subscriptions found for targets");
    return { sent: 0, skipped: targets.length };
  }

  console.log("[PUSH] Subscriptions details:", subscriptions.map(s => ({
    id: s.id,
    shohibul_id: s.shohibul_id,
    endpoint: s.endpoint.substring(0, 50) + "...",
  })));

  const results = await Promise.allSettled(
    subscriptions.map((item) => {
      const portalUrl = targetById.get(item.shohibul_id) ?? "/";
      const body = JSON.stringify({
        title: payload.title,
        message: payload.message,
        portal_url: portalUrl,
      });

      return webPush.sendNotification(
        {
          endpoint: item.endpoint,
          keys: {
            p256dh: item.p256dh_key,
            auth: item.auth_key,
          },
        },
        body,
        { TTL: 60 } // TTL wajib, 60 detik (bisa diubah sesuai kebutuhan)
      );
    })
  );

  console.log("[PUSH] Send results:", results.map((r, i) => ({
    index: i,
    status: r.status,
    reason: r.status === "rejected" ? (r.reason as any)?.statusCode || r.reason : null,
  })));

  if (pushTable) {
    const invalidIds = results
      .map((result, index) => ({ result, id: subscriptions[index]?.id }))
      .filter(({ result, id }) => {
        if (!id || result.status !== "rejected") return false;
        const statusCode = (result.reason as { statusCode?: unknown })?.statusCode;
        return statusCode === 404 || statusCode === 410;
      })
      .map((item) => item.id as string);

    if (invalidIds.length > 0) {
      console.log("[PUSH] Deactivating invalid subscriptions:", invalidIds);
      await Promise.allSettled(
        invalidIds.map((id) =>
          supabase
            .from(pushTable)
            .update({ is_active: false })
            .eq("id", id)
        )
      );
    }
  }

  const sent = results.filter((item) => item.status === "fulfilled").length;
  console.log("[PUSH] Final result:", { sent, skipped: subscriptions.length - sent });
  return { sent, skipped: subscriptions.length - sent };
}
