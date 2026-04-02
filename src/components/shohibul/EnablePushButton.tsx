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

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("VAPID public key belum diisi di environment variable.");
      }

      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("Browser tidak mendukung Web Push Notification.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Izin notifikasi ditolak.");
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const res = await fetch(`/api/portal/${token}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal aktivasi notifikasi.");
      }

      setStatus("Notifikasi aktif. Anda akan menerima update otomatis.");
    } catch (error) {
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
