// Backend dashboard (Netlify Functions v2 + Netlify Blobs)
// - Login: password Viewer (VIEW_PASSWORD, opsional) & Admin (ADMIN_PASSWORD, wajib untuk upload)
// - Data bawaan dashboard dilayani HANYA setelah login (tidak ada di file publik)
// - Data hasil upload admin disimpan di server (Blobs) → semua pengguna mendapat data yang sama
import { getStore } from '@netlify/blobs';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = (k) => (process.env[k] || '').trim();
const VIEW_PASSWORD = () => env('VIEW_PASSWORD');
const ADMIN_PASSWORD = () => env('ADMIN_PASSWORD');
const SECRET = () => env('AUTH_SECRET') || ('m10-' + ADMIN_PASSWORD() + '-' + VIEW_PASSWORD());
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

function roleOf(req) {
  const h = req.headers.get('authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const o = verify(tok);
  if (o && (o.role === 'admin' || o.role === 'viewer')) { if (o.role === 'viewer' && !VIEW_PASSWORD()) return 'viewer'; return o.role; }
  return VIEW_PASSWORD() ? null : 'viewer'; // tanpa VIEW_PASSWORD → siapa pun boleh melihat
}

const here = dirname(fileURLToPath(import.meta.url));
function dataFile(name) {
  const roots = [process.env.LAMBDA_TASK_ROOT, process.cwd(), join(here, '..', '..'), here].filter(Boolean);
  for (const r of roots) for (const rel of ['netlify/data', 'data']) { const f = join(r, rel, name); if (existsSync(f)) return f; }
  return null;
}
const SAFE_KEY = /^[A-Za-z0-9_:.\-]{1,120}$/;
const touchRev = async () => { const rev = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await store().set('rev', rev); return rev; };

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const parts = path.split('/');
  const method = req.method;

  try {
    if (path === 'login' && method === 'POST') {
      let pw = ''; try { pw = String((await req.json()).password || ''); } catch {}
      if (ADMIN_PASSWORD() && pw && sameSecret(pw, ADMIN_PASSWORD())) return json({ ok: true, role: 'admin', token: sign({ role: 'admin', exp: Date.now() + 12 * 3600e3 }) });
      if (VIEW_PASSWORD() && pw && sameSecret(pw, VIEW_PASSWORD())) return json({ ok: true, role: 'viewer', token: sign({ role: 'viewer', exp: Date.now() + 30 * 24 * 3600e3 }) });
      if (!VIEW_PASSWORD() && !ADMIN_PASSWORD()) return json({ ok: false, error: 'Server belum dikonfigurasi: isi ADMIN_PASSWORD di Netlify (Site configuration → Environment variables).' }, 500);
      await sleep(900);
      return json({ ok: false, error: 'Password salah.' }, 401);
    }

    if (path === 'session' && method === 'GET') {
      const role = roleOf(req);
      let rev = '0'; try { rev = (await store().get('rev')) || '0'; } catch {}
      return json({ authRequired: !!VIEW_PASSWORD(), role, adminEnabled: !!ADMIN_PASSWORD(), rev });
    }

    const role = roleOf(req);
    if (!role) return json({ error: 'Perlu login.' }, 401);

    if (path === 'rev' && method === 'GET') return json({ rev: (await store().get('rev')) || '0' });

    // data bawaan (dipecah ≤ 2,5 MB per bagian agar di bawah batas respons fungsi)
    if (parts[0] === 'data') {
      if (parts[1] === 'manifest') {
        const f = dataFile('manifest.json'); if (!f) return json({ error: 'Data bawaan tidak ditemukan di server.' }, 500);
        return new Response(readFileSync(f), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      const name = parts[1], idx = parts[2];
      if (!/^[a-z]+$/.test(name || '') || !/^\d+$/.test(idx || '')) return json({ error: 'Tidak valid.' }, 400);
      const f = dataFile(`${name}.${idx}.txt`); if (!f) return json({ error: 'Bagian data tidak ada.' }, 404);
      return text(readFileSync(f, 'utf8'), 200, { 'cache-control': 'private, max-age=31536000, immutable' });
    }

    // penyimpanan state bersama
    if (parts[0] === 'store' && parts[1]) {
      const key = decodeURIComponent(parts.slice(1).join('/'));
      if (!SAFE_KEY.test(key)) return json({ error: 'Kunci tidak valid.' }, 400);
      if (method === 'GET') {
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
