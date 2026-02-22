const cache = require('./_lib/cache');
const rateLimit = require('./_lib/rateLimit');
const { getChannelVideos } = require('./_lib/youtube');

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

  const { playlistId, days } = req.query;
  if (!playlistId) {
    return res.status(400).json({ error: 'playlistId parametresi gerekli.' });
  }

  const daysNum = Math.min(Math.max(parseInt(days) || 30, 1), 90);

  // Cache kontrol
  const cacheKey = `videos:${playlistId}:${daysNum}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    const videos = await getChannelVideos(playlistId, daysNum);
    const result = { videos, count: videos.length, days: daysNum };
    cache.set(cacheKey, result);
    return res.status(200).json(result);
  } catch (err) {
    console.error('channel-videos error:', err);
    if (err.status === 403) {
      return res.status(503).json({ error: 'YouTube API kotası dolmuş. Lütfen daha sonra tekrar deneyin.' });
    }
    if (err.status === 404) {
      return res.status(404).json({ error: 'Playlist bulunamadı.' });
    }
    return res.status(500).json({ error: 'Video verileri alınırken hata oluştu.' });
  }
};
