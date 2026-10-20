# Panduan Pasang Rinci (GitHub → Netlify)

## A. Akun (gratis)
1. GitHub: https://github.com/signup  2. Netlify: https://app.netlify.com/signup (Sign up with GitHub)

## B. Unggah ke GitHub
1. Ekstrak zip. 2. GitHub: **+ → New repository** → nama `dashboard-mitra10`, **Private**, tanpa README → Create.
3. **uploading an existing file** → Ctrl+A semua isi folder (termasuk folder `public` & `netlify`) → seret → **Commit changes** (unggah bertahap bila ditolak).
   Untuk memperbarui versi: hapus isi lama / timpa dengan isi zip baru, lalu Commit.

## C. Netlify
**Add new project → Import an existing project → GitHub** → pilih repo. Build command kosong, Publish directory `public`, Functions `netlify/functions` → **Deploy**.

## D. Akun admin utama
Admin utama bawaan sudah ada: user `miranto.101993@gmail.com` (password tersimpan sebagai hash di backend, tidak ada teks aslinya di repo). Tidak perlu mengisi variabel apa pun untuk bisa login admin.
Opsional di Netlify → Environment variables: `ADMIN_USER` + `ADMIN_PASSWORD` (admin utama kedua), `AUTH_SECRET` (teks acak panjang). `VIEW_PASSWORD` tidak dipakai lagi.

## E. Deploy ulang
**Deploys → Trigger deploy → Deploy site** → tunggu **Published**.

## F. Pengguna & hak akses
- Siapa pun yang membuka situs harus login dengan **user + password**.
- **Cara login admin:** buka link → pilih tab **Admin** → isi user/email & password → Masuk. Pengguna biasa memilih tab **Pengguna**.
- Orang baru: klik **"Belum punya akun? Minta akses"** → isi nama, user, password → permintaan masuk antrian.
- **Hanya admin utama (`miranto.101993@gmail.com`)** yang punya menu **Kelola Pengguna**. Admin lain tetap bisa Upload Data & Data Customer, tapi tidak bisa mengelola pengguna.
- Admin utama: login → menu kiri bawah **Kelola Pengguna** → **Setujui Viewer / Setujui Admin / Tolak**; juga bisa **Tambah user langsung**, **Jadikan Admin/Viewer**, **Nonaktifkan**, **Reset password**, **Hapus akses**. Hapus/nonaktifkan memutus akses saat itu juga.
- **Viewer**: semua menu KECUALI **Data Customer** dan **Upload Data**. **Admin**: semua + Upload Data + Data Customer (tanpa Kelola Pengguna). Data Customer hanya dikirim server ke Admin.
- **Salesperson** (user = Salesperson ID, mis. `S80000-0000000401`): hanya melihat halaman **Performa Saya** — Sales miliknya + master brand-nya + detail penjualan item master brand-nya (otomatis dari database Salesperson), dengan filter YTD / Semester / Kuartal / Bulan / Tanggal. Data orang lain & menu lain TIDAK dikirim server ke akunnya. Dibuat oleh admin utama lewat Kelola Pengguna → *Akun Salesperson* (satu per satu, banyak sekaligus, atau semua yang belum punya akun; password acak ditampilkan sekali + unduh CSV untuk dibagikan). Orang juga bisa Minta Akses memakai ID-nya, lalu admin pilih *Setujui Salesperson*.
- Master brand tanpa data brand (Kasir, Team Leader, Project, SM / DSM, Penyu) hanya menampilkan Sales pribadi; master brand *Private Brand* memakai data penjualan Private Brand.
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

## Permintaan akses (aturan)
- User **wajib** Salesperson ID yang terdaftar (contoh `S80000-0000000449`), password minimal 8 karakter.
- Nama harus mengandung **salah satu kata** dari nama di database Salesperson (contoh nama `Satriyo Adi Nugroho` → boleh `satriyo`, `adi`, atau `nugroho`).
- Admin utama menyetujui lewat Kelola Pengguna → *Setujui Salesperson*.

## Data Salesperson
- Master brand biasa: sales brand + detail item brand, filter YTD/Semester/Kuartal/Bulan/Tanggal (item per tanggal tersedia untuk tahun berjalan).
- Master brand **Private Brand**: penjualan *Private Brand + Exclusive Brand* (Master Type Brand) pada **zona masing-masing**, per brand, per kategori, dan per item.
