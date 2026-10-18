# Performance Dashboard – Mitra10 Yogyakarta (versi Website + Server)

Semua pengguna melihat data yang **sama**. Admin meng-upload data dari menu **Upload Data** → tersimpan di server (Netlify Blobs) → pengguna lain mendapat data terbaru (muncul banner "Muat ulang").
Tampilan mobile ramah (menu drawer, filter bisa dilipat, tabel bisa digeser, bisa di-"Add to Home Screen").

## Struktur
- `public/` – halaman (index.html tanpa data; data dilayani server setelah login)
- `netlify/functions/api.mjs` – backend (login, data bawaan, penyimpanan bersama)
- `netlify/data/` – data bawaan (hanya dapat diunduh setelah login)
- `netlify.toml`, `package.json`

## Cara pasang (GitHub → Netlify)
1. Upload seluruh isi folder ini ke repository GitHub (**private** disarankan).
2. Netlify → *Add new site → Import from Git* → pilih repo. Build command kosong, publish dir `public` (sudah di netlify.toml).
3. Site configuration → *Environment variables*, isi:
   - `ADMIN_PASSWORD` (wajib) – password admin (boleh upload data)
   - `VIEW_PASSWORD` (disarankan) – password pengguna biasa (hanya lihat). Jika kosong, siapa pun yang tahu URL bisa melihat.
   - `AUTH_SECRET` (opsional) – teks acak panjang untuk menandatangani sesi.
4. Deploy ulang (Deploys → Trigger deploy).

## Cara pakai
- Buka website → masukkan password. Viewer: hanya melihat. Admin: menu *Upload Data* muncul (atau klik "Login Admin" di bawah menu kiri).
- Admin upload file seperti biasa; data otomatis tersimpan di server untuk semua pengguna. "Reset ke Data Bawaan" mengembalikan ke data bawaan deploy.
- Untuk mengganti data bawaan secara permanen, bangun ulang paket ini dari dashboard terbaru.

## Catatan
- Data penuh ±36 MB (terkompres ±9 MB di server) – masuk kuota gratis Netlify Blobs, namun perhatikan batas fungsi/bandwidth paket Netlify Anda.
- Password salah ditunda ±1 detik; sesi admin 12 jam, viewer 30 hari.
- Paket ini diuji lokal (server Node + penyimpanan tiruan), belum di Netlify sungguhan.
