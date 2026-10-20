// Backend dashboard (Netlify Functions v2 + Netlify Blobs)
// - Login per-user; admin utama bawaan + akun yang disetujui admin
// - Data bawaan dashboard dilayani HANYA setelah login (tidak ada di file publik)
// - Data hasil upload admin disimpan di server (Blobs) → semua pengguna mendapat data yang sama
import { getStore } from '@netlify/blobs';
import { createHmac, createHash, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const env = (k) => (process.env[k] || '').trim();
const ADMIN_USER = () => (env('ADMIN_USER') || 'admin').toLowerCase();
// Admin utama bawaan (password disimpan sebagai hash scrypt, bukan teks asli). Admin utama kedua (opsional) = ADMIN_USER + ADMIN_PASSWORD di Netlify.
const OWNER_USER = 'miranto.101993@gmail.com', OWNER_SALT = 'm10-owner-salt-v1', OWNER_HASH = 'afEs4nD7ked15bvwR3spuacBvrOeJCWjljFC1RN11k4=';
const ADMIN_PASSWORD = () => env('ADMIN_PASSWORD');
const SECRET = () => env('AUTH_SECRET') || ('m10-' + OWNER_HASH + '-' + ADMIN_PASSWORD() + '-' + ADMIN_USER());
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
const USERNAME_RE = /^[a-z0-9._@+-]{3,60}$/;
const hashPw = (pw, salt) => scryptSync(String(pw), salt, 32).toString('base64');
const newCred = (pw) => { const salt = randomBytes(16).toString('base64'); return { salt, hash: hashPw(pw, salt) }; };
const checkPw = (pw, rec) => { try { const a = Buffer.from(hashPw(pw, rec.salt)), b = Buffer.from(rec.hash); return a.length === b.length && timingSafeEqual(a, b); } catch { return false; } };
async function loadUsers() { try { const v = await store().get('users', { type: 'text' }); const o = v ? JSON.parse(v) : {}; return { users: o.users || {}, pending: o.pending || {} }; } catch { return { users: {}, pending: {} }; } }
const saveUsers = (db) => store().set('users', JSON.stringify(db));
const roleName = (r) => (r === 'admin' ? 'admin' : r === 'sales' ? 'sales' : 'viewer');
const isOwner = (u) => u === OWNER_USER || (!!ADMIN_PASSWORD() && u === ADMIN_USER());
const ownerPwOk = (u, pw) => {
  if (u === OWNER_USER) { try { const x = Buffer.from(hashPw(pw, OWNER_SALT)), y = Buffer.from(OWNER_HASH); if (x.length === y.length && timingSafeEqual(x, y)) return true; } catch {} }
  return !!ADMIN_PASSWORD() && u === ADMIN_USER() && sameSecret(pw, ADMIN_PASSWORD());
};
const cleanName = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 60);

// siapa yang memanggil? → {user, name, role} atau null. Dicek ke daftar pengguna di setiap permintaan, sehingga akses yang dihapus langsung mati.
async function who(req) {
  const h = req.headers.get('authorization') || '';
  const o = verify(h.startsWith('Bearer ') ? h.slice(7) : '');
  if (!o || !o.u) return null;
  if (isOwner(o.u)) return { user: o.u, name: 'Admin', role: 'admin' };
  const db = await loadUsers(); const r = db.users[o.u];
  if (!r || r.disabled || (o.pv || 0) !== (r.pv || 0)) return null;
  return { user: o.u, name: r.name || o.u, role: roleName(r.role), spId: r.spId || null };
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


// ---------- data efektif (bawaan + hasil upload admin) untuk akun Salesperson ----------
const normId = (s) => String(s || '').trim().toLowerCase();
let _seed = null;
function seedObj() {
  if (_seed) return _seed;
  const mf = dataFile('manifest.json'); const man = JSON.parse(readFileSync(mf, 'utf8')); let b = '';
  for (let i = 0; i < man.parts.seed; i++) b += readFileSync(dataFile(`seed.${i}.txt`), 'utf8');
  _seed = JSON.parse(gunzipSync(Buffer.from(b, 'base64')).toString('utf8')); return _seed;
}
function dec(v) {
  if (!v) return []; if (Array.isArray(v)) return v; if (v.__multi) return v.__multi.flatMap(dec);
  if (v.__c && v.__r) { const c = v.__c; return v.__r.map((r) => { const o = {}; for (let i = 0; i < c.length; i++) o[c[i]] = r[i]; return o; }); }
  return [];
}
async function loadPayload() {
  const mv = await store().get('kv/retailpulse_v2_meta', { type: 'text' }); if (!mv) return null;
  const meta = JSON.parse(gunzipSync(Buffer.from(mv, 'base64')).toString('utf8')); let s = '';
  for (let i = 0; i < (meta.n || 0); i++) {
    const c = await store().get(meta.sid ? `kv/v${meta.sid}:chunk:${i}` : `kv/retailpulse_v2_chunk:${i}`, { type: 'text' });
    if (c == null) return null; s += gunzipSync(Buffer.from(c, 'base64')).toString('utf8');
  }
  return JSON.parse(s);
}
let _eff = null, _effRev = null; const _scoped = new Map();
async function effective() {
  const rev = (await store().get('rev')) || '0';
  if (_eff && _effRev === rev) return _eff;
  const seed = seedObj(), seedVer = (seed.meta && seed.meta.dataVersion) || 0;
  let pl = null; try { pl = await loadPayload(); } catch { pl = null; }
  if (pl && (pl.__ver || 0) < seedVer) pl = null; // data bawaan lebih baru
  const pick = (k) => (pl && pl[k] !== undefined ? (Array.isArray(pl[k]) ? pl[k] : dec(pl[k])) : dec(seed[k]));
  let salperFact = pick('salperFact');
  const sd = seed.dataMeta && seed.dataMeta.salper && seed.dataMeta.salper.uploadedAt, pd = pl && pl.dataMeta && pl.dataMeta.salper && pl.dataMeta.salper.uploadedAt;
  if (sd && (!pd || sd > pd)) salperFact = dec(seed.salperFact); // aturan kunci tanggal sama seperti di dashboard
  const dm = (pl && pl.dataMeta) || seed.dataMeta || {};
  _eff = { spFact: pick('spFact'), salperFact, brandFact: pick('brandFact'), brandDayFact: pick('brandDayFact'), salesFact: pick('salesFact'), itemFact: pick('itemFact'), itemDayFact: pick('itemDayFact'), itemMeta: mergePb((pl && pl.itemMeta) || seed.itemMeta || {}, seed.itemMeta || {}), tlMentor: pick('tlMentor'), meta: seed.meta || {}, dataMeta: dm };
  _effRev = rev; _scoped.clear(); return _eff;
}
const ZONA_MAP = { 'FLOORING AND WALL': 'Zona 1', 'BATHROOM': 'Zona 2', 'PLUMBING': 'Zona 2', 'APPLIANCES': 'Zona 3', 'DOORS AND WINDOWS': 'Zona 3', 'ELECTRICAL AND LIGHTING': 'Zona 3', 'HARDWARE': 'Zona 3', 'HOUSEWARE & HOBBIES': 'Zona 3', 'HOBBIES': 'Zona 3', 'KITCHEN': 'Zona 3', 'TOOLS': 'Zona 3', 'MISCELLANEOUS': 'Zona 3', 'BUILDING MATERIAL': 'Zona 4', 'PAINT AND SUNDRIES': 'Zona 4' };
const ZONA_CHANGES = [{ fromMonth: 10, cat: 'BUILDING MATERIAL', zona: 'Zona 1' }]; // sama seperti di dashboard
function zonaOf(cat, m) { const c = String(cat || '').trim().toUpperCase(); let z = ZONA_MAP[c]; for (const ch of ZONA_CHANGES) if (ch.cat === c && m >= ch.fromMonth) z = ch.zona; return z || 'Zona Lainnya'; }
function mergePb(meta, seedMeta) { if (meta === seedMeta) return meta; let any = false; for (const k in meta) { if (meta[k] && meta[k].pb) { any = true; break; } } if (any) return meta; for (const k in seedMeta) if (seedMeta[k] && seedMeta[k].pb && meta[k]) meta[k] = { ...meta[k], pb: 1 }; return meta; }
function brandKeys(mb, names) {
  const set = new Set(), all = new Map(names.map((n) => [String(n).toLowerCase(), n]));
  const toks = [String(mb || '')].concat(String(mb || '').split(/\s*[&\/,]\s*/));
  for (const t0 of toks) { const t = t0.trim().toLowerCase(); if (!t) continue; if (all.has(t)) set.add(all.get(t)); for (const [k, n] of all) if (k.startsWith(t + ' ')) set.add(n); }
  return set;
}
function scopedFor(eff, spId) {
  const id = normId(spId);
  const row = eff.salperFact.find((r) => normId(r.spId) === id);
  const sp = eff.spFact.filter((r) => normId(r.spId) === id);
  const tl = (eff.tlMentor.find((r) => normId(r.spId) === id) || {}).tl || '';
  const mb = row ? row.masterBrand : '';
  const names = [...new Set(eff.brandFact.map((r) => r.brand))];
  const keys = mb === 'Private Brand' ? new Set() : brandKeys(mb, names);
  const brandFact = eff.brandFact.filter((r) => keys.has(r.brand));
  const brandDayFact = eff.brandDayFact.filter((r) => keys.has(r.brand));
  const lk = new Set([...keys].map((k) => String(k).toLowerCase())), itemMeta = {}, isPB = mb === 'Private Brand', zona = row ? row.zona : '';
  let itemFact = [], itemDayFact = [];
  if (isPB) { // Master Type Brand = Private Brand + Exclusive Brand, pada zona milik Salesperson ini (zona dihitung per bulan seperti di dashboard)
    const ok = (id, m) => { const v = eff.itemMeta[id]; return v && v.pb && zonaOf(v.cat, m) === zona; };
    itemFact = eff.itemFact.filter((r) => ok(r.item, r.m)); itemDayFact = eff.itemDayFact.filter((r) => ok(r.item, r.m));
    for (const r of itemFact.concat(itemDayFact)) if (!itemMeta[r.item]) { const v = eff.itemMeta[r.item]; itemMeta[r.item] = { name: v.name, cat: v.cat, subcat: v.subcat, brand: v.brand, mb: v.masterBrand }; }
  } else if (lk.size) {
    for (const [id, v] of Object.entries(eff.itemMeta)) if (v && lk.has(String(v.masterBrand || '').toLowerCase())) itemMeta[id] = { name: v.name, cat: v.cat, subcat: v.subcat, brand: v.brand, mb: v.masterBrand };
    itemFact = eff.itemFact.filter((r) => itemMeta[r.item]); itemDayFact = eff.itemDayFact.filter((r) => itemMeta[r.item]);
  }
  const pb = [];
  const brandMode = isPB ? (zona ? 'pb' : 'none') : keys.size ? 'brand' : 'none';
  const sm = (eff.dataMeta && eff.dataMeta.sales) || {};
  return { user: { spId: (row && row.spId) || spId, name: (row && row.spName) || (sp[0] && sp[0].spName) || spId, zona: row ? row.zona : '', kriteria: row ? row.kriteria : '', mb, tl }, brandMode, brandNames: [...keys], spFact: sp, brandFact, brandDayFact, itemFact, itemDayFact, itemMeta, pbFact: pb, meta: { latestMonth2026: eff.meta.latestMonth2026, latestDate2026: eff.meta.latestDate2026, years: eff.meta.years }, sales: { from: sm.from, to: sm.to } };
}
async function salesMap() { const eff = await effective(); const m = new Map(); eff.salperFact.forEach((r) => { if (r.spId) m.set(normId(r.spId), { id: r.spId, name: r.spName, zona: r.zona, mb: r.masterBrand }); }); return m; }
const rndPw = () => { const al = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = randomBytes(10); let s = ''; for (let i = 0; i < 10; i++) s += al[b[i] % al.length]; return s; };

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const parts = path.split('/');
  const method = req.method;

  try {
    if (path === 'login' && method === 'POST') {
      let b = {}; try { b = await req.json(); } catch {}
      const u = String(b.username || '').trim().toLowerCase(), pw = String(b.password || '');
      const wantAdmin = b.as === 'admin';
      if (u && pw) {
        if (isOwner(u)) { if (ownerPwOk(u, pw)) return json({ ok: true, role: 'admin', name: 'Admin', token: sign({ u, exp: Date.now() + 12 * 3600e3 }) }); }
        else {
          const db = await loadUsers(); const r = db.users[u];
          if (r && !r.disabled && checkPw(pw, r)) { const role = roleName(r.role); if (wantAdmin && role !== 'admin') { await sleep(600); return json({ ok: false, error: 'Akun ini bukan Admin. Pilih "Pengguna" untuk masuk.' }, 403); } return json({ ok: true, role, name: r.name || u, token: sign({ u, pv: r.pv || 0, exp: Date.now() + (role === 'admin' ? 12 * 3600e3 : 7 * 24 * 3600e3) }) }); }
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
      if (pw.length < 8) return json({ ok: false, error: 'Password minimal 8 karakter.' }, 400);
      const info = (await salesMap()).get(u);
      if (!info) return json({ ok: false, error: 'User harus berupa Salesperson ID yang terdaftar, contoh: S80000-0000000449.' }, 400);
      const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
      const dbw = new Set(words(info.name));
      if (!words(name).some((w) => dbw.has(w))) return json({ ok: false, error: 'Nama harus mengandung salah satu kata dari nama Anda di database Salesperson (cukup satu kata, mis. nama depan atau belakang).' }, 400);
      const db = await loadUsers();
      if (isOwner(u) || db.users[u] || db.pending[u]) return json({ ok: false, error: 'Salesperson ID ini sudah punya akun / sudah mengajukan akses.' }, 409);
      if (Object.keys(db.pending).length >= 100) return json({ ok: false, error: 'Antrian permintaan penuh. Hubungi admin.' }, 429);
      db.pending[u] = { name, ...newCred(pw), requestedAt: new Date().toISOString() };
      await saveUsers(db);
      return json({ ok: true, message: 'Permintaan terkirim. Tunggu persetujuan admin, lalu login.' });
    }

    const me = await who(req);

    if (path === 'session' && method === 'GET') {
      let rev = '0'; try { rev = (await store().get('rev')) || '0'; } catch {}
      return json({ authRequired: true, role: me ? me.role : null, user: me ? me.user : null, canManage: !!me && me.user === OWNER_USER, spId: me ? me.spId || null : null, name: me ? me.name : null, adminEnabled: !!ADMIN_PASSWORD(), rev });
    }

    if (!me) return json({ error: 'Perlu login.' }, 401);
    const role = me.role;

    // ---------- akun Salesperson: hanya data milik sendiri ----------
    if (role === 'sales') {
      if (path === 'rev' && method === 'GET') return json({ rev: (await store().get('rev')) || '0' });
      if (path === 'scoped' && method === 'GET') {
        const eff = await effective(); const k = normId(me.spId);
        if (!_scoped.has(k)) { if (_scoped.size > 60) _scoped.clear(); _scoped.set(k, JSON.stringify(scopedFor(eff, me.spId))); }
        return new Response(_scoped.get(k), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
      }
      return json({ error: 'Akun Salesperson hanya dapat melihat data miliknya.' }, 403);
    }

    // ---------- kelola pengguna (admin) ----------
    if (parts[0] === 'admin' && parts[1] === 'users') {
      if (me.user !== OWNER_USER) return json({ error: 'Kelola pengguna hanya untuk admin utama (' + OWNER_USER + ').' }, 403);
      const db = await loadUsers(); let target = ''; try { target = decodeURIComponent(parts[2] || '').toLowerCase(); } catch {}
      const pub = () => ({ owner: OWNER_USER, users: Object.entries(db.users).map(([u, r]) => ({ username: u, name: r.name, role: r.role, spId: r.spId || null, mb: r.mb || null, disabled: !!r.disabled, created: r.created })), pending: Object.entries(db.pending).map(([u, r]) => ({ username: u, name: r.name, requestedAt: r.requestedAt })) });
      if (method === 'GET' && !target) return json(pub());
      let b = {}; if (method !== 'GET' && method !== 'DELETE') { try { b = await req.json(); } catch {} }
      const roleOk = (r) => (r === 'admin' ? 'admin' : 'viewer');
      if (method === 'GET' && target === 'salesmap') { const m = await salesMap(); return json({ list: [...m.values()], taken: Object.values(db.users).filter((x) => x.spId).map((x) => normId(x.spId)) }); }
      if (method === 'POST' && target === 'sales') { // satu Salesperson: user = Salesperson ID
        const m = await salesMap(); const info = m.get(normId(b.id)); const pw = String(b.password || '') || rndPw();
        if (!info) return json({ error: 'Salesperson ID tidak ditemukan di database Salesperson.' }, 404);
        const u = normId(info.id); if (db.users[u] || isOwner(u)) return json({ error: 'Salesperson ID ini sudah punya akun.' }, 409);
        if (pw.length < 8) return json({ error: 'Password minimal 8 karakter.' }, 400);
        delete db.pending[u]; db.users[u] = { name: cleanName(info.name) || info.id, role: 'sales', spId: info.id, mb: info.mb, ...newCred(pw), pv: 1, created: new Date().toISOString() };
        await saveUsers(db); return json({ ...pub(), created: [{ id: info.id, name: info.name, mb: info.mb, password: pw }] });
      }
      if (method === 'POST' && target === 'bulk-sales') { // banyak Salesperson sekaligus (password acak, ditampilkan sekali)
        const m = await salesMap(); const ids = (Array.isArray(b.ids) ? b.ids : String(b.ids || '').split(/[\s,;]+/)).map(normId).filter(Boolean);
        const created = [], skipped = [];
        for (const id of [...new Set(ids)]) {
          const info = m.get(id); if (!info) { skipped.push({ id, why: 'ID tidak ditemukan' }); continue; }
          if (db.users[id]) { skipped.push({ id: info.id, why: 'sudah punya akun' }); continue; }
          const pw = rndPw(); delete db.pending[id]; db.users[id] = { name: cleanName(info.name) || info.id, role: 'sales', spId: info.id, mb: info.mb, ...newCred(pw), pv: 1, created: new Date().toISOString() };
          created.push({ id: info.id, name: info.name, mb: info.mb, password: pw });
        }
        if (created.length) await saveUsers(db); return json({ ...pub(), created, skipped });
      }
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
        if (b.role === 'sales') { const info = (await salesMap()).get(target); if (!info) return json({ error: 'User ini bukan Salesperson ID yang terdaftar.' }, 400); db.users[target] = { name: cleanName(info.name) || p.name, role: 'sales', spId: info.id, mb: info.mb, salt: p.salt, hash: p.hash, pv: 1, created: new Date().toISOString() }; delete db.pending[target]; await saveUsers(db); return json(pub()); }
        db.users[target] = { name: p.name, role: roleOk(b.role), salt: p.salt, hash: p.hash, pv: 1, created: new Date().toISOString() }; delete db.pending[target];
        await saveUsers(db); return json(pub());
      }
      if (method === 'POST' && parts[3] === 'reject') { delete db.pending[target]; await saveUsers(db); return json(pub()); }
      if (method === 'POST' && parts[3] === 'update') {
        const r = db.users[target]; if (!r) return json({ error: 'User tidak ditemukan.' }, 404);
        if (b.role !== undefined && r.role !== 'sales') r.role = roleOk(b.role);
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
