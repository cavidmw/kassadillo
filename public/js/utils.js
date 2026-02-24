/* ═══════════════════════════════════════════
   utils.js — Saat dilimi, yuvarlama, tarih formatlama
   Tüm hesaplar Asia/Baku (UTC+4)
   ═══════════════════════════════════════════ */

const CalborUtils = (() => {
  'use strict';

  const TIMEZONE = 'Asia/Baku';

  /**
   * UTC ISO string → Asia/Baku Date bilgileri
   * @param {string} isoString — "2025-03-04T15:06:00Z"
   * @returns {{ year, month, day, hour, minute, dateStr, timeStr, dayLabel, dateObj }}
   */
  function toBaku(isoString) {
    const d = new Date(isoString);
    // Intl ile doğru Baku saatini al
    const parts = {};
    const fmt = new Intl.DateTimeFormat('az-Latn-AZ', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    for (const { type, value } of fmt.formatToParts(d)) {
      parts[type] = value;
    }

    const year   = parseInt(parts.year);
    const month  = parseInt(parts.month);
    const day    = parseInt(parts.day);
    let hour     = parseInt(parts.hour);
    const minute = parseInt(parts.minute);

    // Intl bazen 24 döndürebilir; 0'a normalize et
    if (hour === 24) hour = 0;

    return {
      year,
      month,
      day,
      hour,
      minute,
      dateObj: d,
      dateStr: `${year}-${pad(month)}-${pad(day)}`,
      timeStr: `${pad(hour)}:${pad(minute)}`,
      dayLabel: formatDayLabel(day, month),
    };
  }

  /**
   * Dakika yuvarlama kuralı:
   * - Dakika 0–9 arası → saate yuvarla (ör. 19:06 → 19:00)
   * - Dakika 10+ → yuvarlama yapma, olduğu gibi bırak (ör. 19:30 → 19:30)
   */
  function roundMinute(hour, minute) {
    if (minute <= 9) {
      return { hour, minute: 0, display: `${pad(hour)}:00` };
    }
    return { hour, minute, display: `${pad(hour)}:${pad(minute)}` };
  }

  /**
   * Saat:dakika string formatı
   */
  function formatTime(hour, minute) {
    const r = roundMinute(hour, minute);
    return r.display;
  }

  /**
   * "4 Mart" formatında gün etiketi
   */
  function formatDayLabel(day, month) {
    const months = [
      '', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
      'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
    ];
    return `${day} ${months[month]}`;
  }

  /**
   * Tarih farkı hesapla (gün)
   */
  function daysBetween(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1 + 'T00:00:00');
    const d2 = new Date(dateStr2 + 'T00:00:00');
    return Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
  }

  /**
   * Bugünün Baku tarihini YYYY-MM-DD string olarak döndür
   */
  function todayBaku() {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    return fmt.format(now); // "2025-03-04"
  }

  /**
   * N gün önceki Baku tarihini döndür
   */
  function daysAgoBaku(n) {
    const now = new Date();
    now.setDate(now.getDate() - n);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    return fmt.format(now);
  }

  /**
   * Video listesinden en çok video yüklenen saat dilimini bul
   * @returns {{ hour: number, count: number, display: string }}
   */
  function findPeakHour(videos) {
    const hourCounts = new Array(24).fill(0);
    for (const v of videos) {
      const baku = toBaku(v.publishedAt);
      hourCounts[baku.hour]++;
    }
    let maxIdx = 0;
    for (let i = 1; i < 24; i++) {
      if (hourCounts[i] > hourCounts[maxIdx]) maxIdx = i;
    }
    return {
      hour: maxIdx,
      count: hourCounts[maxIdx],
      display: `${pad(maxIdx)}:00 – ${pad((maxIdx + 1) % 24)}:00`,
    };
  }

  /**
   * Video listesinden kanalın en son video attığı günü bul (Baku)
   * @returns {string} YYYY-MM-DD
   */
  function findLatestVideoDate(videos) {
    if (!videos.length) return todayBaku();
    let latest = new Date(0);
    for (const v of videos) {
      const d = new Date(v.publishedAt);
      if (d > latest) latest = d;
    }
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    return fmt.format(latest);
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  // Public API
  return {
    TIMEZONE,
    toBaku,
    roundMinute,
    formatTime,
    formatDayLabel,
    daysBetween,
    todayBaku,
    daysAgoBaku,
    findPeakHour,
    findLatestVideoDate,
    pad,
  };
})();
