# Performance Dashboard — Mitra10 Yogyakarta

Dashboard satu file (`index.html`), data sudah tertanam. Tidak ada build / server.

## Isi
| File | Fungsi |
|---|---|
| `index.html` | Dashboard |
| `netlify.toml`, `_headers` | Pengaturan Netlify (publish folder, header keamanan, noindex) |
| `robots.txt` | Minta mesin pencari tidak mengindeks |
| `.github/workflows/deploy-pages.yml` | Opsional: auto-deploy ke GitHub Pages |
| `.nojekyll`, `.gitignore` | Pendukung GitHub |

## A. Tayang di Netlify (netlify.app)
**Cara cepat (tanpa GitHub):** app.netlify.com/drop → seret folder ini → selesai. Ubah nama situs di *Site configuration → Change site name* (mis. `dashboard-mitra10-yk.netlify.app`).

**Cara otomatis dari GitHub:** Netlify → *Add new site → Import an existing project → GitHub* → pilih repo → *Build command* kosong, *Publish directory* `.` → Deploy. Setiap push ke `main` otomatis tayang ulang.

## B. Simpan di GitHub
```bash
git init
git add .
git commit -m "Dashboard Mitra10 Yogyakarta"
git branch -M main
git remote add origin https://github.com/<username>/<nama-repo>.git
git push -u origin main
```
Buat repository **Private** (data penjualan ada di dalam index.html). GitHub Pages dari repo private butuh akun berbayar; gunakan Netlify untuk tayang.

## C. (Opsional) GitHub Pages
Settings → Pages → Source: **GitHub Actions**. Workflow sudah tersedia. Alamat: `https://<username>.github.io/<nama-repo>/`.

## Memperbarui data
Ganti `index.html` dengan versi terbaru → commit & push (atau seret ulang folder ke Netlify Drop).

## Keamanan — baca
Semua data (penjualan, customer, budget) tertanam di `index.html`; siapa pun yang tahu link bisa membacanya, walau tidak terindeks Google.
- Netlify: gunakan **Site protection → Password** (fitur paket berbayar) atau Cloudflare Access / Google Workspace.
- Jangan simpan di repo Public.
- PIN pada tab Belting hanya mengunci tampilan, bukan pengamanan.
