# Panduan Pasang Rinci (GitHub → Netlify)

## A. Akun (gratis)
1. GitHub: https://github.com/signup  2. Netlify: https://app.netlify.com/signup (Sign up with GitHub)

## B. Unggah ke GitHub
1. Ekstrak zip. 2. GitHub: **+ → New repository** → nama `dashboard-mitra10`, **Private**, tanpa README → Create.
3. **uploading an existing file** → Ctrl+A semua isi folder (termasuk folder `public` & `netlify`) → seret → **Commit changes** (unggah bertahap bila ditolak).

## C. Netlify
**Add new project → Import an existing project → GitHub** → pilih repo. Build command kosong, Publish directory `public`, Functions `netlify/functions` → **Deploy**.

## D. Password
**Project configuration → Environment variables**: `ADMIN_PASSWORD` (wajib, boleh upload), `VIEW_PASSWORD` (disarankan, hanya lihat), `AUTH_SECRET` (opsional, teks acak). Simpan.

## E. Deploy ulang
**Deploys → Trigger deploy → Deploy site** → tunggu **Published**.

## F. Coba
Buka `nama.netlify.app` → login viewer (tanpa menu Upload) → Keluar → login admin (menu Upload Data muncul).

## G. Memperbarui data
Admin: Upload Data → upload file → tunggu status "Tersimpan". Pengguna viewer otomatis memuat ulang ≤20 detik (halaman harus terbuka/aktif); admin lain melihat banner "Muat ulang".

## H. Jika data belum ikut berubah di perangkat lain
1. Di halaman Upload (admin) pastikan status hijau "Tersimpan (… bagian)". Jika merah "Gagal menyimpan…", catat pesannya (mis. HTTP 401 = login admin kedaluwarsa → Keluar lalu login admin lagi; HTTP 500 = Netlify Blobs/ fungsi bermasalah, lihat Netlify → Logs → Functions).
2. Pastikan upload dilakukan saat login **Admin** (di bawah menu kiri tertulis "Masuk sebagai Admin").
3. Di perangkat lain: login, lalu tekan F12 → Console → ketik `__siteCheck()` → bandingkan `tersimpanDiServer` dengan waktu upload.
4. Upload SQV / Stock DC / Salper dengan tanggal laporan LEBIH LAMA dari data bawaan tidak menimpa data bawaan (aturan kunci tanggal).
5. Deploy ulang situs TIDAK menghapus data upload; "Reset ke Data Bawaan" yang menghapusnya.
