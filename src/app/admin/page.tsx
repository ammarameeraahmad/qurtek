"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type DashboardMetrics = {
  sapi: number;
  kambing: number;
  shohibul: number;
  totalHewan: number;
  dokumentasiLengkap: number;
  dokumentasiBelum: number;
  pushSubscribed: number;
  petugasOnline: number;
};

type ShohibulRow = {
  id: string;
  nama: string;
  no_whatsapp: string;
  jenis_qurban: "sapi" | "kambing";
  tipe: string;
  unique_token: string;
};

type HewanRow = {
  id: string;
  kode: string;
  jenis: "sapi" | "kambing";
  warna: string | null;
  berat_est: number | null;
  status: string;
};

type PetugasRow = {
  id: string;
  nama: string;
  no_hp: string | null;
  area: string | null;
  pin: string;
  is_active: boolean;
};

type DistribusiRow = {
  id: string;
  hewan_id: string;
  shohibul_id: string;
  berat_kg: number | null;
  diterima_at: string | null;
};

const initialMetrics: DashboardMetrics = {
  sapi: 0,
  kambing: 0,
  shohibul: 0,
  totalHewan: 0,
  dokumentasiLengkap: 0,
  dokumentasiBelum: 0,
  pushSubscribed: 0,
  petugasOnline: 0,
};

function slugifyWhatsapp(raw: string) {
  return raw.replace(/[^0-9+]/g, "");
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authForm, setAuthForm] = useState({ username: "", password: "" });

  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);
  const [shohibulRows, setShohibulRows] = useState<ShohibulRow[]>([]);
  const [hewanRows, setHewanRows] = useState<HewanRow[]>([]);
  const [petugasRows, setPetugasRows] = useState<PetugasRow[]>([]);
  const [distribusiRows, setDistribusiRows] = useState<DistribusiRow[]>([]);

  const [shohibulForm, setShohibulForm] = useState({
    nama: "",
    no_whatsapp: "",
    jenis_qurban: "sapi",
    tipe: "1/7",
    kelompok_nama: "",
  });

  const [hewanForm, setHewanForm] = useState({
    kode: "",
    jenis: "sapi",
    warna: "",
    berat_est: "",
    kelompok_nama: "",
  });

  const [petugasForm, setPetugasForm] = useState({
    nama: "",
    no_hp: "",
    area: "",
    pin: "",
  });

  const [distribusiForm, setDistribusiForm] = useState({
    hewan_id: "",
    shohibul_id: "",
    berat_kg: "",
  });

  const [qrPreview, setQrPreview] = useState<{ kode: string; dataUrl: string } | null>(null);
  const [origin, setOrigin] = useState("");

  const progressText = useMemo(() => {
    if (!metrics.totalHewan) return "0%";
    return `${Math.round((metrics.dokumentasiLengkap / metrics.totalHewan) * 100)}%`;
  }, [metrics]);

  async function loadAll() {
    try {
      setLoading(true);
      setError("");

      const [dashboardRes, shohibulRes, hewanRes, petugasRes, distribusiRes] = await Promise.all([
        fetch("/api/admin/dashboard", { cache: "no-store" }),
        fetch("/api/admin/shohibul", { cache: "no-store" }),
        fetch("/api/admin/hewan", { cache: "no-store" }),
        fetch("/api/admin/petugas", { cache: "no-store" }),
        fetch("/api/admin/distribusi", { cache: "no-store" }),
      ]);

      const [dashboardJson, shohibulJson, hewanJson, petugasJson, distribusiJson] = await Promise.all([
        dashboardRes.json(),
        shohibulRes.json(),
        hewanRes.json(),
        petugasRes.json(),
        distribusiRes.json(),
      ]);

      if (!dashboardRes.ok) throw new Error(dashboardJson.error || "Gagal memuat dashboard.");
      if (!shohibulRes.ok) throw new Error(shohibulJson.error || "Gagal memuat data shohibul.");
      if (!hewanRes.ok) throw new Error(hewanJson.error || "Gagal memuat data hewan.");
      if (!petugasRes.ok) throw new Error(petugasJson.error || "Gagal memuat data petugas.");
      if (!distribusiRes.ok) throw new Error(distribusiJson.error || "Gagal memuat data distribusi.");

      setMetrics(dashboardJson.metrics || initialMetrics);
      setShohibulRows(shohibulJson.data || []);
      setHewanRows(hewanJson.data || []);
      setPetugasRows(petugasJson.data || []);
      setDistribusiRows(distribusiJson.data || []);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes("akses admin ditolak")) {
        setIsAuthed(false);
      }
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);

    (async () => {
      try {
        const res = await fetch("/api/admin/auth/me", { cache: "no-store" });
        if (!res.ok) {
          setIsAuthed(false);
          return;
        }

        setIsAuthed(true);
        await loadAll();
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, []);

  async function handleAdminLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login admin gagal.");

      setIsAuthed(true);
      setAuthForm({ username: "", password: "" });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login admin gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    setIsAuthed(false);
    setMetrics(initialMetrics);
    setShohibulRows([]);
    setHewanRows([]);
    setPetugasRows([]);
    setDistribusiRows([]);
  }

  async function handleCreateShohibul(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/shohibul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...shohibulForm,
          no_whatsapp: slugifyWhatsapp(shohibulForm.no_whatsapp),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambah shohibul.");

      setShohibulForm({ nama: "", no_whatsapp: "", jenis_qurban: "sapi", tipe: "1/7", kelompok_nama: "" });
      setSuccess("Data shohibul berhasil disimpan.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah shohibul.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateHewan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/hewan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...hewanForm,
          berat_est: hewanForm.berat_est ? Number(hewanForm.berat_est) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambah hewan.");

      setHewanForm({ kode: "", jenis: "sapi", warna: "", berat_est: "", kelompok_nama: "" });
      setSuccess("Data hewan berhasil disimpan.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah hewan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePetugas(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/petugas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(petugasForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambah petugas.");

      setPetugasForm({ nama: "", no_hp: "", area: "", pin: "" });
      setSuccess("Data petugas berhasil disimpan.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah petugas.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateDistribusi(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/distribusi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...distribusiForm,
          berat_kg: distribusiForm.berat_kg ? Number(distribusiForm.berat_kg) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan distribusi.");

      setDistribusiForm({ hewan_id: "", shohibul_id: "", berat_kg: "" });
      setSuccess("Data distribusi berhasil disimpan.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan distribusi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExportLaporan() {
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal export laporan.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `laporan-qurtek-${Date.now()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);

      setSuccess("Laporan berhasil diunduh.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal export laporan.");
    }
  }

  async function generateQr(kode: string) {
    setError("");
    const res = await fetch(`/api/qr?text=${encodeURIComponent(kode)}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Gagal generate QR code.");
      return;
    }
    setQrPreview({ kode, dataUrl: json.dataUrl });
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/d/${token}`;
    navigator.clipboard.writeText(link);
    setSuccess("Link unik berhasil disalin.");
  }

  function copyMessage(item: ShohibulRow) {
    const link = `${window.location.origin}/d/${item.unique_token}`;
    const message = `Assalamu'alaikum ${item.nama},\n\nBerikut link dokumentasi qurban Anda:\n${link}\n\nSilakan buka link tersebut untuk melihat proses qurban secara real-time.`;
    navigator.clipboard.writeText(message);
    setSuccess("Template pesan WhatsApp berhasil disalin.");
  }

  async function handleImportCsv(file: File) {
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length <= 1) throw new Error("File CSV kosong atau tidak valid.");

      const rows = lines.slice(1);

      for (const row of rows) {
        const [_, nama, whatsapp, jenis, tipe, kelompok] = row.split(",").map((item) => item.trim());
        if (!nama || !whatsapp) continue;

        await fetch("/api/admin/shohibul", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nama,
            no_whatsapp: slugifyWhatsapp(whatsapp),
            jenis_qurban: (jenis || "sapi").toLowerCase(),
            tipe: tipe || "1/7",
            kelompok_nama: kelompok || null,
          }),
        });
      }

      setSuccess("Import CSV selesai diproses.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal import CSV.");
    } finally {
      setBusy(false);
    }
  }

  if (checkingAuth) {
    return (
      <main className="role-admin min-h-screen p-6">
        <div className="mx-auto max-w-xl panel panel-admin p-6">
          <p className="text-sm text-[#475467]">Memeriksa sesi admin...</p>
        </div>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="role-admin min-h-screen p-6">
        <div className="mx-auto max-w-md panel panel-admin p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b42318]">QURTEK ADMIN LOGIN</p>
          <h1 className="mt-2 text-3xl font-bold text-[#141414]">Masuk Panel Admin</h1>
          <p className="mt-2 text-sm text-[#475467]">Gunakan username dan password admin panitia.</p>

          <form onSubmit={handleAdminLogin} className="mt-5 grid gap-3">
            <input
              required
              placeholder="Username"
              value={authForm.username}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, username: e.target.value }))}
              className="rounded-lg border border-[#d0d5dd] px-3 py-2"
            />
            <input
              required
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
              className="rounded-lg border border-[#d0d5dd] px-3 py-2"
            />
            <button
              disabled={busy}
              className="rounded-lg bg-[#141414] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              Login Admin
            </button>
          </form>

          {error && <p className="mt-3 rounded-lg bg-[#fee4e2] px-3 py-2 text-sm text-[#b42318]">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="role-admin min-h-screen p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="panel panel-admin mb-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b42318]">QURTEK ADMIN PANEL</p>
              <h1 className="mt-2 text-4xl font-bold text-[#141414]">Dashboard Hari-H Dokumentasi Qurban</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#475467]">
                Kelola data shohibul, hewan, petugas, generate link dan QR code, lalu pantau progress
                dokumentasi real-time sesuai SOP plan.md.
              </p>
            </div>
            <button
              onClick={handleAdminLogout}
              className="rounded-lg border border-[#d0d5dd] px-4 py-2 text-sm font-semibold"
            >
              Logout Admin
            </button>
          </div>
        </header>

        {(error || success) && (
          <div className="mb-6 grid gap-2">
            {error && <p className="rounded-xl bg-[#fee4e2] px-4 py-3 text-sm text-[#b42318]">{error}</p>}
            {success && <p className="rounded-xl bg-[#dcfae6] px-4 py-3 text-sm text-[#067647]">{success}</p>}
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Shohibul" value={metrics.shohibul} accent="#b42318" />
          <StatCard label="Hewan Sapi" value={metrics.sapi} accent="#0f172a" />
          <StatCard label="Hewan Kambing" value={metrics.kambing} accent="#0f172a" />
          <StatCard label="Push Subscribed" value={metrics.pushSubscribed} accent="#0f766e" />
        </section>

        <section className="mb-6 panel panel-admin p-5">
          <h2 className="text-xl font-semibold">Progress Dokumentasi</h2>
          <p className="mt-2 text-sm text-[#475467]">
            Lengkap: {metrics.dokumentasiLengkap} hewan | Belum lengkap: {metrics.dokumentasiBelum} hewan
          </p>
          <button
            onClick={handleExportLaporan}
            className="mt-3 rounded-lg border border-[#d0d5dd] px-3 py-1 text-xs font-semibold"
          >
            Export Laporan (CSV)
          </button>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#eaecf0]">
            <div
              className="h-full rounded-full bg-[#b42318] transition-all"
              style={{ width: progressText }}
            />
          </div>
          <p className="mt-2 text-sm font-semibold text-[#b42318]">{progressText} selesai</p>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <form className="panel panel-admin p-5" onSubmit={handleCreateShohibul}>
            <h2 className="text-xl font-semibold">Tambah Shohibul</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <input
                required
                placeholder="Nama lengkap"
                value={shohibulForm.nama}
                onChange={(e) => setShohibulForm((prev) => ({ ...prev, nama: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />
              <input
                required
                placeholder="No WhatsApp"
                value={shohibulForm.no_whatsapp}
                onChange={(e) => setShohibulForm((prev) => ({ ...prev, no_whatsapp: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={shohibulForm.jenis_qurban}
                  onChange={(e) =>
                    setShohibulForm((prev) => ({ ...prev, jenis_qurban: e.target.value as "sapi" | "kambing" }))
                  }
                  className="rounded-lg border border-[#d0d5dd] px-3 py-2"
                >
                  <option value="sapi">Sapi</option>
                  <option value="kambing">Kambing</option>
                </select>
                <input
                  required
                  placeholder="Tipe (1/7, 1/1)"
                  value={shohibulForm.tipe}
                  onChange={(e) => setShohibulForm((prev) => ({ ...prev, tipe: e.target.value }))}
                  className="rounded-lg border border-[#d0d5dd] px-3 py-2"
                />
              </div>
              <input
                placeholder="Kelompok (contoh: Kelompok 3)"
                value={shohibulForm.kelompok_nama}
                onChange={(e) => setShohibulForm((prev) => ({ ...prev, kelompok_nama: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />

              <label className="text-xs text-[#475467]">Import CSV Shohibul</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportCsv(file);
                }}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />

              <button
                disabled={busy}
                className="mt-1 rounded-lg bg-[#141414] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Simpan Shohibul
              </button>
            </div>
          </form>

          <form className="panel panel-admin p-5" onSubmit={handleCreateHewan}>
            <h2 className="text-xl font-semibold">Tambah Hewan</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <input
                placeholder="Kode (kosongkan untuk auto)"
                value={hewanForm.kode}
                onChange={(e) => setHewanForm((prev) => ({ ...prev, kode: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />
              <select
                value={hewanForm.jenis}
                onChange={(e) => setHewanForm((prev) => ({ ...prev, jenis: e.target.value as "sapi" | "kambing" }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              >
                <option value="sapi">Sapi</option>
                <option value="kambing">Kambing</option>
              </select>
              <input
                placeholder="Warna / ciri"
                value={hewanForm.warna}
                onChange={(e) => setHewanForm((prev) => ({ ...prev, warna: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />
              <input
                type="number"
                placeholder="Berat estimasi (kg)"
                value={hewanForm.berat_est}
                onChange={(e) => setHewanForm((prev) => ({ ...prev, berat_est: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />
              <input
                placeholder="Kelompok"
                value={hewanForm.kelompok_nama}
                onChange={(e) => setHewanForm((prev) => ({ ...prev, kelompok_nama: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />
              <button
                disabled={busy}
                className="mt-1 rounded-lg bg-[#141414] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Simpan Hewan
              </button>
            </div>
          </form>

          <form className="panel panel-admin p-5" onSubmit={handleCreatePetugas}>
            <h2 className="text-xl font-semibold">Tambah Petugas</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <input
                required
                placeholder="Nama petugas"
                value={petugasForm.nama}
                onChange={(e) => setPetugasForm((prev) => ({ ...prev, nama: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />
              <input
                placeholder="No HP"
                value={petugasForm.no_hp}
                onChange={(e) => setPetugasForm((prev) => ({ ...prev, no_hp: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />
              <input
                placeholder="Area (A/B/C)"
                value={petugasForm.area}
                onChange={(e) => setPetugasForm((prev) => ({ ...prev, area: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />
              <input
                required
                minLength={6}
                maxLength={6}
                placeholder="PIN 6 digit"
                value={petugasForm.pin}
                onChange={(e) => setPetugasForm((prev) => ({ ...prev, pin: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />
              <button
                disabled={busy}
                className="mt-1 rounded-lg bg-[#141414] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Simpan Petugas
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="panel panel-admin overflow-hidden">
            <div className="border-b border-[#eaecf0] p-4">
              <h2 className="text-xl font-semibold">Daftar Link Unik Shohibul</h2>
            </div>
            <div className="max-h-[430px] overflow-auto p-4">
              {loading ? (
                <p className="text-sm text-[#667085]">Memuat data...</p>
              ) : (
                <div className="space-y-4">
                  {shohibulRows.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[#eaecf0] p-3">
                      <p className="font-semibold text-[#101828]">{item.nama}</p>
                      <p className="text-xs text-[#475467]">{item.no_whatsapp}</p>
                      <p className="mt-2 truncate text-xs text-[#344054]">
                        {origin || "https://qurtek.id"}/d/{item.unique_token}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => copyLink(item.unique_token)}
                          className="rounded-lg border border-[#d0d5dd] px-3 py-1 text-xs font-semibold"
                        >
                          Copy Link
                        </button>
                        <button
                          onClick={() => copyMessage(item)}
                          className="rounded-lg border border-[#d0d5dd] px-3 py-1 text-xs font-semibold"
                        >
                          Copy Pesan WA
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel panel-admin overflow-hidden">
            <div className="border-b border-[#eaecf0] p-4">
              <h2 className="text-xl font-semibold">Daftar Hewan & QR Code</h2>
            </div>
            <div className="max-h-[430px] overflow-auto p-4">
              {loading ? (
                <p className="text-sm text-[#667085]">Memuat data...</p>
              ) : (
                <div className="space-y-4">
                  {hewanRows.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[#eaecf0] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#101828]">
                            {item.kode} • {item.jenis.toUpperCase()}
                          </p>
                          <p className="text-xs text-[#475467]">{item.warna || "-"}</p>
                          <p className="text-xs text-[#475467]">Status: {item.status}</p>
                        </div>
                        <button
                          onClick={() => generateQr(item.kode)}
                          className="rounded-lg border border-[#d0d5dd] px-3 py-1 text-xs font-semibold"
                        >
                          Generate QR
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 panel panel-admin overflow-hidden">
          <div className="border-b border-[#eaecf0] p-4">
            <h2 className="text-xl font-semibold">Petugas Aktif</h2>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-sm">
              <thead className="text-[#667085]">
                <tr>
                  <th className="pb-2">Nama</th>
                  <th className="pb-2">Area</th>
                  <th className="pb-2">No HP</th>
                  <th className="pb-2">PIN</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {petugasRows.map((item) => (
                  <tr key={item.id} className="border-t border-[#eaecf0] text-[#101828]">
                    <td className="py-2">{item.nama}</td>
                    <td className="py-2">{item.area || "-"}</td>
                    <td className="py-2">{item.no_hp || "-"}</td>
                    <td className="py-2">{item.pin}</td>
                    <td className="py-2">{item.is_active ? "Aktif" : "Nonaktif"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <form className="panel panel-admin p-5" onSubmit={handleCreateDistribusi}>
            <h2 className="text-xl font-semibold">Input Distribusi Daging</h2>
            <p className="mt-1 text-sm text-[#475467]">
              Catat pembagian daging per shohibul untuk modul distribusi.
            </p>

            <div className="mt-4 grid gap-3 text-sm">
              <select
                value={distribusiForm.hewan_id}
                onChange={(e) => setDistribusiForm((prev) => ({ ...prev, hewan_id: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
                required
              >
                <option value="">Pilih Hewan</option>
                {hewanRows.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.kode} - {item.jenis}
                  </option>
                ))}
              </select>

              <select
                value={distribusiForm.shohibul_id}
                onChange={(e) => setDistribusiForm((prev) => ({ ...prev, shohibul_id: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
                required
              >
                <option value="">Pilih Shohibul</option>
                {shohibulRows.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nama}
                  </option>
                ))}
              </select>

              <input
                type="number"
                step="0.1"
                placeholder="Berat pembagian (kg)"
                value={distribusiForm.berat_kg}
                onChange={(e) => setDistribusiForm((prev) => ({ ...prev, berat_kg: e.target.value }))}
                className="rounded-lg border border-[#d0d5dd] px-3 py-2"
              />

              <button
                disabled={busy}
                className="rounded-lg bg-[#141414] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Simpan Distribusi
              </button>
            </div>
          </form>

          <div className="panel panel-admin overflow-hidden">
            <div className="border-b border-[#eaecf0] p-4">
              <h2 className="text-xl font-semibold">Riwayat Distribusi</h2>
            </div>
            <div className="max-h-[360px] overflow-auto p-4">
              {distribusiRows.length === 0 ? (
                <p className="text-sm text-[#475467]">Belum ada data distribusi.</p>
              ) : (
                <div className="space-y-3">
                  {distribusiRows.map((row) => {
                    const hewan = hewanRows.find((item) => item.id === row.hewan_id);
                    const shohibul = shohibulRows.find((item) => item.id === row.shohibul_id);

                    return (
                      <div key={row.id} className="rounded-lg border border-[#eaecf0] p-3 text-sm">
                        <p className="font-semibold text-[#101828]">
                          {hewan?.kode || "-"} → {shohibul?.nama || "-"}
                        </p>
                        <p className="text-[#475467]">Berat: {row.berat_kg ?? "-"} kg</p>
                        <p className="text-[#475467]">
                          Waktu: {row.diterima_at ? new Date(row.diterima_at).toLocaleString("id-ID") : "-"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {qrPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="panel panel-admin w-full max-w-sm p-5 text-center">
            <h3 className="text-2xl font-bold">QR {qrPreview.kode}</h3>
            <img src={qrPreview.dataUrl} alt={`QR ${qrPreview.kode}`} className="mx-auto mt-4 h-64 w-64" />
            <p className="mt-3 text-xs text-[#475467]">Cetak QR ini dan tempel di kalung/tali hewan.</p>
            <button
              onClick={() => setQrPreview(null)}
              className="mt-4 rounded-lg bg-[#141414] px-4 py-2 text-sm font-semibold text-white"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <article className="panel panel-admin p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667085]">{label}</p>
      <p className="mt-2 text-4xl font-bold" style={{ color: accent }}>
        {value}
      </p>
    </article>
  );
}
