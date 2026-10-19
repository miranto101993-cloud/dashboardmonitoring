# Panduan Pasang Rinci (GitHub → Netlify)

## A. Akun (gratis)
1. GitHub: https://github.com/signup  2. Netlify: https://app.netlify.com/signup (Sign up with GitHub)

## B. Unggah ke GitHub
1. Ekstrak zip. 2. GitHub: **+ → New repository** → nama `dashboard-mitra10`, **Private**, tanpa README → Create.
3. **uploading an existing file** → Ctrl+A semua isi folder (termasuk folder `public` & `netlify`) → seret → **Commit changes** (unggah bertahap bila ditolak).
   Untuk memperbarui versi: hapus isi lama / timpa dengan isi zip baru, lalu Commit.

## C. Netlify
**Add new project → Import an existing project → GitHub** → pilih repo. Build command kosong, Publish directory `public`, Functions `netlify/functions` → **Deploy**.

## D. Password
**Project configuration → Environment variables**: `ADMIN_PASSWORD` (wajib), `VIEW_PASSWORD` (disarankan), `AUTH_SECRET` (opsional, teks acak). Simpan.

## E. Deploy ulang
**Deploys → Trigger deploy → Deploy site** → tunggu **Published**.

## F. Hak akses
- **Viewer**: melihat semua menu KECUALI **Data Customer** dan **Upload Data**.
- **Admin**: semua menu + upload data. Data Customer (database member & transaksi member) hanya dikirim server ke Admin — bukan sekadar disembunyikan di tampilan.
- Admin pertama kali login setelah versi ini: data tersimpan lama otomatis dimigrasi (±4 detik) agar data customer terpisah dan terlindungi.

## G. Memperbarui data
Admin: Upload Data → upload file → tunggu "Tersimpan". Viewer otomatis memuat ulang ≤20 detik.

## H. Jika data belum ikut berubah di perangkat lain
1. Status di halaman Upload harus hijau "Tersimpan (… bagian)"; merah = lihat pesan (HTTP 401 = login admin kedaluwarsa → Keluar, login admin lagi).
2. Pastikan di bawah menu kiri tertulis "Masuk sebagai Admin".
3. Di perangkat lain buka Console (F12) → `__siteCheck()` → bandingkan `tersimpanDiServer`.
4. SQV/Stock DC/Salper bertanggal lebih lama dari data bawaan tidak menimpa data bawaan.
