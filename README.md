# Performance Dashboard – Mitra10 Yogyakarta (Website + Server)
Data bersama untuk semua pengguna; admin upload → server (Netlify Blobs). Login per-user (user+password), minta akses → disetujui admin; Data Customer & Upload Data khusus Admin. Tampilan mobile ramah.
Struktur: `public/` (halaman), `netlify/functions/api.mjs` (backend), `netlify/data/` (data bawaan, hanya setelah login).
Admin utama bawaan: miranto.101993@gmail.com. Env Netlify opsional: ADMIN_USER+ADMIN_PASSWORD, AUTH_SECRET. Langkah rinci: PANDUAN_PASANG.md.
Diuji lokal (server Node + Blobs tiruan), belum di Netlify sungguhan.
