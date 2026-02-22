/**
 * Basit in-memory cache — Vercel Serverless cold start'lar arasında sıfırlanır
 * ama aynı instance üzerinde 10 dk boyunca tekrar istek atmayı engeller.
 */
const store = new Map();

const DEFAULT_TTL = 10 * 60 * 1000; // 10 dakika

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttl = DEFAULT_TTL) {
  // Bellek taşmasını önle — en fazla 200 giriş
  if (store.size > 200) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  store.set(key, { value, expires: Date.now() + ttl });
}

module.exports = { get, set };
