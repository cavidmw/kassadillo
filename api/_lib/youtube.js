/**
 * YouTube Data API v3 yardımcı fonksiyonları.
 * Tüm çağrılar server-side'da yapılır; API key env'den okunur.
 */

const API_BASE = 'https://www.googleapis.com/youtube/v3';

function getKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY environment variable is not set');
  return key;
}

/**
 * Genel YouTube API GET isteği
 */
async function ytFetch(endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  params.key = getKey();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || res.statusText;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* ──────────────────────────────────────────────
 * Kanal Çözümleme (handle / URL / ID → kanal bilgisi)
 * ────────────────────────────────────────────── */

/**
 * Kullanıcı girdisini parse et:
 * - @handle
 * - youtube.com/@handle  /  youtube.com/channel/UCxxx
 * - UC... (doğrudan kanal ID)
 */
function parseInput(raw) {
  const s = raw.trim();

  // Doğrudan kanal ID'si
  if (/^UC[\w-]{22}$/.test(s)) {
    return { type: 'id', value: s };
  }

  // @handle (URL olmadan)
  if (s.startsWith('@')) {
    return { type: 'handle', value: s };
  }

  // URL
  try {
    const url = new URL(s.startsWith('http') ? s : `https://${s}`);
    const path = url.pathname;

    // /channel/UCxxx
    const chMatch = path.match(/\/channel\/(UC[\w-]{22})/);
    if (chMatch) return { type: 'id', value: chMatch[1] };

    // /@handle
    const hMatch = path.match(/\/@([\w.-]+)/);
    if (hMatch) return { type: 'handle', value: `@${hMatch[1]}` };

    // /c/customname veya /user/xxx
    const cMatch = path.match(/\/(c|user)\/([\w.-]+)/);
    if (cMatch) return { type: 'forUsername', value: cMatch[2] };
  } catch { /* URL değil, devam et */ }

  // Son çare: handle olarak dene
  return { type: 'handle', value: s.startsWith('@') ? s : `@${s}` };
}

/**
 * Kanal bilgilerini çözümle (logo, ad, uploads playlist ID)
 */
async function resolveChannel(input) {
  const parsed = parseInput(input);
  let data;

  if (parsed.type === 'id') {
    data = await ytFetch('channels', {
      part: 'snippet,contentDetails',
      id: parsed.value,
    });
  } else if (parsed.type === 'handle') {
    data = await ytFetch('channels', {
      part: 'snippet,contentDetails',
      forHandle: parsed.value.replace('@', ''),
    });
  } else {
    // forUsername
    data = await ytFetch('channels', {
      part: 'snippet,contentDetails',
      forUsername: parsed.value,
    });
  }

  if (!data.items || data.items.length === 0) {
    // handle ile bulunamadıysa arama dene
    if (parsed.type !== 'id') {
      const searchData = await ytFetch('search', {
        part: 'snippet',
        q: parsed.value.replace('@', ''),
        type: 'channel',
        maxResults: 1,
      });
      if (searchData.items && searchData.items.length > 0) {
        const channelId = searchData.items[0].snippet.channelId;
        return resolveChannel(channelId);
      }
    }
    return null;
  }

  // --- DÜZELTİLEN KISIM BAŞLANGICI ---
  const ch = data.items[0]; // Hata buradaydı, ch tanımlandı
  const thumbs = ch.snippet.thumbnails || {};

  return {
    id: ch.id,
    title: ch.snippet.title,

    // eski alan kalsın (uyumluluk için)
    thumbnail: thumbs.medium?.url || thumbs.default?.url || thumbs.high?.url || '',

    // ui.js burayı kullanacak
    thumbnails: {
      high: thumbs.high?.url || '',
      medium: thumbs.medium?.url || '',
      def: thumbs.default?.url || '',
    },

    uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads,
  };
  // --- DÜZELTİLEN KISIM BİTİŞİ ---
}

/* ──────────────────────────────────────────────
 * Video Listesi (uploads playlist'ten, son N gün)
 * ────────────────────────────────────────────── */

/**
 * Uploads playlist'ten videoları çek.
 */
async function getChannelVideos(playlistId, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const videos = [];
  let pageToken = undefined;
  let iterations = 0;
  const MAX_ITERATIONS = 10; 

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const data = await ytFetch('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: 50,
      pageToken,
    });

    if (!data.items || data.items.length === 0) break;

    let reachedCutoff = false;
    for (const item of data.items) {
      const pubDate = new Date(item.contentDetails.videoPublishedAt || item.snippet.publishedAt);
      if (pubDate < cutoff) {
        reachedCutoff = true;
        break;
      }
      videos.push({
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        publishedAt: item.contentDetails.videoPublishedAt || item.snippet.publishedAt,
        thumbnail:
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${item.contentDetails.videoId}/mqdefault.jpg`,
      });
    }

    if (reachedCutoff || !data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return videos;
}

module.exports = { resolveChannel, getChannelVideos, parseInput };