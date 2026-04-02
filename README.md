# QURTEK

Dokumentasi Sampai, Shohibul Tenang.

Platform dokumentasi qurban berbasis Next.js + Supabase dengan 3 role terpisah:
- Admin: ` /admin `
- Petugas: ` /petugas `
- Shohibul: ` /d/{token} `

## Fitur yang sudah diimplementasikan

- Panel Admin dengan login username/password.
- CRUD data Shohibul, Hewan, dan Petugas.
- Generate link unik Shohibul + template pesan WhatsApp.
- Generate QR code hewan.
- Portal Petugas dengan login PIN, QR scanner kamera, checklist tahapan, upload media.
- Upload media ke Supabase Storage bucket `qurban_media`.
- Auto update status tracking dan auto push notification saat tahap selesai.
- Portal Shohibul real-time: status timeline + galeri + download ZIP.
- PWA service worker + web push subscription flow.
- SQL schema lengkap sesuai plan di file `supabase/schema.sql`.

## 1) Setup environment variables

Salin `.env.example` menjadi `.env.local`, lalu isi nilainya:

```bash
cp .env.example .env.local
```

Wajib diisi:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Opsional:
- `NEXT_PUBLIC_STORAGE_BUCKET` (default: `qurban_media`)
- `VAPID_SUBJECT` (default: `mailto:admin@qurtek.id`)

## 2) Jalankan schema SQL di Supabase

1. Buka Supabase SQL Editor.
2. Copy isi file `supabase/schema.sql`.
3. Jalankan query sampai selesai.
4. Buka menu Storage dan pastikan bucket `qurban_media` ada.

## 3) Jalankan aplikasi lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## 4) Urutan penggunaan di aplikasi

1. Login admin di ` /admin `.
2. Tambah data hewan, shohibul, petugas.
3. Generate QR hewan dan tempel ke kalung/tali hewan.
4. Petugas login di ` /petugas ` pakai PIN.
5. Petugas scan QR / input kode, upload media per tahap, klik selesai tahap.
6. Shohibul buka link unik ` /d/{token} `, izinkan notifikasi, pantau dokumentasi.

## 5) Deploy

Deploy ke Vercel, lalu masukkan semua environment variable yang sama seperti `.env.local`.

## Catatan penting

- Notifikasi web push membutuhkan VAPID keys valid.
- API admin menggunakan cookie session berbasis environment variable.
- Untuk produksi, wajib gunakan password admin kuat dan `ADMIN_SESSION_SECRET` acak panjang.
