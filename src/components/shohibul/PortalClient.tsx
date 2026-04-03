"use client";

import { useEffect, useMemo, useState } from "react";
import EnablePushButton from "@/components/shohibul/EnablePushButton";
import DownloadZipButton from "@/components/shohibul/DownloadZipButton";

type PortalResponse = {
  shohibul: {
    nama: string;
    tipe: string;
    unique_token: string;
  };
  kelompok: {
    nama: string;
  } | null;
  hewan: {
    kode: string;
    jenis: "sapi" | "kambing";
    status: string;
  } | null;
  timeline: Array<{
    tahap: string;
    label: string;
    status: "done" | "pending";
    waktu: string | null;
    media: number;
  }>;
  dokumentasi: Array<{
    id: string;
    tahap: string;
    tipe_media: "foto" | "video";
    media_public_url: string;
  }>;
};

function formatTime(value: string | null) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(raw: string) {
  if (raw === "registered") return "Terdaftar";
  if (raw === "ready") return "Siap";
  if (raw === "slaughtering") return "Disembelih";
  if (raw === "processing") return "Diproses";
  if (raw === "distributing") return "Distribusi";
  if (raw === "done") return "Selesai";
  return raw;
}

export default function PortalClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<PortalResponse | null>(null);

  const mediaSummary = useMemo(() => {
    if (!data) return { foto: 0, video: 0 };
    let foto = 0;
    let video = 0;
    for (const item of data.dokumentasi) {
      if (item.tipe_media === "foto") foto += 1;
      if (item.tipe_media === "video") video += 1;
    }
    return { foto, video };
  }, [data]);

  async function loadPortal() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/portal/${token}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat portal.");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal tidak dapat dimuat.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPortal();

    const sse = new EventSource(`/api/portal/${token}/stream`);
    sse.onmessage = () => {
      loadPortal();
    };

    sse.onerror = () => {
      sse.close();
    };

    const timer = setInterval(loadPortal, 30000);

    return () => {
      sse.close();
      clearInterval(timer);
    };
  }, [token]);

  return (
    <main className="role-shohibul min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="panel panel-shohibul mb-5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f8f56]">QURTEK PORTAL</p>
          <h1 className="mt-2 text-4xl font-bold text-[#143223]">Dokumentasi Qurban Pribadi</h1>
          <p className="mt-2 text-sm text-[#365848]">Update real-time dokumentasi hewan qurban Anda.</p>
        </header>

        {loading && <p className="panel panel-shohibul p-4 text-sm text-[#365848]">Memuat data portal...</p>}
        {error && <p className="panel panel-shohibul p-4 text-sm text-[#b42318]">{error}</p>}

        {data && (
          <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
            <section className="space-y-5">
              <article className="panel panel-shohibul p-5">
                <p className="text-sm text-[#365848]">Assalamu&apos;alaikum,</p>
                <h2 className="mt-1 text-2xl font-bold">{data.shohibul.nama}</h2>

                <div className="mt-4 rounded-xl border border-[#dbe9de] bg-[#f8fcf9] p-4 text-sm text-[#143223]">
                  <p>
                    <strong>{data.hewan?.jenis.toUpperCase() || "-"}</strong> • {data.kelompok?.nama || "Belum ada kelompok"}
                  </p>
                  <p className="mt-1">Bagian: {data.shohibul.tipe}</p>
                  <p className="mt-1">Kode Hewan: {data.hewan?.kode || "-"}</p>
                  <p className="mt-1">
                    Status: <strong>{statusLabel(data.hewan?.status || "-")}</strong>
                  </p>
                </div>
              </article>

              <article className="panel panel-shohibul p-5">
                <h3 className="text-xl font-semibold">Tracking Status</h3>
                <div className="mt-4 space-y-2">
                  {data.timeline.map((item) => (
                    <div
                      key={item.tahap}
                      className="flex items-center justify-between rounded-lg border border-[#dbe9de] bg-white px-3 py-2 text-sm"
                    >
                      <p className="flex items-center gap-2">
                        <span>{item.status === "done" ? "✅" : "⬜"}</span>
                        <span>{item.label}</span>
                      </p>
                      <p className="text-[#365848]">
                        {formatTime(item.waktu)} • 📸 {item.media}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="space-y-5">
              <article className="panel panel-shohibul p-5">
                <h3 className="text-xl font-semibold">Notifikasi & Download</h3>
                <p className="mt-2 text-sm text-[#365848]">
                  Foto: {mediaSummary.foto} • Video: {mediaSummary.video}
                </p>
                <div className="mt-4 grid gap-3">
                  <EnablePushButton token={token} />
                  <DownloadZipButton items={data.dokumentasi} />
                </div>
              </article>

              <article className="panel panel-shohibul p-5">
                <h3 className="text-xl font-semibold">Galeri Dokumentasi</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {data.dokumentasi.length === 0 && (
                    <p className="col-span-2 rounded-lg border border-[#dbe9de] bg-white p-3 text-sm text-[#365848]">
                      Dokumentasi belum tersedia.
                    </p>
                  )}
                  {data.dokumentasi.map((item) => (
                    <div key={item.id} className="overflow-hidden rounded-xl border border-[#dbe9de] bg-white">
                      {item.tipe_media === "foto" ? (
                        <img src={item.media_public_url} alt={item.tahap} className="h-36 w-full object-cover" />
                      ) : (
                        <video src={item.media_public_url} controls className="h-36 w-full object-cover" />
                      )}
                      <p className="px-2 py-1 text-xs text-[#365848]">{item.tahap}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
