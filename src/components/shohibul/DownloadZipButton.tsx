"use client";

import { useState } from "react";

type MediaItem = {
  id: string;
  tahap: string;
  tipe_media: "foto" | "video";
  media_public_url: string;
};

function extensionFromMedia(item: MediaItem) {
  if (item.tipe_media === "foto") return "jpg";
  return "mp4";
}

export default function DownloadZipButton({ items }: { items: MediaItem[] }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function downloadZip() {
    try {
      setLoading(true);
      setMessage("");

      if (!items.length) {
        setMessage("Belum ada dokumentasi untuk di-download.");
        return;
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const response = await fetch(item.media_public_url);
        if (!response.ok) continue;

        const blob = await response.blob();
        const fileName = `${String(i + 1).padStart(2, "0")}-${item.tahap}.${extensionFromMedia(item)}`;
        zip.file(fileName, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "dokumentasi-qurban.zip";
      anchor.click();
      URL.revokeObjectURL(url);

      setMessage("ZIP berhasil diunduh.");
    } catch {
      setMessage("Gagal membuat ZIP dokumentasi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={downloadZip}
        disabled={loading}
        className="rounded-xl border border-[#2f8f56] px-4 py-2 text-sm font-semibold text-[#1f6b41] disabled:opacity-70"
      >
        {loading ? "Menyiapkan ZIP..." : "Download Semua (ZIP)"}
      </button>
      {message && <p className="text-xs text-[#2f6a4a]">{message}</p>}
    </div>
  );
}
