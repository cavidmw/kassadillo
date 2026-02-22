/* ═══════════════════════════════════════════
   api.js — Backend proxy'ye istek gönderme
   ═══════════════════════════════════════════ */

const CalborAPI = (() => {
  'use strict';

  // Vercel / Netlify deploy'da aynı origin; lokal dev'de de aynı
  const BASE = '';

  /**
   * Genel fetch wrapper — hata yönetimi dahil
   */
  async function request(path, params = {}) {
    const url = new URL(path, window.location.origin);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    let res;
    try {
      res = await fetch(url.toString());
    } catch (err) {
      throw new APIError('Ağ hatası. İnternet bağlantınızı kontrol edin.', 0);
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.error || `Sunucu hatası (${res.status})`;
      throw new APIError(msg, res.status, data?.retryAfter);
    }

    return data;
  }

  /**
   * Kanal çözümleme
   * @param {string} query — handle / URL / ID
   * @returns {Promise<{id, title, thumbnail, uploadsPlaylistId}>}
   */
  function resolveChannel(query) {
    return request(`${BASE}/api/channel-resolve`, { q: query });
  }

  /**
   * Kanal videolarını getir
   * @param {string} playlistId — Uploads playlist ID
   * @param {number} days — 1, 7 veya 30
   * @returns {Promise<{videos: Array, count: number, days: number}>}
   */
  function getChannelVideos(playlistId, days = 30) {
    return request(`${BASE}/api/channel-videos`, { playlistId, days });
  }

  /**
   * Özel hata sınıfı
   */
  class APIError extends Error {
    constructor(message, status, retryAfter) {
      super(message);
      this.name = 'APIError';
      this.status = status;
      this.retryAfter = retryAfter;
    }
  }

  return { resolveChannel, getChannelVideos, APIError };
})();
