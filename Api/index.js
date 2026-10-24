// Backend serverless (Vercel). Database: Upstash Redis / Vercel KV via REST.
const crypto = require('crypto');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_USER = process.env.ADMIN_USER || 'PAC CARINGIN';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Caringin';
const SECRET = process.env.SECRET || 'sc234-caringin-secret';

async function r(...cmd) {
  const res = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK }, body: JSON.stringify(cmd) });
  return (await res.json()).result;
}
const get = async k => { const v = await r('GET', k); return v ? JSON.parse(v) : null; };
const set = (k, v) => r('SET', k, JSON.stringify(v));
const hash = p => crypto.createHash('sha256').update(p + SECRET).digest('hex');
const sign = u => u + '.' + crypto.createHmac('sha256', SECRET).update(u).digest('hex');
const verify = t => { if (!t) return null; const i = t.lastIndexOf('.'); const u = t.slice(0, i); return sign(u) === t ? u : null; };
const key = u => 'user:' + u.toLowerCase();

module.exports = async (req, res) => {
  if (!URL_ || !TOK) return res.status(500).json({ error: 'Database belum terhubung (KV_REST_API_URL / KV_REST_API_TOKEN).' });
  const b = req.body || {};
  const a = req.query.a;
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  const me = verify(tok);
  const isAdmin = me === '__admin__';
  try {
    if (a === 'register') {
      const u = String(b.username || '').trim();
      if (u.length < 3 || !b.password || b.password.length < 4) return res.status(400).json({ error: 'Username min 3 & password min 4 karakter.' });
      if (!['lama', 'baru'].includes(b.status)) return res.status(400).json({ error: 'Pilih anggota lama atau baru.' });
      if (u.toLowerCase() === ADMIN_USER.toLowerCase() || await get(key(u))) return res.status(409).json({ error: 'Username sudah dipakai.' });
      await set(key(u), { username: u, status: b.status, pass: hash(b.password), photo: '', created: Date.now(), lastSeen: 0, lastLogin: 0, logins: 0 });
      await r('SADD', 'users', u.toLowerCase());
      return res.json({ ok: true });
    }
    if (a === 'login') {
      const u = String(b.username || '').trim();
      if (u === ADMIN_USER && b.password === ADMIN_PASS) return res.json({ token: sign('__admin__'), admin: true });
      const d = await get(key(u));
      if (!d || d.pass !== hash(b.password || '')) return res.status(401).json({ error: 'Username atau password salah.' });
      d.lastLogin = d.lastSeen = Date.now(); d.logins++;
      await set(key(u), d);
      await r('LPUSH', 'loginlog', JSON.stringify({ u: d.username, status: d.status, t: Date.now() }));
      await r('LTRIM', 'loginlog', 0, 199);
      return res.json({ token: sign(d.username.toLowerCase()) });
    }
    if (!me) return res.status(401).json({ error: 'Belum login.' });

    if (a === 'admin') {
      if (!isAdmin) return res.status(403).json({ error: 'Bukan admin.' });
      const ids = (await r('SMEMBERS', 'users')) || [];
      const users = (await Promise.all(ids.map(i => get('user:' + i)))).filter(Boolean).map(({ pass, ...x }) => x);
      const log = ((await r('LRANGE', 'loginlog', 0, 99)) || []).map(JSON.parse);
      return res.json({ users, log });
    }
    if (isAdmin) return res.status(403).json({ error: 'Gunakan /admin.' });

    const d = await get(key(me));
    if (!d) return res.status(401).json({ error: 'Akun tidak ditemukan.' });
    d.lastSeen = Date.now(); await set(key(me), d);

    if (a === 'stats') {
      const ids = (await r('SMEMBERS', 'users')) || [];
      const all = (await Promise.all(ids.map(i => get('user:' + i)))).filter(Boolean);
      const on = all.filter(x => Date.now() - x.lastSeen < 120000).length;
      return res.json({ total: all.length, online: on, lama: all.filter(x => x.status === 'lama').length, baru: all.filter(x => x.status === 'baru').length });
    }
    if (a === 'me') { const { pass, ...x } = d; return res.json(x); }
    if (a === 'photo') {
      if (!b.photo || b.photo.length > 300000) return res.status(400).json({ error: 'Foto terlalu besar.' });
      d.photo = b.photo; await set(key(me), d); return res.json({ ok: true });
    }
    if (a === 'activities') {
      const l = ((await r('LRANGE', 'acts', 0, 49)) || []).map(JSON.parse);
      return res.json(l);
    }
    if (a === 'post') {
      if (!b.desc || !b.image || b.image.length > 400000) return res.status(400).json({ error: 'Gambar & deskripsi wajib (gambar maks ~300KB).' });
      await r('LPUSH', 'acts', JSON.stringify({ u: d.username, status: d.status, desc: String(b.desc).slice(0, 500), image: b.image, t: Date.now() }));
      await r('LTRIM', 'acts', 0, 99);
      return res.json({ ok: true });
    }
    res.status(404).json({ error: 'Aksi tidak dikenal.' });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
