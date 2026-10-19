# Panduan Pasang Rinci (GitHub → Netlify)

## A. Akun (gratis)
1. GitHub: https://github.com/signup  2. Netlify: https://app.netlify.com/signup (Sign up with GitHub)

## B. Unggah ke GitHub
1. Ekstrak zip. 2. GitHub: **+ → New repository** → nama `dashboard-mitra10`, **Private**, tanpa README → Create.
3. **uploading an existing file** → Ctrl+A semua isi folder (termasuk folder `public` & `netlify`) → seret → **Commit changes** (unggah bertahap bila ditolak).
   Untuk memperbarui versi: hapus isi lama / timpa dengan isi zip baru, lalu Commit.

## C. Netlify
**Add new project → Import an existing project → GitHub** → pilih repo. Build command kosong, Publish directory `public`, Functions `netlify/functions` → **Deploy**.

## D. Akun admin utama (Environment variables)
**Project configuration → Environment variables**:
- `ADMIN_USER` (opsional, bawaan `admin`) – nama user admin utama
- `ADMIN_PASSWORD` (wajib) – password admin utama
- `AUTH_SECRET` (opsional) – teks acak panjang
(`VIEW_PASSWORD` tidak dipakai lagi — setiap orang punya user & password sendiri.)

## E. Deploy ulang
**Deploys → Trigger deploy → Deploy site** → tunggu **Published**.

## F. Pengguna & hak akses
- Siapa pun yang membuka situs harus login dengan **user + password**.
- Orang baru: klik **"Belum punya akun? Minta akses"** → isi nama, user, password → permintaan masuk antrian.
- Admin: login → menu kiri bawah **Kelola Pengguna** → **Setujui Viewer / Setujui Admin / Tolak**; juga bisa **Tambah user langsung**, **Jadikan Admin/Viewer**, **Nonaktifkan**, **Reset password**, **Hapus akses**. Hapus/nonaktifkan memutus akses saat itu juga.
- **Viewer**: semua menu KECUALI **Data Customer** dan **Upload Data**. **Admin**: semua + upload + kelola pengguna. Data Customer hanya dikirim server ke Admin.
- Admin utama (dari Netlify) tidak bisa dihapus. Lupa password admin utama → ganti `ADMIN_PASSWORD` di Netlify & deploy ulang.
- Password disimpan sebagai hash (scrypt), bukan teks asli. Ubah peran / reset password otomatis mengeluarkan sesi lama user itu.
- Catatan: jika dua admin menyimpan perubahan pengguna pada detik yang sama, salah satu bisa tertimpa — ulangi bila perlu.

## G. Memperbarui data
Admin: Upload Data → upload file → tunggu "Tersimpan". Viewer otomatis memuat ulang ≤20 detik.

## H. Jika data belum ikut berubah di perangkat lain
1. Status di halaman Upload harus hijau "Tersimpan (… bagian)"; merah = lihat pesan (HTTP 401 = login admin kedaluwarsa → Keluar, login admin lagi).
2. Pastikan di bawah menu kiri tertulis "Masuk sebagai Admin".
3. Di perangkat lain buka Console (F12) → `__siteCheck()` → bandingkan `tersimpanDiServer`.
4. SQV/Stock DC/Salper bertanggal lebih lama dari data bawaan tidak menimpa data bawaan.
