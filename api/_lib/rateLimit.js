/**
 * Basit sliding-window rate limiter (IP başına).
 * Vercel Serverless'da her instance kendi belleğini tutar;
 * gerçek üretimde Redis/KV kullanılır ama basit koruma sağlar.
 */
const windows = new Map();

const WINDOW_MS = 60 * 1000; // 1 dakika penceresi
const MAX_REQUESTS = 30;     // pencere başına maks istek

/**
 * @param {string} ip
 * @returns {{ allowed: boolean, remaining: number, retryAfter?: number }}
 */
function check(ip) {
  const now = Date.now();
  let record = windows.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    record = { windowStart: now, count: 0 };
    windows.set(ip, record);
  }

  record.count++;

  if (record.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: MAX_REQUESTS - record.count };
}

// Periyodik temizlik — eski kayıtları sil
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of windows) {
    if (now - record.windowStart > WINDOW_MS * 2) {
      windows.delete(ip);
    }
  }
}, WINDOW_MS * 2);

module.exports = { check };
