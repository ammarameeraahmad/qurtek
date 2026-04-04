"use client";

import { useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function EnablePushButton({ token }: { token: string }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function enableNotification() {
    try {
      setBusy(true);
      setStatus("");

      console.log("[ENABLE_PUSH] Starting notification enable process...");

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      console.log("[ENABLE_PUSH] VAPID public key:", vapidPublicKey ? `${vapidPublicKey.substring(0, 20)}...` : "MISSING");
      
      if (!vapidPublicKey) {
        throw new Error("VAPID public key belum diisi di environment variable.");
      }

      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("Browser tidak mendukung Web Push Notification.");
      }

      console.log("[ENABLE_PUSH] Requesting notification permission...");
      const permission = await Notification.requestPermission();
      console.log("[ENABLE_PUSH] Permission result:", permission);
      
      if (permission !== "granted") {
        throw new Error("Izin notifikasi ditolak.");
      }

      console.log("[ENABLE_PUSH] Getting service worker registration...");
      const registration = await navigator.serviceWorker.ready;
      console.log("[ENABLE_PUSH] Service worker ready:", registration.scope);
      
      let subscription = await registration.pushManager.getSubscription();
      console.log("[ENABLE_PUSH] Existing subscription:", subscription ? "found" : "not found");

      if (!subscription) {
        console.log("[ENABLE_PUSH] Creating new subscription with VAPID key...");
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        console.log("[ENABLE_PUSH] New subscription created");
      }

      console.log("[ENABLE_PUSH] Sending subscription to server...");
      const res = await fetch(`/api/portal/${token}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      console.log("[ENABLE_PUSH] Server response status:", res.status);
      const json = await res.json();
      console.log("[ENABLE_PUSH] Server response:", json);
      
      if (!res.ok) {
        throw new Error(json.error || "Gagal aktivasi notifikasi.");
      }

      console.log("[ENABLE_PUSH] Notification enabled successfully!");
      setStatus("Notifikasi aktif. Anda akan menerima update otomatis.");
    } catch (error) {
      console.error("[ENABLE_PUSH] Error:", error);
      setStatus(error instanceof Error ? error.message : "Gagal aktivasi notifikasi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={enableNotification}
        disabled={busy}
        className="rounded-xl bg-[#2f8f56] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
      >
        {busy ? "Memproses..." : "Izinkan Notifikasi"}
      </button>
      <p className="text-xs text-[#2f6a4a]">Klik sekali untuk mengaktifkan Web Push Notification.</p>
      {status && <p className="text-xs text-[#2f6a4a]">{status}</p>}
    </div>
  );
}
