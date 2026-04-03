"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LABEL_TAHAP, TAHAP_URUTAN } from "@/lib/stages";

type PetugasSession = {
  id: string;
  nama: string;
  area: string | null;
};

type HewanDetail = {
  hewan: {
    id: string;
    kode: string;
    jenis: "sapi" | "kambing";
    warna: string | null;
    berat_est: number | null;
    status: string;
  };
  kelompok: { id: string; nama: string } | null;
  shohibul: Array<{ id: string; nama: string }>;
  checklist: Array<{ tahap: string; selesai: boolean; media: number }>;
};

type QueueItem = {
  hewanId: string;
  petugasId: string;
  tahap: string;
  tipeMedia: string;
  fileName: string;
  fileType: string;
  dataUrl: string;
};

const SESSION_KEY = "qurtek_petugas_session";
const QUEUE_KEY = "qurtek_offline_upload_queue";

function extractKode(raw: string) {
  const cleaned = raw.trim();
  if (!cleaned) return "";
  if (cleaned.includes("/")) {
    const parts = cleaned.split("/").filter(Boolean);
    return (parts.at(-1) || "").trim().toUpperCase();
  }
  return cleaned.toUpperCase();
}

function dataUrlToFile(dataUrl: string, fileName: string, fileType: string) {
  const [header, data] = dataUrl.split(",");
  if (!header || !data) throw new Error("Invalid data URL");
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) array[i] = binary.charCodeAt(i);
  return new File([array], fileName, { type: fileType });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

async function compressAndWatermarkImage(file: File, kode: string, tahap: string) {
  if (!file.type.startsWith("image/")) return file;

  const img = new Image();
  const objectUrl = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Gagal memproses gambar."));
    img.src = objectUrl;
  });

  const maxWidth = 1280;
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    return file;
  }

  ctx.drawImage(img, 0, 0, width, height);

  const stamp = new Date().toLocaleString("id-ID", { hour12: false });
  const lines = [
    `${kode} | ${LABEL_TAHAP[tahap as keyof typeof LABEL_TAHAP] ?? tahap}`,
    `${stamp} WIB`,
    "Universitas Gadjah Mada",
  ];

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  const blockHeight = 74;
  ctx.fillRect(16, height - blockHeight - 16, 350, blockHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px sans-serif";
  lines.forEach((line, index) => {
    ctx.fillText(line, 28, height - blockHeight + 8 + index * 22);
  });

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82)
  );

  URL.revokeObjectURL(objectUrl);

  if (!blob) return file;
  return new File([blob], `${file.name.replace(/\.[^/.]+$/, "")}.jpg`, {
    type: "image/jpeg",
  });
}

export default function PetugasPage() {
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  const [pin, setPin] = useState("");
  const [session, setSession] = useState<PetugasSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [kodeInput, setKodeInput] = useState("");
  const [scanActive, setScanActive] = useState(false);
  const [hewanDetail, setHewanDetail] = useState<HewanDetail | null>(null);
  const [selectedTahap, setSelectedTahap] = useState<string>(TAHAP_URUTAN[0]);
  const [tipeMedia, setTipeMedia] = useState("foto");
  const [file, setFile] = useState<File | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);

  const progress = useMemo(() => {
    if (!hewanDetail) return { selesai: 0, total: 7, percent: 0 };
    const selesai = hewanDetail.checklist.filter((item) => item.selesai).length;
    const total = hewanDetail.checklist.length || 7;
    return { selesai, total, percent: Math.round((selesai / total) * 100) };
  }, [hewanDetail]);

  function readQueue(): QueueItem[] {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writeQueue(queue: QueueItem[]) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    setQueueCount(queue.length);
  }

  async function uploadNow(item: {
    hewanId: string;
    petugasId: string;
    tahap: string;
    tipeMedia: string;
    file: File;
  }) {
    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("hewanId", item.hewanId);
    formData.append("petugasId", item.petugasId);
    formData.append("tahap", item.tahap);
    formData.append("tipeMedia", item.tipeMedia);

    const res = await fetch("/api/petugas/upload", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (res.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
      throw new Error("Sesi petugas berakhir. Silakan login ulang.");
    }
    if (!res.ok) throw new Error(json.error || "Upload gagal.");
  }

  async function flushOfflineQueue() {
    if (!session || !navigator.onLine) return;

    const queue = readQueue();
    if (!queue.length) return;

    const remaining: QueueItem[] = [];

    for (const item of queue) {
      try {
        const restoredFile = dataUrlToFile(item.dataUrl, item.fileName, item.fileType);
        await uploadNow({
          hewanId: item.hewanId,
          petugasId: item.petugasId,
          tahap: item.tahap,
          tipeMedia: item.tipeMedia,
          file: restoredFile,
        });
      } catch {
        remaining.push(item);
      }
    }

    writeQueue(remaining);
    if (queue.length !== remaining.length) {
      setSuccess("Sinkronisasi offline selesai.");
    }
  }

  async function loadHewanByKode() {
    if (!kodeInput.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const code = extractKode(kodeInput);
      const res = await fetch(`/api/petugas/hewan/${encodeURIComponent(code)}`, { cache: "no-store" });
      const json = await res.json();
      if (res.status === 401) {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
        throw new Error("Sesi petugas berakhir. Silakan login ulang.");
      }
      if (!res.ok) throw new Error(json.error || "Hewan tidak ditemukan.");

      setHewanDetail(json.data);
      const nextTahap = (json.data.checklist || []).find((item: { selesai: boolean; tahap: string }) => !item.selesai);
      setSelectedTahap(nextTahap?.tahap ?? TAHAP_URUTAN[0]);
      setKodeInput(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail hewan.");
      setHewanDetail(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/petugas/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login gagal.");

      setSession(json.data);
      localStorage.setItem(SESSION_KEY, JSON.stringify(json.data));
      setSuccess("Login petugas berhasil.");
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session || !hewanDetail || !file) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const processedFile = await compressAndWatermarkImage(file, hewanDetail.hewan.kode, selectedTahap);

      if (!isOnline) {
        const queue = readQueue();
        const dataUrl = await fileToDataUrl(processedFile);
        queue.push({
          hewanId: hewanDetail.hewan.id,
          petugasId: session.id,
          tahap: selectedTahap,
          tipeMedia,
          fileName: processedFile.name,
          fileType: processedFile.type,
          dataUrl,
        });
        writeQueue(queue);
        setSuccess("Offline mode aktif. File masuk antrian upload.");
        setFile(null);
        return;
      }

      await uploadNow({
        hewanId: hewanDetail.hewan.id,
        petugasId: session.id,
        tahap: selectedTahap,
        tipeMedia,
        file: processedFile,
      });

      setSuccess("Upload media berhasil.");
      setFile(null);
      await loadHewanByKode();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function markTahapDone() {
    if (!session || !hewanDetail) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/petugas/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hewanId: hewanDetail.hewan.id,
          petugasId: session.id,
          tahap: selectedTahap,
        }),
      });

      const json = await res.json();
      if (res.status === 401) {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
        throw new Error("Sesi petugas berakhir. Silakan login ulang.");
      }
      if (!res.ok) throw new Error(json.error || "Gagal update status tahap.");

      setSuccess(`Tahap ${LABEL_TAHAP[selectedTahap as keyof typeof LABEL_TAHAP]} selesai.`);
      await loadHewanByKode();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    setIsOnline(navigator.onLine);
    setQueueCount(readQueue().length);

    const onOnline = () => {
      setIsOnline(true);
      flushOfflineQueue();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("kode");
    if (fromQuery) {
      setKodeInput(extractKode(fromQuery));
    }
  }, []);

  useEffect(() => {
    if (session && kodeInput && !hewanDetail) {
      loadHewanByKode();
    }
  }, [session, kodeInput]);

  useEffect(() => {
    if (session) {
      flushOfflineQueue();
    }
  }, [session]);

  useEffect(() => {
    if (!scanActive) return;

    let unmounted = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (unmounted) return;

        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => {
            setKodeInput(extractKode(decodedText));
            setScanActive(false);
          },
          () => {
            // No-op for scan failure callback.
          }
        );
      } catch {
        setError("Kamera/QR scanner gagal diaktifkan.");
        setScanActive(false);
      }
    })();

    return () => {
      unmounted = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            scanner.clear();
          });
      }
      scannerRef.current = null;
    };
  }, [scanActive]);

  async function logout() {
    await fetch("/api/petugas/logout", { method: "POST" });
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setHewanDetail(null);
    setSuccess("Logout berhasil.");
  }

  return (
    <main className="role-petugas min-h-screen px-5 py-6 md:px-10 md:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="panel panel-petugas mb-6 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0c03d]">QURTEK PETUGAS</p>
          <h1 className="mt-2 text-4xl font-bold text-white">Scan QR • Jepret • Selesai</h1>
          <p className="mt-2 text-sm text-white/80">
            Mode lapangan untuk dokumentasi tahapan qurban. Fokus hanya pada QR scan, kamera,
            checklist, dan upload.
          </p>
        </header>

        {(error || success) && (
          <div className="mb-6 grid gap-2">
            {error && <p className="rounded-xl bg-[#fef3f2] px-4 py-3 text-sm text-[#b42318]">{error}</p>}
            {success && <p className="rounded-xl bg-[#ecfdf3] px-4 py-3 text-sm text-[#067647]">{success}</p>}
          </div>
        )}

        {!session ? (
          <section className="panel panel-petugas mx-auto max-w-md p-6">
            <h2 className="text-2xl font-semibold">Login PIN Petugas</h2>
            <form onSubmit={handleLogin} className="mt-4 grid gap-3">
              <input
                value={pin}
                maxLength={6}
                minLength={6}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
                className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-white placeholder:text-white/60"
                placeholder="PIN 6 digit"
                required
              />
              <button
                disabled={loading}
                className="rounded-xl bg-[#f0c03d] px-4 py-2 font-semibold text-[#0b2140] disabled:opacity-70"
              >
                Masuk
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="mb-6 panel panel-petugas p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{session.nama}</p>
                  <p className="text-sm text-white/75">Area {session.area || "-"}</p>
                </div>
                <button onClick={logout} className="rounded-lg border border-white/25 px-3 py-1 text-sm font-semibold">
                  Logout
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  value={kodeInput}
                  onChange={(e) => setKodeInput(e.target.value)}
                  placeholder="Input kode hewan / hasil scan QR"
                  className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 placeholder:text-white/60"
                />
                <button
                  onClick={loadHewanByKode}
                  disabled={loading}
                  className="rounded-xl bg-[#f0c03d] px-4 py-2 font-semibold text-[#0b2140] disabled:opacity-70"
                >
                  Muat Hewan
                </button>
                <button
                  onClick={() => setScanActive((prev) => !prev)}
                  className="rounded-xl border border-white/30 px-4 py-2 font-semibold"
                >
                  {scanActive ? "Tutup Scanner" : "Scan QR Kamera"}
                </button>
              </div>

              {scanActive && <div id="qr-reader" className="mt-4 overflow-hidden rounded-xl bg-white p-2 text-black" />}

              <div className="mt-4 grid gap-2 text-sm">
                <p>
                  Koneksi: <strong>{isOnline ? "Online" : "Offline"}</strong>
                </p>
                <p>
                  Antrian offline: <strong>{queueCount} media</strong>
                </p>
              </div>
            </section>

            {hewanDetail && (
              <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <article className="panel panel-petugas p-5">
                  <h2 className="text-2xl font-semibold">
                    {hewanDetail.hewan.kode} • {hewanDetail.hewan.jenis.toUpperCase()}
                  </h2>
                  <p className="mt-1 text-sm text-white/80">
                    {hewanDetail.kelompok?.nama || "Belum ada kelompok"} • {hewanDetail.shohibul.length} shohibul
                  </p>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-[#f0c03d]"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/80">
                    Progress: {progress.selesai}/{progress.total} ({progress.percent}%)
                  </p>

                  <div className="mt-4 space-y-2">
                    {hewanDetail.checklist.map((item) => (
                      <div
                        key={item.tahap}
                        className="flex items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-2"
                      >
                        <p className="text-sm">
                          {item.selesai ? "✅" : "⬜"} {LABEL_TAHAP[item.tahap as keyof typeof LABEL_TAHAP]}
                        </p>
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">📸 {item.media}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="panel panel-petugas p-5">
                  <h2 className="text-2xl font-semibold">Upload Dokumentasi</h2>
                  <form onSubmit={handleUpload} className="mt-4 grid gap-3 text-sm">
                    <select
                      value={selectedTahap}
                      onChange={(e) => setSelectedTahap(e.target.value)}
                      className="rounded-lg border border-white/25 bg-white/10 px-3 py-2"
                    >
                      {TAHAP_URUTAN.map((tahap) => (
                        <option key={tahap} value={tahap} className="text-black">
                          {LABEL_TAHAP[tahap]}
                        </option>
                      ))}
                    </select>
                    <select
                      value={tipeMedia}
                      onChange={(e) => setTipeMedia(e.target.value)}
                      className="rounded-lg border border-white/25 bg-white/10 px-3 py-2"
                    >
                      <option value="foto" className="text-black">
                        Foto
                      </option>
                      <option value="video" className="text-black">
                        Video
                      </option>
                    </select>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="rounded-lg border border-white/25 bg-white/10 px-3 py-2"
                      required
                    />
                    <button
                      disabled={loading}
                      className="rounded-xl bg-[#f0c03d] px-4 py-2 font-semibold text-[#0b2140] disabled:opacity-70"
                    >
                      Upload Media
                    </button>
                  </form>

                  <button
                    onClick={markTahapDone}
                    disabled={loading}
                    className="mt-4 w-full rounded-xl border border-white/30 px-4 py-2 font-semibold"
                  >
                    ✅ Selesai Tahap Ini
                  </button>
                </article>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
