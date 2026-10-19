# Performance Dashboard – Mitra10 Yogyakarta (Website + Server)
Data bersama untuk semua pengguna; admin upload → server (Netlify Blobs). Login Admin/Viewer; Data Customer & Upload Data khusus Admin. Tampilan mobile ramah.
Struktur: `public/` (halaman), `netlify/functions/api.mjs` (backend), `netlify/data/` (data bawaan, hanya setelah login).
Env Netlify: ADMIN_PASSWORD (wajib), VIEW_PASSWORD (disarankan), AUTH_SECRET (opsional). Langkah rinci: PANDUAN_PASANG.md.
Diuji lokal (server Node + Blobs tiruan), belum di Netlify sungguhan.
