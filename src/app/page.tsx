import Link from "next/link";

const roleCards = [
  {
    title: "Admin",
    subtitle: "Panel Kontrol Penuh",
    href: "/admin",
    color: "bg-[#171717] text-white",
    bullet: [
      "Kelola Shohibul, Hewan, Petugas",
      "Generate link unik & QR code",
      "Pantau progress real-time",
    ],
  },
  {
    title: "Petugas",
    subtitle: "Mode Kamera Lapangan",
    href: "/petugas",
    color: "bg-[#113a66] text-white",
    bullet: [
      "Login PIN 6 digit",
      "Scan QR hewan",
      "Upload foto/video per tahap",
    ],
  },
  {
    title: "Shohibul",
    subtitle: "Portal Tracking Pribadi",
    href: "/d/contoh-token",
    color: "bg-[#2f8f56] text-white",
    bullet: [
      "Lihat status qurban real-time",
      "Lihat galeri foto/video",
      "Terima notifikasi web push",
    ],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[linear-gradient(155deg,#edf5ea_0%,#f8fafc_45%,#eaf1ff_100%)] px-6 py-10 md:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 rounded-3xl border border-[#183f2f]/15 bg-white/85 p-8 shadow-[0_20px_50px_rgba(20,40,32,0.12)] backdrop-blur">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-[#2f8f56]">QURTEK PLATFORM</p>
          <h1 className="mb-3 text-4xl font-bold leading-tight text-[#143223] md:text-6xl">Dokumentasi Sampai, Shohibul Tenang</h1>
          <p className="max-w-3xl text-lg text-[#365848]">
            Sistem dokumentasi qurban real-time dengan 3 pintu akses terpisah: Admin, Petugas,
            dan Portal Shohibul. Scan, jepret, dan semua update otomatis tersampaikan.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          {roleCards.map((role) => (
            <article key={role.title} className={`panel p-6 ${role.color}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">Akses Role</p>
              <h2 className="mt-2 text-3xl font-bold">{role.title}</h2>
              <p className="mb-5 mt-1 text-sm opacity-90">{role.subtitle}</p>
              <ul className="mb-6 space-y-2 text-sm opacity-95">
                {role.bullet.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              <Link
                href={role.href}
                className="inline-flex items-center rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
              >
                Buka {role.title}
              </Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
