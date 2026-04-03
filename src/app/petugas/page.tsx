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
  dokumentasi: Array<{
    id: string;
    tahap: string;
    tipe_media: "foto" | "video";
    media_public_url: string;
    uploaded_at: string | null;
  }>;
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

function guessRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) return "video/webm;codecs=vp9";
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) return "video/webm;codecs=vp8";
  if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
  return "";
}

export default function PetugasPage() {
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);

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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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
  }, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("hewanId", item.hewanId);
    formData.append("petugasId", item.petugasId);
    formData.append("tahap", item.tahap);
    formData.append("tipeMedia", item.tipeMedia);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/petugas/upload");

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onProgress) return;
        const percent = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)));
        onProgress(percent);
      };

      xhr.onerror = () => {
        reject(new Error("Koneksi upload terputus. Coba lagi."));
      };

      xhr.onload = () => {
        let json: { error?: string } = {};

        try {
          json = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          json = {};
        }

        if (xhr.status === 401) {
          localStorage.removeItem(SESSION_KEY);
          setSession(null);
          reject(new Error("Sesi petugas berakhir. Silakan login ulang."));
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(json.error || `Upload gagal (${xhr.status}).`));
          return;
        }

        if (onProgress) onProgress(100);
        resolve();
      };

      xhr.send(formData);
    });
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

  async function postTahapDone(hewanId: string, tahap: string) {
    const res = await fetch("/api/petugas/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hewanId,
        tahap,
      }),
    });

    const json = await res.json();
    if (res.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
      throw new Error("Sesi petugas berakhir. Silakan login ulang.");
    }
    if (!res.ok) throw new Error(json.error || "Gagal update status tahap.");
  }

  async function submitUpload(markDoneAfterUpload: boolean) {
    if (!session || !hewanDetail || !file) return;

    setLoading(true);
    setError("");
    setSuccess("");
    setUploadProgress(null);

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
        setFile(null);
        setSuccess(
          markDoneAfterUpload
            ? "Offline mode aktif. File masuk antrian upload, tahap bisa diselesaikan setelah online."
            : "Offline mode aktif. File masuk antrian upload."
        );
        setUploadProgress(null);
        return;
      }

      setUploadProgress(0);

      await uploadNow({
        hewanId: hewanDetail.hewan.id,
        petugasId: session.id,
        tahap: selectedTahap,
        tipeMedia,
        file: processedFile,
      }, (progressValue) => {
        setUploadProgress(progressValue);
      });

      if (markDoneAfterUpload) {
        await postTahapDone(hewanDetail.hewan.id, selectedTahap);
      }

      setFile(null);
      await loadHewanByKode();
      setSuccess(
        markDoneAfterUpload
          ? `Upload berhasil dan tahap ${LABEL_TAHAP[selectedTahap as keyof typeof LABEL_TAHAP]} diselesaikan.`
          : "Upload media berhasil."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal.");
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitUpload(false);
  }

  async function markTahapDone() {
    if (!session || !hewanDetail) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await postTahapDone(hewanDetail.hewan.id, selectedTahap);
      await loadHewanByKode();
      setSuccess(`Tahap ${LABEL_TAHAP[selectedTahap as keyof typeof LABEL_TAHAP]} selesai.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update status.");
    } finally {
      setLoading(false);
    }
  }

  function stopCameraStream() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }

    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  }

  async function capturePhotoFromCamera() {
    if (isRecording) {
      setError("Hentikan rekaman video terlebih dahulu.");
      return;
    }

    const stream = cameraStreamRef.current;
    const video = cameraVideoRef.current;
    if (!stream || !video) {
      setError("Kamera belum aktif.");
      return;
    }

    const canvas = cameraCanvasRef.current ?? document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Gagal mengambil frame kamera.");
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );

    if (!blob) {
      setError("Gagal membuat file foto.");
      return;
    }

    const capturedFile = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
    setTipeMedia("foto");
    setFile(capturedFile);
    setSuccess("Foto dari kamera siap diupload.");
  }

  function startVideoRecording() {
    const stream = cameraStreamRef.current;
    if (!stream) {
      setError("Aktifkan kamera terlebih dahulu.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("Browser ini belum mendukung rekam video langsung.");
      return;
    }

    try {
      mediaChunksRef.current = [];

      const mimeType = guessRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const chunks = mediaChunksRef.current;
        mediaChunksRef.current = [];
        setIsRecording(false);
        setRecordingSeconds(0);

        if (!chunks.length) {
          setError("Rekaman video kosong.");
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        const recordedFile = new File([blob], `video-${Date.now()}.${ext}`, {
          type: blob.type || "video/webm",
        });

        setTipeMedia("video");
        setFile(recordedFile);
        setSuccess("Video dari kamera siap diupload.");
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setIsRecording(true);
      setSuccess("Rekam video dimulai.");
    } catch {
      setError("Gagal memulai rekaman video.");
    }
  }

  function stopVideoRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
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

  useEffect(() => {
    if (!cameraOpen) {
      stopCameraStream();
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Browser tidak mendukung akses kamera.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          await cameraVideoRef.current.play().catch(() => undefined);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Kamera gagal diaktifkan.";
        setError(message);
        setCameraOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [cameraOpen, cameraFacingMode]);

  useEffect(() => {
    if (!isRecording) return;

    const timer = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isRecording]);

  async function logout() {
    stopVideoRecording();
    setCameraOpen(false);
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

                  <div className="mt-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-white/85">Media Terbaru</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {hewanDetail.dokumentasi.length === 0 && (
                        <p className="col-span-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/70">
                          Belum ada media yang terbaca untuk hewan ini.
                        </p>
                      )}
                      {hewanDetail.dokumentasi.slice(0, 6).map((item) => (
                        <div key={item.id} className="overflow-hidden rounded-lg border border-white/20 bg-white/10">
                          {item.tipe_media === "video" ? (
                            <video
                              src={item.media_public_url}
                              controls
                              preload="metadata"
                              className="h-28 w-full object-cover"
                            />
                          ) : (
                            <img
                              src={item.media_public_url}
                              alt={item.tahap}
                              loading="lazy"
                              className="h-28 w-full object-cover"
                            />
                          )}
                          <p className="px-2 py-1 text-[11px] text-white/80">
                            {LABEL_TAHAP[item.tahap as keyof typeof LABEL_TAHAP] ?? item.tahap}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                <article className="panel panel-petugas p-5">
                  <h2 className="text-2xl font-semibold">Upload Dokumentasi</h2>
                  <div className="mt-4 rounded-xl border border-white/20 bg-white/5 p-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setSuccess("");
                          if (!cameraOpen) {
                            setScanActive(false);
                          } else if (isRecording) {
                            stopVideoRecording();
                          }
                          setCameraOpen((prev) => !prev);
                        }}
                        className="rounded-lg border border-white/30 px-3 py-1.5 font-semibold"
                      >
                        {cameraOpen ? "Tutup Kamera Website" : "Buka Kamera Website"}
                      </button>
                      {cameraOpen && (
                        <button
                          type="button"
                          onClick={() =>
                            setCameraFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
                          }
                          className="rounded-lg border border-white/30 px-3 py-1.5 font-semibold"
                        >
                          Ganti Kamera
                        </button>
                      )}
                    </div>

                    {cameraOpen && (
                      <div className="mt-3 space-y-3">
                        <video
                          ref={cameraVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="aspect-video w-full rounded-lg bg-black object-cover"
                        />
                        <canvas ref={cameraCanvasRef} className="hidden" />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={capturePhotoFromCamera}
                            disabled={loading || isRecording}
                            className="rounded-lg bg-[#f0c03d] px-3 py-2 font-semibold text-[#0b2140] disabled:opacity-70"
                          >
                            📸 Ambil Foto
                          </button>
                          {!isRecording ? (
                            <button
                              type="button"
                              onClick={startVideoRecording}
                              disabled={loading}
                              className="rounded-lg border border-white/30 px-3 py-2 font-semibold disabled:opacity-70"
                            >
                              ⏺️ Rekam Video
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={stopVideoRecording}
                              className="rounded-lg border border-[#f0c03d] bg-[#f0c03d]/10 px-3 py-2 font-semibold text-[#f0c03d]"
                            >
                              ⏹️ Stop Rekam ({recordingSeconds} dtk)
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-white/75">
                          Hasil foto/video kamera otomatis masuk ke file siap upload di bawah.
                        </p>
                      </div>
                    )}
                  </div>

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
                      accept={tipeMedia === "foto" ? "image/*" : "video/*"}
                      capture="environment"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="rounded-lg border border-white/25 bg-white/10 px-3 py-2"
                      required
                    />
                    {file && (
                      <p className="text-xs text-white/75">
                        Siap upload: {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
                      </p>
                    )}
                    {uploadProgress !== null && (
                      <div className="rounded-lg border border-white/25 bg-white/5 p-2">
                        <div className="flex items-center justify-between text-xs text-white/80">
                          <span>Mengunggah media...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/20">
                          <div
                            className="h-full rounded-full bg-[#f0c03d] transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="rounded-xl bg-[#f0c03d] px-4 py-2 font-semibold text-[#0b2140] disabled:opacity-70"
                      >
                        {uploadProgress !== null ? `Uploading... ${uploadProgress}%` : "Upload Media"}
                      </button>
                      <button
                        type="button"
                        onClick={() => submitUpload(true)}
                        disabled={loading || !file}
                        className="rounded-xl border border-white/30 px-4 py-2 font-semibold disabled:opacity-70"
                      >
                        Upload + Selesai Tahap
                      </button>
                    </div>
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
