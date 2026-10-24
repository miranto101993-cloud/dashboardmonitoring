# Performance Dashboard – Mitra10 Yogyakarta (Website + Server)
Data bersama untuk semua pengguna; admin upload → server (Netlify Blobs). Login per-user (user+password), minta akses → disetujui admin; Data Customer & Upload Data khusus Admin. Tampilan mobile ramah.
Struktur: `public/` (halaman), `netlify/functions/api.mjs` (backend), `netlify/data/` (data bawaan, hanya setelah login).
Admin utama bawaan: miranto.101993@gmail.com. Env Netlify opsional: ADMIN_USER+ADMIN_PASSWORD, AUTH_SECRET. Langkah rinci: PANDUAN_PASANG.md.
Diuji lokal (server Node + Blobs tiruan), belum di Netlify sungguhan.

## Pembaruan: kriteria permintaan akses & halaman Salesperson
- Minta akses punya 3 kriteria: **Manager** (= Admin: semua menu + Upload Data + Data Customer, tanpa Kelola Pengguna), **Team Leader** (semua menu kecuali Data Customer & Upload Data; admin utama bisa menaikkan ke Admin) dan **Sales** (user = Salesperson ID, nama harus memuat salah satu kata nama di database, password min. 8 karakter).
- Halaman Salesperson: Ranking, Actual, Budget, Achieve, Sales LY, Growth, Diff Budget, Diff Growth, Sales by Brand, Protection, Project, WhatsApp, Invoice, IPD, IPI, Basket Size; filter YTD / Semester / Kuartal / Bulan (+ Minggu) / Tanggal.
- Master Brand dicocokkan lewat master brand tiap item; bulan terakhir diambil dari data yang benar-benar ada (termasuk hasil upload admin).
- Setelah deploy, unggah ulang file penjualan terbaru (mis. Oktober) agar invoice Project/WhatsApp & Sales by Brand terisi untuk bulan yang diunggah sebelum pembaruan ini.

## Kunci unggah (mencegah data tertimpa)
Saat admin memilih file untuk diunggah, server memberi "kunci" ke admin itu (berlaku 8 menit, dilepas otomatis setelah tersimpan). Admin lain yang mencoba mengunggah/menyimpan pada saat itu mendapat pesan "sedang dikunci". Server juga menolak penyimpanan dari halaman yang datanya sudah lebih lama dari versi terbaru di server (muncul pesan "Data sudah diperbarui admin lain" → muat ulang, lalu unggah ulang file).

## Belting untuk Sales Private Brand
Login Sales dengan Master Brand "Private Brand" mendapat tab **Belting** (posisi terakhir, skor, riwayat). File belting tidak memiliki ID Salper, jadi pencocokan dilakukan lewat **nama** (singkatan/salah ketik kecil ditoleransi; nama yang ambigu tidak ditampilkan agar tidak salah orang). Setiap sales hanya melihat belting miliknya sendiri.

## Sales by Brand (Private Brand)
Untuk Salesperson Private Brand, "Sales by Brand" = penjualan Private Brand + Exclusive Brand (Master Type Brand) milik salesperson itu sendiri, hanya pada kategori di dalam zonanya sendiri (data per salesperson per kategori: `spCatFact`).
