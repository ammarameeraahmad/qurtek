# 🐄 RENCANA WEBSITE DOKUMENTASI QURBAN

## "QURTEK" — Dokumentasi Sampai, Shohibul Tenang

---

## 📌 PROBLEM STATEMENT

```
😫 MASALAH SAAT INI:
├── Ratusan hewan qurban disembelih bersamaan
├── Panitia kewalahan dokumentasi manual
├── Foto/video tercampur, tidak tahu milik siapa
├── Shohibul bertanya-tanya "Qurban saya sudah disembelih belum?"
├── Kirim dokumentasi satu-satu via WhatsApp = CHAOS
└── Banyak yang terlewat tidak terdokumentasi
```

---

## 🎯 TUJUAN UTAMA

> **"Setiap Shohibul Qurban mendapat dokumentasi penyembelihan hewan qurbannya secara REAL-TIME, RAPI, dan OTOMATIS tanpa panitia harus ribet kirim satu-satu."**

---

## 🏗️ ARSITEKTUR SISTEM

```
┌──────────────────────────────────────────────────────────┐
│                     QURTEK PLATFORM                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  ADMIN      │   │  PETUGAS     │   │  SHOHIBUL    │  │
│  │  PANEL      │   │  LAPANGAN    │   │  PORTAL      │  │
│  │             │   │  (KAMERA)    │   │  (TRACKING)  │  │
│  └──────┬──────┘   └──────┬───────┘   └──────┬───────┘  │
│         │                 │                   │          │
│         ▼                 ▼                   ▼          │
│  ┌──────────────────────────────────────────────────┐   │
│  │               CLOUD DATABASE                      │   │
│  │    (Data Shohibul + Media + Status Tracking)      │   │
│  └──────────────────────────────────────────────────┘   │
│         │                 │                   │          │
│         ▼                 ▼                   ▼          │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  WEB PUSH   │   │  CLOUD       │   │  AUTO       │  │
│  │  NOTIFIKASI │   │  STORAGE     │   │  COMPRESS   │  │
│  └─────────────┘   └──────────────┘   └─────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 👥 TIGA ROLE PENGGUNA

### 1. 🔑 ADMIN (Panitia Inti)
```
Akses: Full Control
├── Input & manage data shohibul qurban
├── Input data hewan (jenis, berat, ciri-ciri)
├── Mapping: Shohibul ↔ Hewan ↔ Kelompok
├── Assign petugas lapangan
├── Monitor dashboard real-time
├── Generate & salin link unik shohibul (kirim manual via WA)
└── Generate laporan akhir
```

### 2. 📸 PETUGAS LAPANGAN (Dokumentator)
```
Akses: Capture & Upload
├── Buka kamera langsung dari website (PWA)
├── Scan QR Code hewan → auto-link ke shohibul
├── Foto & video langsung ter-assign
├── Checklist tahapan dokumentasi
├── Tidak perlu tahu detail data shohibul
└── Fokus: JEPRET → SELESAI
```

### 3. 👤 SHOHIBUL QURBAN (Pemesan)
```
Akses: View Only (Portal Pribadi)
├── Buka link unik yang dikirim panitia via WA
├── Lihat status qurban real-time
├── Terima Web Push Notification tiap ada update
├── Lihat & download foto/video
└── Download semua dokumentasi (ZIP)
```

---

## 🔔 SISTEM NOTIFIKASI: WEB PUSH NOTIFICATION

### Kenapa Web Push Notification?

```
✅ WEB PUSH NOTIFICATION:
├── 100% GRATIS (tidak ada biaya API)
├── Tidak perlu setup WhatsApp Business API
├── Muncul di HP seperti notifikasi app biasa
├── Bekerja meskipun browser sedang ditutup
├── Satu klik "Izinkan Notifikasi" → selesai
├── Built-in di PWA, tidak butuh layanan pihak ketiga
└── Klik notifikasi → langsung ke portal shohibul

❌ Kenapa BUKAN WhatsApp API:
├── Mahal (Rp 100rb-500rb/bulan)
├── Setup ribet (verifikasi bisnis, approval Meta)
├── Butuh nomor WA khusus
└── Overkill untuk event setahun sekali

❌ Kenapa BUKAN Email:
├── Banyak orang Indonesia jarang cek email
├── Sering masuk spam
├── Tidak real-time (orang buka email berjam-jam kemudian)
└── Kurang cocok untuk notifikasi instan
```

### Cara Kerja Web Push di Qurtek

```
FLOW NOTIFIKASI:

1. Admin kirim link unik ke shohibul via WA (manual/copy-paste)
   
   "Assalamu'alaikum Pak Ahmad,
    Berikut link dokumentasi qurban Anda:
    🔗 qurtek.id/d/aBc123xYz"

2. Shohibul buka link di browser HP

3. Muncul popup:
   ┌──────────────────────────────────┐
   │  qurtek.id ingin mengirim        │
   │  notifikasi                      │
   │                                  │
   │  [Blokir]  [✅ Izinkan]         │
   └──────────────────────────────────┘

4. Shohibul tekan "Izinkan" → SELESAI!

5. Setiap ada update tahapan, otomatis muncul di HP:
   ┌──────────────────────────────────┐
   │ 🔔 Qurtek                        │
   │ Alhamdulillah! Hewan qurban Anda │
   │ telah disembelih pukul 07:35 WIB │
   │ Tap untuk lihat dokumentasi 📸    │
   └──────────────────────────────────┘
```

### Trigger Notifikasi Otomatis

```
🔔 Notif 1 — Hewan Siap
   "Hewan qurban Anda (Sapi HWN-001) sudah siap
    di area penyembelihan."

🔔 Notif 2 — Disembelih ✅
   "Alhamdulillah! Hewan qurban Anda telah
    disembelih pukul 07:35 WIB.
    Tap untuk lihat foto & video."

🔔 Notif 3 — Proses Berlangsung
   "Daging sedang dalam proses pemotongan
    & pengemasan. Dokumentasi terupdate."

🔔 Notif 4 — Siap Diambil
   "Daging qurban Anda sudah dikemas!
    Silakan ambil di Pos 3 mulai 11:00 WIB."

🔔 Notif 5 — Dokumentasi Lengkap
   "Dokumentasi lengkap qurban Anda:
    📸 X foto, 🎥 X video.
    Tap untuk lihat & download."
```

### Implementasi Teknis (Service Worker)

```javascript
// service-worker.js (Simplified)

// Listen push event
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  self.registration.showNotification(data.title, {
    body: data.message,
    icon: '/icons/qurtek-192.png',
    badge: '/icons/badge-72.png',
    data: { url: data.portal_url },
    vibrate: [200, 100, 200]
  });
});

// Klik notifikasi → buka portal
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

```
Backend mengirim push notification:
├── Menggunakan library web-push (Node.js)
├── Gratis, tanpa layanan pihak ketiga
├── Shohibul subscribe saat pertama buka link
├── Backend simpan subscription endpoint di DB
└── Trigger push setiap petugas update tahapan
```

---

## 📱 FITUR DETAIL

### ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### 🔷 MODUL 1: MANAJEMEN DATA (Pre-Event)
### ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#### 1A. Input Data Shohibul
```
┌──────────────────────────────────────┐
│     ➕ TAMBAH SHOHIBUL QURBAN        │
├──────────────────────────────────────┤
│                                      │
│  Nama Lengkap  : [Ahmad Fauzi     ] │
│  No. WhatsApp  : [0812-xxxx-xxxx  ] │
│  Jenis Qurban  : [Sapi / Kambing  ] │
│  Tipe          : [1/7 Sapi        ] │
│  Kelompok      : [Kelompok 3      ] │
│  Anggota Kel.  : [Lihat 7 orang ▼ ] │
│  Catatan       : [________________ ] │
│                                      │
│  [💾 Simpan] [📋 Import Excel]      │
│                                      │
└──────────────────────────────────────┘
```

**Fitur Import Excel/CSV:**
```
Format Template:
| No | Nama | WhatsApp | Jenis | Tipe | Kelompok |
|----|------|----------|-------|------|----------|
| 1  | Ahmad| 0812xxx  | Sapi  | 1/7  | Kel-3   |
| 2  | Budi | 0813xxx  | Kambing| 1/1 | -       |
```

#### 1B. Input Data Hewan
```
┌──────────────────────────────────────┐
│     🐄 DATA HEWAN QURBAN            │
├──────────────────────────────────────┤
│                                      │
│  ID Hewan      : [AUTO: HWN-001   ] │
│  Jenis         : [Sapi / Kambing  ] │
│  Warna/Ciri    : [Coklat, tanduk 2 ]│
│  Berat (est.)  : [350 kg          ] │
│  Asal          : [Supplier ABC    ] │
│  Assign ke     : [Kelompok 3    ▼ ] │
│                                      │
│  📸 Foto Hewan : [Ambil Foto]       │
│                                      │
│  [🏷️ GENERATE QR CODE]              │
│                                      │
└──────────────────────────────────────┘
```

#### 1C. QR Code System (KUNCI UTAMA!)
```
Setiap hewan mendapat QR Code unik:

  ┌─────────────────┐
  │  ┌───────────┐  │
  │  │ █▀▀▀▀▀█   │  │
  │  │ █ QR  █   │  │  ← Dicetak, ditempel di
  │  │ █▄▄▄▄▄█   │  │     tali/kalung hewan
  │  └───────────┘  │
  │   HWN-001       │
  │   Sapi - Kel.3  │
  │   7 Shohibul    │
  └─────────────────┘

Fungsi QR Code:
├── Petugas SCAN → langsung tahu ini hewan siapa
├── Kamera terbuka → mode dokumentasi
├── Semua foto/video auto-linked ke shohibul terkait
└── Tidak perlu cari-cari data manual
```

#### 1D. Generate & Kirim Link Unik Shohibul

```
┌──────────────────────────────────────────┐
│  📋 DAFTAR LINK UNIK SHOHIBUL           │
├──────────────────────────────────────────┤
│                                          │
│  Ahmad Fauzi  | 0812xxx                  │
│  🔗 qurtek.id/d/aBc123xYz               │
│  [📋 Copy Link] [📋 Copy Pesan]         │
│                                          │
│  Budi Santoso | 0813xxx                  │
│  🔗 qurtek.id/d/dEf456uVw               │
│  [📋 Copy Link] [📋 Copy Pesan]         │
│                                          │
│  ... dst                                 │
│                                          │
│  [📋 Copy Semua Pesan (Bulk)]            │
│                                          │
└──────────────────────────────────────────┘

Klik "Copy Pesan" → otomatis copy template:
────────────────────────────────────────────
Assalamu'alaikum Pak Ahmad Fauzi,

Berikut link dokumentasi qurban Anda
di Universitas Gadjah Mada - Idul Adha 1447H:

🔗 qurtek.id/d/aBc123xYz

Buka link tersebut untuk melihat proses
qurban Anda secara real-time besok.
Jazakallahu khairan 🙏
────────────────────────────────────────────

Admin tinggal:
1. Klik "Copy Pesan"
2. Buka WhatsApp → Cari kontak
3. Paste → Kirim
4. Ulangi untuk shohibul lain

💡 Tidak perlu WhatsApp API!
   Cukup copy-paste manual. Untuk 100 shohibul,
   butuh ~30 menit. Bisa dikerjakan H-1.
```

---

### ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### 🔷 MODUL 2: DOKUMENTASI LAPANGAN (Inti!)
### ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#### 2A. Flow Petugas Lapangan

```
FLOW KERJA PETUGAS:

    ┌──────────────┐
    │  BUKA APP    │
    │  (PWA/Web)   │
    └──────┬───────┘
           ▼
    ┌──────────────┐
    │  SCAN QR     │──── QR di kalung hewan
    │  HEWAN       │
    └──────┬───────┘
           ▼
    ┌──────────────────────────────────┐
    │  TAMPIL INFO:                    │
    │  "Sapi HWN-001 - Kelompok 3"    │
    │  "7 Shohibul Qurban"            │
    │                                  │
    │  ☐ Foto Hewan Sebelum           │
    │  ☐ Video Penyembelihan          │
    │  ☐ Foto Proses Pengulitan       │
    │  ☐ Foto Daging Sudah Dipotong   │
    │  ☐ Foto Penimbangan             │
    │  ☐ Foto Daging Dikemas          │
    │  ☐ Foto/Video Penyerahan        │
    └──────────────┬───────────────────┘
                   ▼
           ┌───────────────┐
           │  📸 KAMERA    │ ← Langsung terbuka
           │  🎥 VIDEO     │ ← Pilih mode
           └───────┬───────┘
                   ▼
           ┌───────────────┐
           │  AUTO UPLOAD  │ ← Compressed + Uploaded
           │  AUTO ASSIGN  │ ← Linked ke semua shohibul
           │  AUTO NOTIFY  │ ← Web push notification sent
           └───────────────┘
```

#### 🔍 Penjelasan AUTO-ASSIGN

```
═══════════════════════════════════════════════════
  APA ITU AUTO-ASSIGN?
═══════════════════════════════════════════════════

Auto-assign adalah mekanisme di mana foto/video yang
diambil petugas OTOMATIS TERHUBUNG ke semua shohibul
yang terkait dengan hewan tersebut.

TANPA Auto-Assign (cara lama):
──────────────────────────────
  1. Petugas foto penyembelihan sapi
  2. "Ini sapi siapa ya?" → bingung
  3. Tanya panitia → cari data manual
  4. Kirim ke WA satu-satu → 7 orang
  5. Ketuker sama sapi lain → kacau
  6. ❌ Lama, ribet, rawan salah

DENGAN Auto-Assign (Qurtek):
──────────────────────────────
  1. Petugas SCAN QR di kalung sapi
     → Sistem tahu: "Ini HWN-001, Kelompok 3"
     → Sistem tahu: "Kelompok 3 = 7 orang shohibul"

  2. Petugas FOTO/VIDEO
     → Media langsung di-tag: HWN-001

  3. OTOMATIS terjadi di belakang layar:
     ┌─────────────────────────────────────┐
     │  📸 foto_sembelih_001.jpg           │
     │  Tagged: HWN-001                    │
     │                                     │
     │  Auto-assign ke:                    │
     │  ├── ✅ Portal Ahmad Fauzi          │
     │  ├── ✅ Portal Budi Santoso         │
     │  ├── ✅ Portal Citra Dewi           │
     │  ├── ✅ Portal Dani Pratama         │
     │  ├── ✅ Portal Eko Widodo           │
     │  ├── ✅ Portal Fajar Rahman         │
     │  └── ✅ Portal Gunawan              │
     │                                     │
     │  🔔 Push notification terkirim ke   │
     │     7 shohibul sekaligus            │
     └─────────────────────────────────────┘

  4. Petugas TIDAK PERLU tahu:
     - Siapa nama shohibulnya
     - Berapa jumlah orangnya
     - Mana WA-nya
     → Cukup scan & jepret, sistem yang urus sisanya

INTINYA:
━━━━━━━━
  QR Code = jembatan antara hewan ↔ shohibul
  
  Petugas scan QR → ambil foto → foto OTOMATIS
  muncul di portal SEMUA shohibul yang patungan
  di hewan tersebut. Tanpa kirim manual. Satset.
```

#### 2B. Interface Kamera Website (PWA)

```
┌────────────────────────────────────────┐
│  🐄 HWN-001 | Kelompok 3 | Sapi       │
├────────────────────────────────────────┤
│                                        │
│  Tahap: 📍 PENYEMBELIHAN              │
│  ━━━━━━━━━●━━━━━━━━━━━━━ 2/7          │
│                                        │
│  ┌────────────────────────────────┐    │
│  │                                │    │
│  │                                │    │
│  │         📷 VIEWFINDER          │    │
│  │         (Camera Feed)          │    │
│  │                                │    │
│  │                                │    │
│  └────────────────────────────────┘    │
│                                        │
│  ┌──────┐  ┌──────────┐  ┌──────┐     │
│  │ 📸   │  │  ⏺️ REC  │  │  ↻   │     │
│  │ Foto │  │  Video   │  │ Flip │     │
│  └──────┘  └──────────┘  └──────┘     │
│                                        │
│  📎 Upload dari Gallery               │
│                                        │
│  ── Media Ter-upload (2) ──────────    │
│  [🖼️ thumb1] [🖼️ thumb2] [+ Add]     │
│                                        │
│  [✅ SELESAI TAHAP INI → Lanjut]      │
│                                        │
└────────────────────────────────────────┘
```

#### 2C. Checklist Tahapan Dokumentasi

```
PIPELINE DOKUMENTASI PER HEWAN:

 Step 1  ✅  Foto Hewan (sebelum sembelih)
              └─ Min. 1 foto
 
 Step 2  ✅  Video Penyembelihan
              └─ Min. 1 video (auto-limit 30 detik)
 
 Step 3  🔄  Foto Proses Pengulitan
              └─ Min. 1 foto (opsional)
 
 Step 4  ⬜  Foto Daging Dipotong
              └─ Min. 1 foto
 
 Step 5  ⬜  Foto Penimbangan
              └─ Min. 1 foto per kelompok berat
 
 Step 6  ⬜  Foto Pengemasan
              └─ Min. 1 foto
 
 Step 7  ⬜  Foto/Video Distribusi
              └─ Bukti penyerahan daging

 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Progress: ████████░░░░░ 3/7 (43%)
```

#### 2D. Smart Features Kamera

```
🔧 FITUR PINTAR:

1. AUTO-COMPRESS
   ├── Foto: Max 1MB (dari ~5MB asli)
   ├── Video: Max 720p, 30fps
   ├── Hemat storage & bandwidth
   └── Tetap cukup jelas untuk dokumentasi

2. AUTO-WATERMARK
   ┌──────────────────────────┐
   │  [foto/video]            │
   │                          │
   │                          │
   │  HWN-001 | Penyembelihan│
   │  10 Jun 2026 - 07:32 WIB│
   │  Universitas Gadjah Mada │
   └──────────────────────────┘

3. OFFLINE MODE (PENTING!)
   ├── Capture tetap bisa tanpa internet
   ├── Media disimpan di local storage (IndexedDB)
   ├── Auto-sync ketika online kembali
   └── Queue indicator di UI
   
   ┌────────────────────────────────┐
   │  ⚠️ Offline Mode Aktif         │
   │  3 media menunggu upload...    │
   │  ██████░░░░ akan sync otomatis │
   └────────────────────────────────┘

4. BURST MODE
   ├── Ambil banyak foto cepat (tap-tap-tap)
   ├── Semua langsung masuk antrian upload
   └── Background upload, tidak blocking UI

5. AUTO-THUMBNAIL
   └── Generate thumbnail untuk preview cepat
```

---

### ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### 🔷 MODUL 3: PORTAL SHOHIBUL QURBAN
### ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#### 3A. Akses via Link Unik

```
CARA AKSES:

1. H-1, Admin copy-paste link unik via WhatsApp:

   "Assalamu'alaikum Pak Ahmad,
    🔗 qurtek.id/d/aBc123xYz
    Buka link ini untuk pantau qurban Anda."

2. Shohibul klik link → langsung masuk portal

3. Browser minta izin notifikasi → klik "Izinkan"

4. Selesai! Shohibul tinggal tunggu update masuk.

Kenapa Link Unik:
├── Tidak perlu registrasi / bikin akun
├── Tidak perlu ingat password
├── Satu klik langsung masuk
├── Aman: link random, tidak bisa ditebak
├── Bisa di-bookmark untuk akses kapan saja
└── Simpel untuk semua kalangan umur
```

#### 3B. Tampilan Portal Shohibul

```
┌────────────────────────────────────────┐
│  🕌 QURTEK                             │
│  Universitas Gadjah Mada               │
│  Idul Adha 1447H                       │
├────────────────────────────────────────┤
│                                        │
│  Assalamu'alaikum,                     │
│  Pak Ahmad Fauzi                       │
│                                        │
│  ┌────────────────────────────────┐    │
│  │  🐄 Sapi - Kelompok 3          │    │
│  │  Bagian: 1/7                    │    │
│  │  Status: 🟢 SEDANG DIPROSES    │    │
│  └────────────────────────────────┘    │
│                                        │
│  📍 TRACKING STATUS                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━      │
│                                        │
│  ✅ Hewan Tiba        07:00 📸(2)     │
│  ✅ Disembelih        07:35 📸🎥      │
│  ✅ Pengulitan        08:00 📸(1)     │
│  🔄 Pemotongan        08:30 📸(2)     │
│  ⬜ Penimbangan        --:--           │
│  ⬜ Pengemasan         --:--           │
│  ⬜ Siap Diambil       --:--           │
│                                        │
│  ── GALERI DOKUMENTASI ──              │
│                                        │
│  [🖼️][🖼️][🎥][🖼️][🖼️][🖼️]          │
│                                        │
│  [📥 Download Semua (ZIP)]            │
│  [📤 Share ke Social Media]           │
│                                        │
│  ── INFO TAMBAHAN ──                   │
│  Est. berat bagian Anda: ±25 kg       │
│  Pengambilan: Pos 3, mulai 11:00      │
│                                        │
└────────────────────────────────────────┘
```

---

### ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### 🔷 MODUL 4: ADMIN DASHBOARD
### ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
┌────────────────────────────────────────────────┐
│  📊 DASHBOARD ADMIN - Hari H                   │
│  🕌 Universitas Gadjah Mada                     │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  🐄 45   │ │  🐐 120  │ │  👤 435  │       │
│  │  Sapi    │ │  Kambing  │ │  Shohibul│       │
│  └──────────┘ └──────────┘ └──────────┘       │
│                                                │
│  PROGRESS PENYEMBELIHAN                        │
│  Sapi   : ████████████░░░░ 32/45  (71%)       │
│  Kambing : ██████████████░░ 98/120 (82%)       │
│                                                │
│  DOKUMENTASI STATUS                            │
│  ✅ Lengkap    : 89 hewan                      │
│  🔄 Sebagian   : 31 hewan                      │
│  ❌ Belum      : 45 hewan                      │
│  ⚠️ PERLU TINDAKAN: 5 hewan tanpa foto sembelih│
│                                                │
│  PETUGAS ONLINE                                │
│  👤 Udin  - Area A - 📸 45 media ✅           │
│  👤 Asep  - Area B - 📸 38 media ✅           │
│  👤 Rina  - Area C - 📸 12 media ⚠️ slow      │
│  👤 Dedi  - Area D - 📷 0  media ❌ offline    │
│                                                │
│  NOTIFIKASI PUSH                               │
│  ✅ Subscribed  : 412/435 shohibul (95%)       │
│  ❌ Belum subscribe: 23 shohibul               │
│  📨 Total push terkirim hari ini: 847          │
│                                                │
│  [📊 Export Laporan]                           │
│                                                │
└────────────────────────────────────────────────┘
```

---

### ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### 🔷 MODUL 5: SISTEM DISTRIBUSI DAGING
### ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
┌──────────────────────────────────────┐
│  📦 DISTRIBUSI - HWN-001             │
├──────────────────────────────────────┤
│                                      │
│  Total daging : 180 kg               │
│  Pembagian    : 7 shohibul           │
│                                      │
│  ☐ Ahmad Fauzi    - 25.7 kg  [📸]  │
│  ☐ Budi Santoso   - 25.7 kg  [📸]  │
│  ☐ Citra Dewi     - 25.7 kg  [📸]  │
│  ☐ Dani Pratama   - 25.7 kg  [📸]  │
│  ☐ Eko Widodo     - 25.7 kg  [📸]  │
│  ☐ Fajar Rahman   - 25.7 kg  [📸]  │
│  ☐ Gunawan        - 25.7 kg  [📸]  │
│                                      │
│  [📸] = Foto bukti serah terima     │
│                                      │
│  Sisa untuk fakir miskin: 1/3 bagian│
│                                      │
└──────────────────────────────────────┘
```

---

## ⚙️ TECH STACK

```
┌─────────────────────────────────────────────┐
│               TECH STACK                     │
├─────────────────────────────────────────────┤
│                                             │
│  FRONTEND (PWA - Progressive Web App)       │
│  ├── Next.js 14+ (React Framework)         │
│  ├── Tailwind CSS (Styling)                │
│  ├── PWA + Service Worker (Offline + Push) │
│  └── MediaDevices API (Camera Access)      │
│                                             │
│  BACKEND                                    │
│  ├── Next.js API Routes (Fullstack)        │
│  ├── Prisma ORM                            │
│  └── Bull Queue (Background Upload Jobs)   │
│                                             │
│  DATABASE                                   │
│  ├── PostgreSQL (Primary Data)             │
│  └── Redis (Queue & Caching)               │
│                                             │
│  STORAGE                                    │
│  ├── Cloudflare R2 (Media Storage - Murah) │
│  ├── Sharp.js (Image Compression)          │
│  └── FFmpeg (Video Compression)            │
│                                             │
│  NOTIFICATION                               │
│  ├── Web Push API (browser built-in)       │
│  └── web-push (Node.js library - GRATIS)   │
│                                             │
│  REALTIME                                   │
│  └── Server-Sent Events (SSE)              │
│                                             │
│  HOSTING                                    │
│  ├── Vercel (Frontend + API)               │
│  └── Supabase (PostgreSQL + Storage)       │
│                                             │
│  QR CODE                                    │
│  ├── qrcode.js (Generate)                  │
│  └── html5-qrcode (Scanner)               │
│                                             │
└─────────────────────────────────────────────┘
```

### Kenapa PWA, Bukan Native App?

```
PWA (Progressive Web App) adalah pilihan terbaik karena:
├── Tidak perlu install dari Play Store
├── Buka browser → Add to Home Screen → Selesai
├── Bisa akses kamera, offline mode, push notification
├── Satu codebase untuk semua device
├── Petugas & shohibul langsung pakai, tanpa barrier
├── Update instan tanpa update app
└── App yang dipakai setahun sekali tidak perlu native
```

---

## 🗄️ DATABASE SCHEMA

```sql
-- Core Tables

TABLE shohibul {
  id                UUID PRIMARY KEY
  nama              VARCHAR(255)
  no_whatsapp       VARCHAR(20)
  jenis_qurban      ENUM('sapi', 'kambing')
  tipe              VARCHAR(10)            -- "1/7", "1/1"
  kelompok_id       UUID FK
  unique_token      VARCHAR(50) UNIQUE     -- untuk link unik
  push_subscription JSON                   -- Web Push subscription data
  created_at        TIMESTAMP
}

TABLE kelompok {
  id            UUID PRIMARY KEY
  nama          VARCHAR(100)        -- "Kelompok 3"
  hewan_id      UUID FK
}

TABLE hewan {
  id            UUID PRIMARY KEY
  kode          VARCHAR(20) UNIQUE  -- "HWN-001"
  jenis         ENUM('sapi', 'kambing')
  warna         VARCHAR(100)
  berat_est     DECIMAL
  qr_code_url   VARCHAR(500)
  status        ENUM('registered','ready','slaughtering',
                     'processing','distributing','done')
  created_at    TIMESTAMP
}

TABLE dokumentasi {
  id            UUID PRIMARY KEY
  hewan_id      UUID FK
  petugas_id    UUID FK
  tahap         ENUM('hewan_tiba','penyembelihan',
                     'pengulitan','pemotongan',
                     'penimbangan','pengemasan',
                     'distribusi')
  tipe_media    ENUM('foto','video')
  media_url     VARCHAR(500)
  thumbnail_url VARCHAR(500)
  file_size     INTEGER
  captured_at   TIMESTAMP
  uploaded_at   TIMESTAMP
  is_synced     BOOLEAN DEFAULT false
}

TABLE status_tracking {
  id            UUID PRIMARY KEY
  hewan_id      UUID FK
  tahap         VARCHAR(50)
  waktu         TIMESTAMP
  catatan       TEXT
  petugas_id    UUID FK
}

TABLE petugas {
  id            UUID PRIMARY KEY
  nama          VARCHAR(255)
  no_hp         VARCHAR(20)
  area          VARCHAR(50)
  pin           VARCHAR(6)
  is_active     BOOLEAN
}

TABLE push_subscriptions {
  id              UUID PRIMARY KEY
  shohibul_id     UUID FK
  endpoint        TEXT           -- Push service URL
  p256dh_key      TEXT           -- Encryption key
  auth_key        TEXT           -- Auth secret
  subscribed_at   TIMESTAMP
  is_active       BOOLEAN DEFAULT true
}

TABLE distribusi {
  id            UUID PRIMARY KEY
  hewan_id      UUID FK
  shohibul_id   UUID FK
  berat_kg      DECIMAL
  foto_serah    VARCHAR(500)
  diterima_at   TIMESTAMP
}
```

---

## 🔄 SOP HARI-H (WORKFLOW)

```
═══════════════════════════════════════════════════
              SOP DOKUMENTASI QURBAN
              UNIVERSITAS GADJAH MADA
═══════════════════════════════════════════════════

📅 H-7  : PERSIAPAN
├── Admin input semua data shohibul (atau import Excel)
├── Admin input data hewan
├── Mapping shohibul ↔ kelompok ↔ hewan
├── Generate & cetak QR Code per hewan
├── Tempel QR Code di kalung/tali hewan
├── Briefing petugas lapangan
└── Test sistem (foto dummy → cek push notif)

📅 H-1  : KIRIM LINK & FINAL CHECK
├── Admin copy-paste link unik ke setiap shohibul via WA
│   "Pak Ahmad, buka link ini besok: qurtek.id/d/aBc123"
├── Minta shohibul buka link & izinkan notifikasi
├── Pastikan semua QR Code terpasang di hewan
├── Charge HP semua petugas 100%
├── Siapkan powerbank cadangan
└── Test sinyal internet di lokasi

📅 HARI-H : EKSEKUSI
│
├── 05:00 - Setup
│   ├── Admin buka dashboard
│   ├── Semua petugas login & cek kamera
│   └── Koordinasi area masing-masing
│
├── 06:00 - Mulai Penyembelihan
│   │
│   │  UNTUK SETIAP HEWAN:
│   │  ┌─────────────────────────────────────┐
│   │  │ 1. Petugas SCAN QR hewan            │
│   │  │ 2. Foto hewan sebelum (📸)          │
│   │  │ 3. Video penyembelihan (🎥)         │
│   │  │ 4. Klik "Selesai Tahap"             │
│   │  │    → Auto-assign ke semua shohibul  │
│   │  │    → Push notification terkirim     │
│   │  │ 5. Foto proses selanjutnya          │
│   │  │ 6. ... repeat per tahap             │
│   │  └─────────────────────────────────────┘
│   │
│   └── Admin monitor dashboard
│       ├── Cek progress semua hewan
│       └── Follow up yang tertinggal ⚠️
│
├── 09:00 - Proses Pemotongan & Pengemasan
│   ├── Dokumentasi tiap tahap lanjutan
│   └── Foto penimbangan & pengemasan
│
├── 11:00 - Distribusi
│   ├── Foto serah terima per shohibul
│   ├── Update status "Selesai"
│   └── Push notif final ke shohibul
│
├── 13:00 - Wrap Up
│   ├── Admin cek semua hewan terdokumentasi
│   ├── Follow up yang belum lengkap
│   └── Kirim push notif "Dokumentasi Lengkap"
│
└── H+1 : LAPORAN
    ├── Generate laporan PDF
    ├── Backup semua media
    └── Evaluasi untuk tahun depan
```

---

## 📋 PANDUAN PETUGAS LAPANGAN

```
┌────────────────────────────────────────────┐
│     📋 KARTU PANDUAN PETUGAS               │
│     (Cetak & bagi ke setiap petugas)       │
├────────────────────────────────────────────┤
│                                            │
│  1️⃣  Buka qurtek.id di HP                  │
│  2️⃣  Login pakai PIN kamu                  │
│  3️⃣  Tekan "SCAN QR"                       │
│  4️⃣  Arahkan ke QR di kalung hewan         │
│  5️⃣  Muncul info hewan → tekan "MULAI"     │
│  6️⃣  FOTO setiap tahap yang diminta        │
│  7️⃣  Tekan ✅ setelah foto/video           │
│  8️⃣  Lanjut ke tahap berikutnya            │
│  9️⃣  Kalau OFFLINE → tetap foto aja,       │
│      nanti auto-upload saat ada sinyal     │
│  🔟  Selesai semua tahap → pindah hewan    │
│                                            │
│  ⚠️  PENTING:                              │
│  • Foto harus JELAS, jangan blur           │
│  • Video penyembelihan max 30 detik        │
│  • Kalau bingung, tanya Admin              │
│                                            │
└────────────────────────────────────────────┘
```

---

## 💰 ESTIMASI BIAYA

```
┌──────────────────────────────────────────────┐
│  💰 ESTIMASI BIAYA OPERASIONAL               │
├──────────────────────────────────────────────┤
│                                              │
│  DEVELOPMENT (Sekali Bayar)                  │
│  └── Full Development     : Rp 15-25 juta   │
│                                              │
│  HOSTING PER TAHUN                           │
│  ├── Vercel (Free tier)   : Rp 0             │
│  ├── Supabase (Free tier) : Rp 0             │
│  └── Domain qurtek.id     : Rp 100-250rb    │
│                                              │
│  STORAGE (Per Event)                         │
│  └── Cloudflare R2                           │
│      100 hewan × 10 media × 1MB             │
│      = ~1 GB = Rp 0 (free tier 10GB)        │
│                                              │
│  NOTIFIKASI                                  │
│  └── Web Push API          : Rp 0 (GRATIS!) │
│                                              │
│  WHATSAPP API                                │
│  └── Tidak pakai           : Rp 0            │
│      (link dikirim manual copy-paste)        │
│                                              │
│  ════════════════════════════════════════     │
│  TOTAL TAHUNAN (setelah development):        │
│  ~Rp 100rb - 250rb/tahun (domain saja!)     │
│  ════════════════════════════════════════     │
│                                              │
│  💡 Nyaris GRATIS setiap tahun karena:       │
│     • Hosting free tier                      │
│     • Storage free tier                      │
│     • Notifikasi gratis (Web Push)           │
│     • Tidak pakai WA API                     │
│     • Cuma bayar domain                      │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 📅 TIMELINE DEVELOPMENT

```
MINGGU 1-2  : Setup & Data Management
├── Setup project (Next.js + Supabase + R2)
├── Halaman admin: CRUD Shohibul & Hewan
├── Import Excel
├── QR Code generator
├── Generate link unik + halaman "Copy Pesan"
└── Database schema & API

MINGGU 3-4  : Fitur Kamera & Upload
├── PWA setup + Service Worker
├── Camera API integration
├── QR Scanner
├── Media upload pipeline (compress → upload → store)
├── Auto-assign logic (QR → hewan → semua shohibul)
├── Offline queue system (IndexedDB)
└── Auto-watermark

MINGGU 5-6  : Portal Shohibul & Notifikasi
├── Halaman portal shohibul (via unique link)
├── Web Push Notification setup
├── Push subscription flow
├── Status tracking real-time (SSE)
├── Gallery view (foto + video)
└── Download ZIP

MINGGU 7    : Dashboard & Polish
├── Admin dashboard (progress monitoring)
├── Laporan & export PDF
├── Testing menyeluruh
├── Performance optimization
└── Stress test (simulate 500 shohibul)

MINGGU 8    : UAT & Launch
├── Training panitia & petugas
├── Simulasi hari H (dry run)
├── Fix bugs
└── Go Live! 🚀
```

---

## ✅ CHECKLIST KESIAPAN

```
PRE-EVENT:
☐ Semua data shohibul sudah diinput
☐ Semua hewan sudah diinput & ada QR Code
☐ QR Code sudah dicetak & ditempel
☐ Semua petugas sudah punya akun & briefing
☐ Test kamera di semua HP petugas
☐ Test upload di lokasi (cek sinyal)
☐ Link unik sudah dikirim ke semua shohibul via WA
☐ Shohibul sudah buka link & izinkan push notification
☐ Powerbank & charger tersedia
☐ Admin dashboard accessible
☐ Backup plan kalau internet mati (offline mode ON)

HARI-H:
☐ Semua petugas online di dashboard
☐ Admin monitoring aktif
☐ Push notification berjalan normal
☐ Setiap hewan minimal punya foto sembelih
☐ Progress bar hijau semua di akhir hari

POST-EVENT:
☐ Semua media sudah ter-upload (sync complete)
☐ Semua shohibul dapat push notif final
☐ Backup media ke Google Drive / external
☐ Laporan akhir di-generate
☐ Evaluasi untuk tahun depan
```

---

## 🏁 KESIMPULAN

```
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   SCAN → JEPRET → OTOMATIS SAMPAI                    ║
║                                                      ║
║   QR Code di hewan = jembatan antara                 ║
║   petugas lapangan dan shohibul qurban.              ║
║                                                      ║
║   AUTO-ASSIGN:                                       ║
║   Petugas scan QR → foto → foto OTOMATIS muncul     ║
║   di portal SEMUA shohibul yang terkait hewan itu.   ║
║   Tanpa kirim manual. Satu jepret, 7 orang dapat.   ║
║                                                      ║
║   NOTIFIKASI:                                        ║
║   Web Push Notification — GRATIS, real-time,         ║
║   tanpa WhatsApp API. Muncul di HP shohibul          ║
║   meskipun browser ditutup.                          ║
║                                                      ║
║   BIAYA:                                             ║
║   Nyaris Rp 0/tahun setelah development.             ║
║   Cuma bayar domain.                                 ║
║                                                      ║
║   Petugas: Scan → Foto → Next                        ║
║   Shohibul: Buka Link → Izinkan Notif → Terima Update║
║   Admin: Dashboard → Semua Terkontrol                ║
║                                                      ║
║   Simple. Rapi. Satset! 🚀                           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

---

# 🔐 DIFERENSIASI HALAMAN & SISTEM KEAMANAN QURTEK

---

## PART 1: DIFERENSIASI HALAMAN

### Prinsip Utama

```
SHOHIBUL dan PETUGAS tidak pernah saling melihat
halaman satu sama lain. Mereka masuk dari
PINTU YANG BERBEDA, melihat RUANGAN YANG BERBEDA,
dan melakukan HAL YANG BERBEDA.

Ibaratnya:
🏥 Rumah Sakit
├── Pasien   → masuk dari lobi depan, lihat hasil lab
├── Dokter   → masuk dari pintu khusus, isi rekam medis
└── Direktur → masuk dari lantai atas, lihat dashboard

Mereka di gedung yang sama, tapi tidak pernah
nyasar ke ruangan orang lain.
```

---

### 🚪 Tiga Pintu Masuk Berbeda

```
QURTEK PUNYA 3 URL YANG SEPENUHNYA TERPISAH:

╔═══════════════════════════════════════════════════════╗
║                                                       ║
║  👤 SHOHIBUL                                          ║
║  URL: qurtek.id/d/aBc123xYz     ← Link unik per orang║
║  Masuk: Klik link dari WA                             ║
║  Lihat: Status & dokumentasi qurban miliknya          ║
║                                                       ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  📸 PETUGAS                                           ║
║  URL: qurtek.id/petugas                               ║
║  Masuk: PIN 6 digit dari admin                        ║
║  Lihat: Kamera, QR scanner, checklist                 ║
║                                                       ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  🔑 ADMIN                                             ║
║  URL: qurtek.id/admin                                 ║
║  Masuk: Username + Password                           ║
║  Lihat: Dashboard, kelola semua data                  ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

```
KENAPA TIDAK MEMBINGUNGKAN?

Shohibul TIDAK PERNAH TAHU bahwa halaman petugas ada.
├── Mereka hanya punya 1 link: qurtek.id/d/aBc123xYz
├── Link itu langsung masuk ke portal MEREKA
├── Tidak ada tombol "Login", "Pindah ke Petugas", dll
├── Tidak ada navigasi ke halaman lain
└── Portal shohibul = halaman mandiri, terisolasi total

Petugas TIDAK PERNAH melihat portal shohibul.
├── Mereka hanya buka: qurtek.id/petugas
├── Langsung masuk ke mode kamera & scan
├── Tidak ada akses ke data personal shohibul
└── Interface 100% fokus ke dokumentasi
```

---

### 🎨 Perbedaan Visual yang Tegas

#### HALAMAN SHOHIBUL — Tenang, Informatif, Read-Only

```
WARNA DOMINAN: Hijau (kesan islami, tenang, adem)

┌────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← Header hijau
│  🕌 QURTEK                             │
│  Universitas Gadjah Mada               │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                                        │
│  Assalamu'alaikum,                     │
│  Pak Ahmad Fauzi 👋                    │
│                                        │
│  ┌─── Kartu Status ──────────────┐    │
│  │ 🐄 Sapi - Kelompok 3          │    │
│  │ 🟢 Sedang Diproses            │    │
│  └────────────────────────────────┘    │
│                                        │
│  📍 Timeline (scroll ke bawah)         │
│  🖼️ Galeri Foto/Video                  │
│  📥 Tombol Download                    │
│                                        │
│  TIDAK ADA:                            │
│  ❌ Tombol kamera                      │
│  ❌ Tombol scan QR                     │
│  ❌ Tombol upload                      │
│  ❌ Form input apapun                  │
│  ❌ Navigasi ke halaman lain           │
│  ❌ Menu / sidebar                     │
│                                        │
│  Yang ada HANYA:                       │
│  ✅ Lihat status                       │
│  ✅ Lihat foto & video                 │
│  ✅ Download                           │
│  ✅ Share ke sosmed                    │
│                                        │
└────────────────────────────────────────┘

KESAN: Seperti buka tracking paket di marketplace.
       Tinggal lihat, tidak perlu klik macam-macam.
       Kakek-nenek pun bisa paham.
```

#### HALAMAN PETUGAS — Bold, Action-Oriented, Camera-First

```
WARNA DOMINAN: Biru tua + Kuning aksen (kesan profesional, tegas)

┌────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← Header biru tua
│  📸 QURTEK PETUGAS                     │
│  Area: A | 👤 Udin                     │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                                        │
│  ┌────────────────────────────────┐    │
│  │                                │    │
│  │     [ 📷 SCAN QR HEWAN ]      │    │ ← Tombol besar
│  │     (tap untuk mulai scan)     │    │    mencolok
│  │                                │    │
│  └────────────────────────────────┘    │
│                                        │
│  Hari ini kamu sudah dokumentasi:      │
│  ✅ HWN-001 (Sapi)  - 7/7 tahap      │
│  🔄 HWN-005 (Sapi)  - 3/7 tahap      │
│  ⬜ HWN-012 (Kambing) - belum mulai   │
│                                        │
│  TIDAK ADA:                            │
│  ❌ Data personal shohibul             │
│  ❌ Nomor WhatsApp shohibul            │
│  ❌ Status tracking ala shohibul       │
│  ❌ Galeri download                    │
│                                        │
│  Yang ada HANYA:                       │
│  ✅ Tombol scan QR (besar, di atas)    │
│  ✅ Kamera & video                     │
│  ✅ Checklist tahapan                  │
│  ✅ List hewan yang sudah/belum        │
│                                        │
│  ⚡ 3 media pending upload...          │
│                                        │
└────────────────────────────────────────┘

KESAN: Seperti aplikasi scanner/kamera kerja.
       Buka → Scan → Jepret → Selesai.
       Minimalis, action-focused.
```

#### HALAMAN ADMIN — Data-Dense, Full Control

```
WARNA DOMINAN: Putih + Hitam + Aksen Merah (kesan dashboard pro)

┌──────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│  🔑 QURTEK ADMIN PANEL                           │
│  Universitas Gadjah Mada - Idul Adha 1447H       │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                                                  │
│  Sidebar:          Main Content:                 │
│  ├─ Dashboard      [Statistik, Grafik, Tabel]   │
│  ├─ Shohibul                                     │
│  ├─ Hewan                                        │
│  ├─ Petugas                                      │
│  ├─ Dokumentasi                                  │
│  ├─ Distribusi                                   │
│  ├─ Link Manager                                 │
│  └─ Laporan                                      │
│                                                  │
└──────────────────────────────────────────────────┘

KESAN: Dashboard admin klasik.
       Tabel data, statistik, full control.
       Hanya diakses oleh panitia inti.
```

---

### 📊 Rangkuman Perbedaan 3 Halaman

```
┌──────────────┬──────────────┬───────────────┬──────────────┐
│              │  SHOHIBUL    │  PETUGAS      │  ADMIN       │
├──────────────┼──────────────┼───────────────┼──────────────┤
│ URL          │ /d/{token}   │ /petugas      │ /admin       │
│ Warna        │ 🟢 Hijau     │ 🔵 Biru Tua   │ ⚫ Hitam/Putih│
│ Masuk via    │ Link unik WA │ PIN 6 digit   │ User + Pass  │
│ Kamera       │ ❌           │ ✅            │ ❌           │
│ QR Scan      │ ❌           │ ✅            │ ❌           │
│ Upload       │ ❌           │ ✅            │ ✅           │
│ Lihat Foto   │ ✅ Miliknya  │ ❌            │ ✅ Semua     │
│ Download     │ ✅           │ ❌            │ ✅           │
│ Tracking     │ ✅ Miliknya  │ ❌            │ ✅ Semua     │
│ Edit Data    │ ❌           │ ❌            │ ✅           │
│ Notif Push   │ ✅ Terima    │ ❌            │ ✅ Kirim     │
│ Sidebar/Menu │ ❌           │ ❌            │ ✅           │
│ Login/Logout │ ❌ Langsung  │ ✅ PIN        │ ✅ Full Auth │
│ Branding     │ "QURTEK"    │ "QURTEK      │ "QURTEK     │
│              │              │  PETUGAS"     │  ADMIN"     │
│ Orientasi    │ Informatif   │ Action/Camera │ Manajemen   │
│ Kompleksitas │ Sangat Simpel│ Simpel        │ Kompleks    │
└──────────────┴──────────────┴───────────────┴──────────────┘
```

---

### 🧠 Mental Model: Kenapa Tidak Bingung?

```
ANALOGI KEHIDUPAN NYATA:

🛒 Tokopedia/Shopee:
├── PEMBELI buka Tokopedia → lihat produk, tracking pesanan
├── PENJUAL buka Seller Center → kelola toko, kirim barang
├── Pembeli TIDAK PERNAH nyasar ke Seller Center
└── Karena URL-nya beda, tampilannya beda, aksesnya beda

📦 Ekspedisi (JNE/JNT):
├── PENGIRIM → input resi, cetak label
├── KURIR → scan barcode, update status
├── PENERIMA → cek tracking via nomor resi
└── Penerima TIDAK PERNAH lihat dashboard kurir

🕌 Qurtek sama persis:
├── ADMIN → kelola data (dashboard)
├── PETUGAS → scan & foto (kamera)
├── SHOHIBUL → lihat status & dokumentasi (tracking)
└── Masing-masing hanya lihat "dunia"-nya sendiri
```

---

## PART 2: SISTEM KEAMANAN

### 🏗️ Arsitektur Keamanan

```
┌──────────────────────────────────────────────────────┐
│                  SECURITY LAYERS                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Layer 1: 🚪 AUTHENTICATION (Siapa kamu?)            │
│  ├── Shohibul : Unique Token di URL                  │
│  ├── Petugas  : PIN 6 digit + device binding         │
│  └── Admin    : Username + Password + Session        │
│                                                      │
│  Layer 2: 🔒 AUTHORIZATION (Boleh ngapain?)          │
│  ├── Shohibul : Read-only, hanya data miliknya       │
│  ├── Petugas  : Upload-only, hanya area tugasnya     │
│  └── Admin    : Full access semua data               │
│                                                      │
│  Layer 3: 🛡️ PROTECTION (Serangan luar?)             │
│  ├── Rate Limiting                                   │
│  ├── HTTPS Everywhere                                │
│  ├── Input Validation                                │
│  └── CORS Policy                                     │
│                                                      │
│  Layer 4: 📦 DATA SAFETY (Data aman?)                │
│  ├── Database backup otomatis                        │
│  ├── Media di cloud storage (redundant)              │
│  └── Expired token cleanup                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### 🔐 LAYER 1 — AUTHENTICATION (Detail per Role)

#### 👤 Keamanan Akses Shohibul

```
MEKANISME: UNIQUE TOKEN (Cryptographically Random)

URL: qurtek.id/d/aBc123xYz
                  ──────────
                  └── Token unik 10 karakter
                      (huruf besar + kecil + angka)

BAGAIMANA TOKEN DIBUAT:
━━━━━━━━━━━━━━━━━━━━━━

  import { nanoid } from 'nanoid';
  
  const token = nanoid(10);
  // Output: "aBc123xYz" (random, unik per shohibul)
  // Kemungkinan kombinasi: 62^10 = 839 TRILIUN
  // → Mustahil ditebak secara acak

KENAPA AMAN TANPA PASSWORD?
━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ Token random 10 karakter = 839 triliun kombinasi
     Orang tidak bisa asal tebak URL dan masuk
  
  ✅ Token hanya dikirim via WA ke shohibul ybs
     Hanya orang yang punya link yang bisa akses
  
  ✅ Tidak ada halaman "Cari Shohibul" yang publik
     Tidak bisa browsing data orang lain
  
  ✅ Data yang ditampilkan TIDAK sensitif
     Hanya: nama, status qurban, foto/video proses
     BUKAN: alamat, KTP, rekening, data keuangan
  
  ✅ Prinsip sama seperti:
     - Google Docs "Anyone with link can view"
     - Google Photos shared album
     - WeTransfer download link
     → Aman selama link tidak disebar sembarangan

BAGAIMANA KALAU LINK BOCOR/DISEBAR?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Dampaknya RENDAH, karena:
  ├── Data yang terlihat hanya nama + foto qurban
  ├── Tidak ada data finansial / pribadi sensitif
  ├── Tidak bisa edit atau hapus apapun (read-only)
  └── Admin bisa regenerate token baru jika perlu

  ┌────────────────────────────────────────┐
  │  🔄 Admin Panel > Kelola Shohibul      │
  │                                        │
  │  Ahmad Fauzi                           │
  │  Token: aBc123xYz                      │
  │  [🔄 Generate Token Baru]             │
  │  → Token lama langsung invalid         │
  │  → Shohibul dapat link baru via WA     │
  └────────────────────────────────────────┘
```

#### 📸 Keamanan Akses Petugas

```
MEKANISME: PIN 6 DIGIT + DEVICE RECOGNITION

FLOW LOGIN PETUGAS:
━━━━━━━━━━━━━━━━━━

  ┌────────────────────────────────────┐
  │  📸 QURTEK PETUGAS                 │
  │                                    │
  │  Masukkan PIN Anda:                │
  │                                    │
  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  │
  │  │ 7│ │ 2│ │ 9│ │ 1│ │ 0│ │ 5│  │
  │  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘  │
  │                                    │
  │  [🔓 Masuk]                        │
  │                                    │
  └────────────────────────────────────┘

KENAPA PIN DAN BUKAN PASSWORD?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Konteks: Hari H qurban itu HECTIC.
  ├── Petugas tangan bisa kotor/basah
  ├── Harus cepat login, tidak ada waktu ketik panjang
  ├── PIN 6 digit bisa diketik 2 detik
  └── Cukup aman karena ada proteksi tambahan (di bawah)

PROTEKSI TAMBAHAN:
━━━━━━━━━━━━━━━━━

  1. 🚫 BRUTE FORCE PROTECTION
     ├── Maksimal 5x salah PIN → akun terkunci 15 menit
     ├── Setelah 10x salah → terkunci permanen
     └── Admin harus unlock manual

     ┌─────────────────────────────────────┐
     │  ⚠️ PIN salah 3x                    │
     │  Sisa percobaan: 2                  │
     │  Akun akan terkunci jika 5x salah   │
     └─────────────────────────────────────┘

  3. 🕐 SESSION TIMEOUT
     ├── Session aktif selama 12 jam (1 hari kerja qurban)
     ├── Setelah 12 jam → harus login ulang
     └── Admin bisa force-logout petugas dari dashboard

  4. 📍 AKSES TERBATAS
     ├── Petugas HANYA bisa:
     │   ├── Scan QR
     │   ├── Buka kamera
     │   ├── Upload foto/video
     │   └── Update checklist tahapan
     └── Petugas TIDAK bisa:
         ├── Lihat data personal shohibul
         ├── Lihat nomor WA shohibul
         ├── Hapus foto/video yang sudah upload
         ├── Akses data hewan di luar area-nya
         └── Masuk ke halaman admin
```

#### 🔑 Keamanan Akses Admin

```
MEKANISME: USERNAME + PASSWORD + SESSION MANAGEMENT

  ┌────────────────────────────────────┐
  │  🔑 QURTEK ADMIN                   │
  │                                    │
  │  Username : [admin_ugm         ]   │
  │  Password : [••••••••••••••    ]   │
  │                                    │
  │  [🔓 Login]                        │
  │                                    │
  └────────────────────────────────────┘

PROTEKSI ADMIN:
━━━━━━━━━━━━━━

  1. PASSWORD REQUIREMENTS
     ├── Minimal 12 karakter
     ├── Kombinasi huruf besar, kecil, angka, simbol
     └── Di-hash dengan bcrypt sebelum disimpan di DB

  2. SESSION MANAGEMENT
     ├── Session token di httpOnly cookie
     │   (tidak bisa diakses JavaScript → aman dari XSS)
     ├── Session expire: 8 jam
     └── Satu session per browser (login di tempat lain
         → session lama otomatis logout)

  3. BRUTE FORCE PROTECTION
     ├── 5x salah → kunci 30 menit
     └── 10x salah → kunci permanen, reset via database

  4. ACTIVITY LOG
     └── Semua aksi admin tercatat:
         ├── Login/logout time
         ├── Data yang diubah
         ├── Siapa yang hapus/edit
         └── IP address
```

---

### 🔒 LAYER 2 — AUTHORIZATION (Siapa Boleh Apa?)

```
ROLE-BASED ACCESS CONTROL (RBAC):

┌───────────────────────────────────────────────────────────┐
│                    PERMISSION MATRIX                       │
├──────────────────┬──────────┬───────────┬─────────────────┤
│ RESOURCE         │ SHOHIBUL │ PETUGAS   │ ADMIN           │
├──────────────────┼──────────┼───────────┼─────────────────┤
│                  │          │           │                 │
│ DATA SHOHIBUL    │          │           │                 │
│ ├─ Lihat semua   │ ❌       │ ❌        │ ✅              │
│ ├─ Lihat milik   │ ✅       │ ❌        │ ✅              │
│ │   sendiri      │          │           │                 │
│ ├─ Edit          │ ❌       │ ❌        │ ✅              │
│ └─ Hapus         │ ❌       │ ❌        │ ✅              │
│                  │          │           │                 │
│ DATA HEWAN       │          │           │                 │
│ ├─ Lihat semua   │ ❌       │ ❌        │ ✅              │
│ ├─ Lihat terkait │ ✅ (min) │ ✅ (area) │ ✅              │
│ ├─ Edit          │ ❌       │ ❌        │ ✅              │
│ └─ Hapus         │ ❌       │ ❌        │ ✅              │
│                  │          │           │                 │
│ DOKUMENTASI      │          │           │                 │
│ ├─ Lihat milik   │ ✅       │ ❌        │ ✅              │
│ │   sendiri      │          │           │                 │
│ ├─ Upload        │ ❌       │ ✅        │ ✅              │
│ ├─ Download      │ ✅ milik │ ❌        │ ✅ semua        │
│ └─ Hapus         │ ❌       │ ❌        │ ✅              │
│                  │          │           │                 │
│ STATUS TRACKING  │          │           │                 │
│ ├─ Lihat         │ ✅ milik │ ✅ (area) │ ✅ semua        │
│ └─ Update        │ ❌       │ ✅        │ ✅              │
│                  │          │           │                 │
│ QR SCAN          │ ❌       │ ✅        │ ❌              │
│ KAMERA           │ ❌       │ ✅        │ ❌              │
│ KELOLA PETUGAS   │ ❌       │ ❌        │ ✅              │
│ GENERATE LINK    │ ❌       │ ❌        │ ✅              │
│ GENERATE QR      │ ❌       │ ❌        │ ✅              │
│ EXPORT LAPORAN   │ ❌       │ ❌        │ ✅              │
│                  │          │           │                 │
└──────────────────┴──────────┴───────────┴─────────────────┘
```

### Implementasi di Backend (Middleware)

```javascript
// middleware/authorize.js

const authorize = (allowedRoles) => {
  return (req, res, next) => {
    
    const userRole = req.user.role;
    // "shohibul" | "petugas" | "admin"

    // Cek apakah role-nya boleh akses endpoint ini
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Akses ditolak. Anda tidak punya izin.'
      });
    }

    // Kalau shohibul, pastikan hanya akses data miliknya
    if (userRole === 'shohibul') {
      const requestedShohibulId = req.params.shohibulId;
      if (requestedShohibulId !== req.user.shohibulId) {
        return res.status(403).json({
          error: 'Anda hanya bisa melihat data milik Anda.'
        });
      }
    }

    // Kalau petugas, pastikan hanya akses hewan di area-nya
    if (userRole === 'petugas') {
      const hewanArea = getHewanArea(req.params.hewanId);
      if (hewanArea !== req.user.assignedArea) {
        return res.status(403).json({
          error: 'Hewan ini bukan di area tugas Anda.'
        });
      }
    }

    next();
  };
};

// Penggunaan di routes:

// Shohibul hanya bisa lihat data sendiri
app.get('/api/portal/:token',
  authenticateShohibul,    // Cek token valid
  authorize(['shohibul']), // Hanya role shohibul
  getPortalData
);

// Petugas hanya bisa upload
app.post('/api/dokumentasi/upload',
  authenticatePetugas,     // Cek PIN + session
  authorize(['petugas']),  // Hanya role petugas
  uploadDokumentasi
);

// Admin bisa semua
app.get('/api/admin/dashboard',
  authenticateAdmin,       // Cek username + password
  authorize(['admin']),    // Hanya role admin
  getDashboard
);
```

---

### 🛡️ LAYER 3 — PROTEKSI DARI SERANGAN LUAR

```
1. 🔐 HTTPS EVERYWHERE
   ├── Semua halaman wajib HTTPS (SSL/TLS)
   ├── Vercel otomatis provide SSL certificate
   ├── Data terenkripsi saat transit
   └── Tidak bisa di-sniff orang di jaringan yang sama

2. 🚦 RATE LIMITING
   ├── API call dibatasi per IP:
   │   ├── Shohibul portal : 60 request/menit
   │   ├── Petugas upload  : 30 request/menit
   │   └── Login attempts  : 5 request/menit
   ├── Lebih dari itu → blokir sementara (429 Too Many Requests)
   └── Mencegah brute force & DDoS skala kecil

   // Implementasi:
   import rateLimit from 'express-rate-limit';
   
   const loginLimiter = rateLimit({
     windowMs: 1 * 60 * 1000, // 1 menit
     max: 5,                   // max 5 percobaan
     message: 'Terlalu banyak percobaan. Coba lagi nanti.'
   });
   
   app.post('/api/petugas/login', loginLimiter, handleLogin);

3. 🧹 INPUT VALIDATION & SANITIZATION
   ├── Semua input di-validate sebelum masuk DB
   ├── Mencegah SQL Injection
   ├── Mencegah XSS (Cross-Site Scripting)
   └── Prisma ORM sudah handle SQL injection by default

4. 🌐 CORS POLICY
   ├── Hanya domain qurtek.id yang boleh akses API
   ├── Request dari domain lain → ditolak
   └── Mencegah website lain memanggil API kita

   // next.config.js
   headers: [{
     source: '/api/:path*',
     headers: [{
       key: 'Access-Control-Allow-Origin',
       value: 'https://qurtek.id'
     }]
   }]

5. 📁 FILE UPLOAD SECURITY
   ├── Hanya terima file: .jpg, .jpeg, .png, .mp4, .webm
   ├── Max size: Foto 10MB, Video 100MB (sebelum compress)
   ├── File di-scan mime-type (bukan cuma cek ekstensi)
   ├── Rename file ke random string (cegah path traversal)
   └── Upload ke cloud storage, bukan ke server langsung
```

---

### 📦 LAYER 4 — KEAMANAN DATA

```
1. 🗄️ DATABASE SECURITY
   ├── Database credentials di environment variables
   │   (tidak hardcode di source code)
   ├── Supabase Row Level Security (RLS)
   │   → Shohibul hanya bisa query data miliknya
   ├── Password admin di-hash dengan bcrypt (cost 12)
   └── Database backup otomatis harian (Supabase built-in)

2. 🖼️ MEDIA STORAGE SECURITY
   ├── File disimpan di Cloudflare R2 (bukan di server)
   ├── URL media menggunakan signed URL
   │   → Link gambar expire setelah 24 jam
   │   → Tidak bisa di-share permanen oleh orang lain
   ├── Folder structure tidak bisa di-browse
   └── Direct access ke bucket diblokir

   // Signed URL contoh:
   // ❌ r2.qurtek.id/media/foto123.jpg (bisa diakses siapa saja)
   // ✅ r2.qurtek.id/media/foto123.jpg?token=xyz&expires=1719561600
   //    (hanya valid sampai waktu tertentu)

3. 🧹 DATA CLEANUP
   ├── Token shohibul expire setelah 30 hari post-event
   ├── Media tetap tersimpan 1 tahun (bisa diakses)
   ├── Setelah 1 tahun → admin decide: archive atau hapus
   └── Push subscription dibersihkan setelah event selesai

4. 🔑 ENVIRONMENT VARIABLES
   └── Semua secrets disimpan di env, BUKAN di code:
       ├── DATABASE_URL
       ├── R2_ACCESS_KEY
       ├── R2_SECRET_KEY
       ├── VAPID_PUBLIC_KEY  (untuk Web Push)
       ├── VAPID_PRIVATE_KEY
       ├── SESSION_SECRET
       └── ADMIN_HASH_SALT
```

---

### 🔄 FLOW KEAMANAN LENGKAP (Per Role)

```
═══════════════════════════════════════════════════════
FLOW SHOHIBUL (Klik link → Lihat portal)
═══════════════════════════════════════════════════════

  Shohibul klik: qurtek.id/d/aBc123xYz
       │
       ▼
  [Server] Cek token "aBc123xYz" di database
       │
       ├── ❌ Token tidak ditemukan
       │      → Tampilkan: "Link tidak valid"
       │
       └── ✅ Token valid
              │
              ▼
         Cek apakah token sudah expired?
              │
              ├── ❌ Expired (>30 hari post-event)
              │      → "Dokumentasi sudah tidak tersedia"
              │
              └── ✅ Masih aktif
                     │
                     ▼
                Ambil data shohibul berdasarkan token
                     │
                     ▼
                Ambil data hewan & dokumentasi HANYA
                yang terkait shohibul ini
                     │
                     ▼
                Tampilkan portal (read-only)
                Media URL menggunakan signed URL (expire 24 jam)
                     │
                     ▼
                Minta izin Push Notification
                     │
                     ▼
                Selesai. Shohibul tinggal nunggu update.


═══════════════════════════════════════════════════════
FLOW PETUGAS (Login → Scan → Foto → Upload)
═══════════════════════════════════════════════════════

  Petugas buka: qurtek.id/petugas
       │
       ▼
  Masukkan PIN 6 digit
       │
       ▼
  [Server] Cek PIN di database
       │
       ├── ❌ PIN salah
       │      ├── Attempt < 5  → "PIN salah, coba lagi"
       │      ├── Attempt = 5  → Kunci 15 menit
       │      └── Attempt = 10 → Kunci permanen
       │
       └── ✅ PIN cocok
              │
              ▼
         Cek device fingerprint
              │
              ├── 🆕 Device baru (login pertama)
              │      → Simpan fingerprint, lanjut
              │
              ├── ✅ Device cocok dengan yang tersimpan
              │      → Lanjut
              │
              └── ❌ Device berbeda
                     → "Device tidak dikenali.
                        Hubungi admin untuk verifikasi."
              │
              ▼
         Buat session token (JWT, expire 12 jam)
         Simpan di httpOnly cookie
              │
              ▼
         Tampilkan halaman petugas
         (Scan QR, Kamera, Checklist)
              │
              ▼
         Petugas scan QR hewan
              │
              ▼
         [Server] Cek: apakah hewan ini di area petugas?
              │
              ├── ❌ Beda area → "Hewan ini bukan area Anda"
              │
              └── ✅ Area cocok → Buka mode kamera & checklist
                     │
                     ▼
                Petugas ambil foto/video
                     │
                     ▼
                [Client] Compress media
                     │
                     ▼
                [Client] Upload ke server + R2
                     │
                     ▼
                [Server] Simpan record di tabel `dokumentasi`
                Linked ke hewan_id (dari QR)
                     │
                     ▼
                [Server] AUTO-ASSIGN:
                Query semua shohibul di kelompok hewan ini
                     │
                     ▼
                [Server] Kirim Web Push ke semua shohibul
                yang subscribe
                     │
                     ▼
                Foto/video muncul di portal semua
                shohibul terkait. SELESAI.


═══════════════════════════════════════════════════════
FLOW ADMIN (Login → Kelola → Monitor)
═══════════════════════════════════════════════════════

  Admin buka: qurtek.id/admin
       │
       ▼
  Masukkan Username + Password
       │
       ▼
  [Server] Cek credentials
       │
       ├── ❌ Salah → brute force protection (sama seperti petugas)
       │
       └── ✅ Cocok
              │
              ▼
         Buat session (httpOnly cookie, expire 8 jam)
         Catat di activity log: "Admin login at [waktu] from [IP]"
              │
              ▼
         Full akses ke semua fitur:
         Dashboard, CRUD, Laporan, dll.
```

---

## ✅ RANGKUMAN

```
╔═════════════════════════════════════════════════════════╗
║                                                         ║
║  DIFERENSIASI:                                          ║
║  ─────────────                                          ║
║  3 halaman TERPISAH TOTAL. Beda URL, beda warna,       ║
║  beda fitur, beda cara masuk. Shohibul tidak pernah     ║
║  tahu halaman petugas ada. Petugas tidak pernah         ║
║  lihat data shohibul. Tidak ada navigasi lintas role.   ║
║                                                         ║
║  KEAMANAN:                                              ║
║  ─────────                                              ║
║  4 layer proteksi:                                      ║
║  1. Authentication → siapa kamu? (token/PIN/password)   ║
║  2. Authorization  → boleh apa? (RBAC ketat)            ║
║  3. Protection     → serangan luar (rate limit, HTTPS)  ║
║  4. Data safety    → backup, signed URL, cleanup        ║
║                                                         ║
║  Setiap role hanya bisa mengakses data dan fitur        ║
║  yang MEMANG DIPERUNTUKKAN untuk mereka.                ║
║  Tidak lebih, tidak kurang.                             ║
║                                                         ║
╚═════════════════════════════════════════════════════════╝
```

---
