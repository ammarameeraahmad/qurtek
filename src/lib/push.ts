import webPush from "web-push";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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

  const supabase = getSupabaseServerClient();
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, shohibul_id, endpoint, p256dh_key, auth_key")
    .in("shohibul_id", Array.from(targetById.keys()))
    .eq("is_active", true);

  if (error || !subscriptions?.length) {
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

  const sent = results.filter((item) => item.status === "fulfilled").length;
  return { sent, skipped: subscriptions.length - sent };
}
