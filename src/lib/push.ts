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

  if (!publicKey || !privateKey) {
    return;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  isConfigured = true;
}

function normalizeInlineSubscription(raw: unknown, shohibulId: string): NormalizedSubscription | null {
  let value = raw;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") return null;

  const objectValue = value as Record<string, unknown>;
  const keysValue =
    objectValue.keys && typeof objectValue.keys === "object"
      ? (objectValue.keys as Record<string, unknown>)
      : {};

  const endpoint = typeof objectValue.endpoint === "string" ? objectValue.endpoint : "";
  const p256dh =
    typeof keysValue.p256dh === "string"
      ? keysValue.p256dh
      : typeof objectValue.p256dh_key === "string"
        ? objectValue.p256dh_key
        : "";
  const auth =
    typeof keysValue.auth === "string"
      ? keysValue.auth
      : typeof objectValue.auth_key === "string"
        ? objectValue.auth_key
        : "";

  if (!endpoint || !p256dh || !auth) return null;

  return {
    shohibul_id: shohibulId,
    endpoint,
    p256dh_key: p256dh,
    auth_key: auth,
  };
}

async function loadSubscriptionsFromShohibul(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  shohibulIds: string[]
) {
  const shohibulTable = await resolveTableName(supabase, "shohibul");
  if (!shohibulTable || shohibulIds.length === 0) return [] as NormalizedSubscription[];

  const selectCandidates = [
    "id,push_subscription,subscription",
    "id,push_subscription",
    "id,subscription",
  ];

  for (const selectClause of selectCandidates) {
    const { data, error } = await supabase
      .from(shohibulTable)
      .select(selectClause)
      .in("id", shohibulIds);

    if (error) {
      if (isMissingColumnError(error)) continue;
      return [];
    }

    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

    return rows.flatMap((row) => {
      if (typeof row.id !== "string") return [];

      const fromPushSubscription = normalizeInlineSubscription(row.push_subscription, row.id);
      if (fromPushSubscription) return [fromPushSubscription];

      const fromSubscription = normalizeInlineSubscription(row.subscription, row.id);
      if (fromSubscription) return [fromSubscription];

      return [];
    });
  }

  return [] as NormalizedSubscription[];
}

export async function sendPushToTargets(
  targets: Array<{ shohibulId: string; portalUrl: string }>,
  payload: { title: string; message: string }
) {
  configureWebPush();

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey || targets.length === 0) {
    return { sent: 0, skipped: targets.length };
  }

  const targetById = new Map(targets.map((item) => [item.shohibulId, item.portalUrl]));
  const targetIds = Array.from(targetById.keys());

  const supabase = getSupabaseServerClient();
  const pushTable = await resolveTableName(supabase, "push_subscriptions");
  let subscriptions: NormalizedSubscription[] = [];

  if (pushTable) {
    const { data, error } = await supabase
      .from(pushTable)
      .select("id, shohibul_id, endpoint, p256dh_key, auth_key")
      .in("shohibul_id", targetIds)
      .eq("is_active", true);

    if (!error && data?.length) {
      subscriptions = (data ?? [])
        .filter((item) =>
          typeof item.shohibul_id === "string" &&
          typeof item.endpoint === "string" &&
          typeof item.p256dh_key === "string" &&
          typeof item.auth_key === "string"
        )
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : undefined,
          shohibul_id: item.shohibul_id,
          endpoint: item.endpoint,
          p256dh_key: item.p256dh_key,
          auth_key: item.auth_key,
        }));
    }
  }

  if (!subscriptions.length) {
    subscriptions = await loadSubscriptionsFromShohibul(supabase, targetIds);
  }

  if (!subscriptions.length) {
    return { sent: 0, skipped: targets.length };
  }

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
        body
      );
    })
  );

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
  return { sent, skipped: subscriptions.length - sent };
}
