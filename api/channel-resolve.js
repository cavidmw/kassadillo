const cache = require('./_lib/cache');
const rateLimit = require('./_lib/rateLimit');
const { resolveChannel } = require('./_lib/youtube');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Rate limit
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const rl = rateLimit.check(ip);
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.',
      retryAfter: rl.retryAfter,
    });
  }

  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Kanal linki, handle veya ID gerekli.' });
  }

  // Cache kontrol
  const cacheKey = `resolve:${q.trim().toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    const channel = await resolveChannel(q.trim());
    if (!channel) {
      return res.status(404).json({ error: 'Kanal bulunamadı. Linki veya handle\'ı kontrol edin.' });
    }
    cache.set(cacheKey, channel);
    return res.status(200).json(channel);
  } catch (err) {
    console.error('channel-resolve error:', err);
    if (err.status === 403) {
      return res.status(503).json({ error: 'YouTube API kotası dolmuş. Lütfen daha sonra tekrar deneyin.' });
    }
    return res.status(500).json({ error: 'Sunucu hatası oluştu. Lütfen tekrar deneyin.' });
  }
};
