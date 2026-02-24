// api/channel-avatar.js
const cache = require('./_lib/cache');

const API_BASE = 'https://www.googleapis.com/youtube/v3';

function getKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');
  return key;
}

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // bazen ggpht daha stabil dönüyor
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(t);
  }
}

async function ytChannelsById(cid) {
  const url = new URL(`${API_BASE}/channels`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('id', cid);
  url.searchParams.set('key', getKey());

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return data;
}

module.exports = async function handler(req, res) {
  // CORS (frontend rahatça çağırsın)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const cid = String(req.query?.cid || '').trim();

    if (!/^UC[\w-]{22}$/.test(cid)) {
      return res.status(400).send('missing/invalid cid');
    }

    const cacheKey = `avatar:${cid}`;
    const cached = cache.get(cacheKey);

    if (cached?.buf && cached?.type) {
      res.setHeader('Content-Type', cached.type);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.status(200).send(cached.buf);
    }

    const data = await ytChannelsById(cid);
    const ch = data?.items?.[0];
    const thumbs = ch?.snippet?.thumbnails || {};

    // en iyiden kötüye sırala
    const candidates = [
      thumbs.maxres?.url,
      thumbs.high?.url,
      thumbs.medium?.url,
      thumbs.default?.url,
    ].filter(Boolean);

    if (!candidates.length) {
      return res.status(404).send('avatar not available');
    }

    for (const imgUrl of candidates) {
      const r = await fetchWithTimeout(imgUrl, 8000);
      if (!r.ok) continue;

      const type = r.headers.get('content-type') || 'image/jpeg';
      const ab = await r.arrayBuffer();
      const buf = Buffer.from(ab);

      cache.set(cacheKey, { buf, type }, 24 * 60 * 60 * 1000);

      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.status(200).send(buf);
    }

    return res.status(404).send('avatar not available');
  } catch (e) {
    return res.status(500).send('avatar error');
  }
};