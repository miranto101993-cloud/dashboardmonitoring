// Backend dashboard (Netlify Functions v2 + Netlify Blobs)
// - Login: password Viewer (VIEW_PASSWORD, opsional) & Admin (ADMIN_PASSWORD, wajib untuk upload)
// - Data bawaan dashboard dilayani HANYA setelah login (tidak ada di file publik)
// - Data hasil upload admin disimpan di server (Blobs) → semua pengguna mendapat data yang sama
import { getStore } from '@netlify/blobs';
import { createHmac, createHash, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = (k) => (process.env[k] || '').trim();
const ADMIN_USER = () => (env('ADMIN_USER') || 'admin').toLowerCase();
const ADMIN_PASSWORD = () => env('ADMIN_PASSWORD');
const SECRET = () => env('AUTH_SECRET') || ('m10-' + ADMIN_PASSWORD() + '-' + ADMIN_USER());
const store = () => getStore({ name: 'dashboard', consistency: 'strong' });

const b64u = (b) => Buffer.from(b).toString('base64url');
const sign = (payload) => { const p = b64u(JSON.stringify(payload)); return p + '.' + createHmac('sha256', SECRET()).update(p).digest('base64url'); };
function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [p, sig] = token.split('.');
  const exp = createHmac('sha256', SECRET()).update(p).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(exp);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return (o.exp && o.exp > Date.now()) ? o : null; } catch { return null; }
}
const sameSecret = (x, y) => { const a = createHash('sha256').update(String(x)).digest(), b = createHash('sha256').update(String(y)).digest(); return timingSafeEqual(a, b); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const text = (body, status = 200, extra = {}) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...extra } });

// ---------- akun pengguna (disimpan di Blobs: kunci "users") ----------
// { users: { username: {name, role, salt, hash, pv, disabled, created} }, pending: { username: {name, salt, hash, requestedAt} } }
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const hashPw = (pw, salt) => scryptSync(String(pw), salt, 32).toString('base64');
const newCred = (pw) => { const salt = randomBytes(16).toString('base64'); return { salt, hash: hashPw(pw, salt) }; };
const checkPw = (pw, rec) => { try { const a = Buffer.from(hashPw(pw, rec.salt)), b = Buffer.from(rec.hash); return a.length === b.length && timingSafeEqual(a, b); } catch { return false; } };
async function loadUsers() { try { const v = await store().get('users', { type: 'text' }); const o = v ? JSON.parse(v) : {}; return { users: o.users || {}, pending: o.pending || {} }; } catch { return { users: {}, pending: {} }; } }
const saveUsers = (db) => store().set('users', JSON.stringify(db));
const isOwner = (u) => u === ADMIN_USER();
const cleanName = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 60);

// siapa yang memanggil? → {user, name, role} atau null. Dicek ke daftar pengguna di setiap permintaan, sehingga akses yang dihapus langsung mati.
async function who(req) {
  const h = req.headers.get('authorization') || '';
  const o = verify(h.startsWith('Bearer ') ? h.slice(7) : '');
  if (!o || !o.u) return null;
  if (isOwner(o.u)) return ADMIN_PASSWORD() ? { user: o.u, name: 'Admin', role: 'admin' } : null;
  const db = await loadUsers(); const r = db.users[o.u];
  if (!r || r.disabled || (o.pv || 0) !== (r.pv || 0)) return null;
  return { user: o.u, name: r.name || o.u, role: r.role === 'admin' ? 'admin' : 'viewer' };
}

const here = dirname(fileURLToPath(import.meta.url));
function dataFile(name) {
  const roots = [process.env.LAMBDA_TASK_ROOT, process.cwd(), join(here, '..', '..'), here].filter(Boolean);
  for (const r of roots) for (const rel of ['netlify/data', 'data']) { const f = join(r, rel, name); if (existsSync(f)) return f; }
  return null;
}
const PRIVATE_DATA = ['member', 'memtx']; // Data Customer: hanya admin
const isPrivKey = (k) => /priv/.test(k);
const SAFE_KEY = /^[A-Za-z0-9_:.\-]{1,120}$/;
const touchRev = async () => { const rev = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await store().set('rev', rev); return rev; };

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const parts = path.split('/');
  const method = req.method;

  try {
    if (path === 'login' && method === 'POST') {
      let b = {}; try { b = await req.json(); } catch {}
      const u = String(b.username || '').trim().toLowerCase(), pw = String(b.password || '');
      if (!ADMIN_PASSWORD()) return json({ ok: false, error: 'Server belum dikonfigurasi: isi ADMIN_PASSWORD di Netlify (Site configuration → Environment variables).' }, 500);
      if (u && pw) {
        if (isOwner(u)) { if (sameSecret(pw, ADMIN_PASSWORD())) return json({ ok: true, role: 'admin', name: 'Admin', token: sign({ u, exp: Date.now() + 12 * 3600e3 }) }); }
        else {
          const db = await loadUsers(); const r = db.users[u];
          if (r && !r.disabled && checkPw(pw, r)) { const role = r.role === 'admin' ? 'admin' : 'viewer'; return json({ ok: true, role, name: r.name || u, token: sign({ u, pv: r.pv || 0, exp: Date.now() + (role === 'admin' ? 12 * 3600e3 : 7 * 24 * 3600e3) }) }); }
          if (r && r.disabled) { await sleep(600); return json({ ok: false, error: 'Akun dinonaktifkan. Hubungi admin.' }, 401); }
          if (db.pending[u] && checkPw(pw, db.pending[u])) return json({ ok: false, error: 'Permintaan akses Anda masih menunggu persetujuan admin.' }, 401);
        }
      }
      await sleep(900);
      return json({ ok: false, error: 'User atau password salah.' }, 401);
    }

    if (path === 'request-access' && method === 'POST') {
      let b = {}; try { b = await req.json(); } catch {}
      const u = String(b.username || '').trim().toLowerCase(), pw = String(b.password || ''), name = cleanName(b.name);
      await sleep(600);
      if (!name) return json({ ok: false, error: 'Nama lengkap wajib diisi.' }, 400);
      if (!USERNAME_RE.test(u)) return json({ ok: false, error: 'User 3–30 karakter: huruf kecil, angka, titik, strip, garis bawah.' }, 400);
      if (pw.length < 8) return json({ ok: false, error: 'Password minimal 8 karakter.' }, 400);
      const db = await loadUsers();
      if (isOwner(u) || db.users[u] || db.pending[u]) return json({ ok: false, error: 'User sudah dipakai / sudah pernah mengajukan.' }, 409);
      if (Object.keys(db.pending).length >= 100) return json({ ok: false, error: 'Antrian permintaan penuh. Hubungi admin.' }, 429);
      db.pending[u] = { name, ...newCred(pw), requestedAt: new Date().toISOString() };
      await saveUsers(db);
      return json({ ok: true, message: 'Permintaan terkirim. Tunggu persetujuan admin, lalu login.' });
    }

    const me = await who(req);

    if (path === 'session' && method === 'GET') {
      let rev = '0'; try { rev = (await store().get('rev')) || '0'; } catch {}
      return json({ authRequired: true, role: me ? me.role : null, user: me ? me.user : null, name: me ? me.name : null, adminEnabled: !!ADMIN_PASSWORD(), rev });
    }

    if (!me) return json({ error: 'Perlu login.' }, 401);
    const role = me.role;

    // ---------- kelola pengguna (admin) ----------
    if (parts[0] === 'admin' && parts[1] === 'users') {
      if (role !== 'admin') return json({ error: 'Khusus admin.' }, 403);
      const db = await loadUsers(); const target = (parts[2] || '').toLowerCase();
      const pub = () => ({ owner: ADMIN_USER(), users: Object.entries(db.users).map(([u, r]) => ({ username: u, name: r.name, role: r.role, disabled: !!r.disabled, created: r.created })), pending: Object.entries(db.pending).map(([u, r]) => ({ username: u, name: r.name, requestedAt: r.requestedAt })) });
      if (method === 'GET' && !target) return json(pub());
      let b = {}; if (method !== 'GET' && method !== 'DELETE') { try { b = await req.json(); } catch {} }
      const roleOk = (r) => (r === 'admin' ? 'admin' : 'viewer');
      if (method === 'POST' && !target) { // tambah langsung
        const u = String(b.username || '').trim().toLowerCase(), pw = String(b.password || '');
        if (!USERNAME_RE.test(u)) return json({ error: 'User 3–30 karakter: huruf kecil, angka, titik, strip, garis bawah.' }, 400);
        if (pw.length < 8) return json({ error: 'Password minimal 8 karakter.' }, 400);
        if (isOwner(u) || db.users[u]) return json({ error: 'User sudah ada.' }, 409);
        delete db.pending[u];
        db.users[u] = { name: cleanName(b.name) || u, role: roleOk(b.role), ...newCred(pw), pv: 1, created: new Date().toISOString() };
        await saveUsers(db); return json(pub());
      }
      if (!USERNAME_RE.test(target)) return json({ error: 'User tidak valid.' }, 400);
      if (method === 'POST' && parts[3] === 'approve') {
        const p = db.pending[target]; if (!p) return json({ error: 'Permintaan tidak ditemukan.' }, 404);
        db.users[target] = { name: p.name, role: roleOk(b.role), salt: p.salt, hash: p.hash, pv: 1, created: new Date().toISOString() }; delete db.pending[target];
        await saveUsers(db); return json(pub());
      }
      if (method === 'POST' && parts[3] === 'reject') { delete db.pending[target]; await saveUsers(db); return json(pub()); }
      if (method === 'POST' && parts[3] === 'update') {
        const r = db.users[target]; if (!r) return json({ error: 'User tidak ditemukan.' }, 404);
        if (b.role !== undefined) r.role = roleOk(b.role);
        if (b.disabled !== undefined) r.disabled = !!b.disabled;
        if (b.name !== undefined) r.name = cleanName(b.name) || r.name;
        if (b.password) { if (String(b.password).length < 8) return json({ error: 'Password minimal 8 karakter.' }, 400); Object.assign(r, newCred(b.password)); }
        r.pv = (r.pv || 0) + 1; // semua sesi lama user ini otomatis keluar
        await saveUsers(db); return json(pub());
      }
      if (method === 'DELETE') { if (!db.users[target] && !db.pending[target]) return json({ error: 'User tidak ditemukan.' }, 404); delete db.users[target]; delete db.pending[target]; await saveUsers(db); return json(pub()); }
      return json({ error: 'Tidak ditemukan.' }, 404);
    }

    if (path === 'rev' && method === 'GET') return json({ rev: (await store().get('rev')) || '0' });

    // data bawaan (dipecah ≤ 2,5 MB per bagian agar di bawah batas respons fungsi)
    if (parts[0] === 'data') {
      if (parts[1] === 'manifest') {
        const f = dataFile('manifest.json'); if (!f) return json({ error: 'Data bawaan tidak ditemukan di server.' }, 500);
        const man = JSON.parse(readFileSync(f, 'utf8')); if (role !== 'admin') for (const n of PRIVATE_DATA) delete man.parts[n];
        return json(man);
      }
      const name = parts[1], idx = parts[2];
      if (PRIVATE_DATA.includes(name) && role !== 'admin') return json({ error: 'Khusus admin.' }, 403);
      if (!/^[a-z]+$/.test(name || '') || !/^\d+$/.test(idx || '')) return json({ error: 'Tidak valid.' }, 400);
      const f = dataFile(`${name}.${idx}.txt`); if (!f) return json({ error: 'Bagian data tidak ada.' }, 404);
      return text(readFileSync(f, 'utf8'), 200, { 'cache-control': 'private, max-age=31536000, immutable' });
    }

    // penyimpanan state bersama
    if (parts[0] === 'store' && parts[1]) {
      const key = decodeURIComponent(parts.slice(1).join('/'));
      if (!SAFE_KEY.test(key)) return json({ error: 'Kunci tidak valid.' }, 400);
      if (method === 'GET') {
        if (isPrivKey(key) && role !== 'admin') return json({ error: 'Khusus admin.' }, 403);
        const v = await store().get('kv/' + key, { type: 'text' });
        if (v == null) return json({ error: 'Tidak ditemukan.' }, 404);
        return text(v, 200, { 'cache-control': url.searchParams.get('v') ? 'private, max-age=31536000, immutable' : 'no-store' });
      }
      if (role !== 'admin') return json({ error: 'Hanya admin yang boleh mengubah data.' }, 403);
      if (method === 'PUT') {
        const body = await req.text();
        if (body.length > 5.5 * 1024 * 1024) return json({ error: 'Data terlalu besar untuk satu bagian.' }, 413);
        await store().set('kv/' + key, body);
        const isMeta = /(^|[:_])meta$/.test(key);
        return json({ ok: true, ...(isMeta ? { rev: await touchRev() } : {}) });
      }
      if (method === 'DELETE') {
        await store().delete('kv/' + key);
        const isMeta = /(^|[:_])meta$/.test(key);
        return json({ ok: true, ...(isMeta ? { rev: await touchRev() } : {}) });
      }
    }
    return json({ error: 'Tidak ditemukan.' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: 'Kesalahan server: ' + (e && e.message || e) }, 500);
  }
};

export const config = { path: '/api/*' };
