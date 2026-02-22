/* ═══════════════════════════════════════════
   app.js — Ana uygulama: state, event'ler, orchestration
   (Senin mevcut app.js akışına göre güncellendi)
   + CSV Export (son 30 gün, tarih + saat(dakika))
   + 1 günlük modda video atılan günler arasında gezinme (varsa oklarla)
   + UI destekliyorsa: Önerilen saat + yayın düzeni metrikleri
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Uygulama state ── */
  const state = {
    channel: null,          // { id, title, thumbnail, uploadsPlaylistId }
    videos: [],             // [{ id, title, publishedAt, thumbnail, url? }, ...]
    currentMode: 30,        // 30 | 7 | 1

    latestVideoDate: null,  // YYYY-MM-DD (Baku) — en son video atılan gün
    daysList: [],           // video atılan günler (Baku) eski->yeni
    dayIndex: 0,            // daysList index
    selectedDayDate: null,  // 1 günlük modda seçilen gün
  };

  /* ── Başlangıç ── */
  function init() {
    bindEvents();
    CalborCharts.initCanvas(CalborUI.els.chartCanvas);

    // Pencere boyutu değiştiğinde grafik yeniden çiz
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.videos.length > 0) renderChart();
      }, 200);
    });
  }

  /* ── Event bağlama ── */
  function bindEvents() {
    const {
      channelInput,
      searchBtn,
      analyzeBtn,
      cancelBtn,
      modeTabs,
      chartCanvas,

      // opsiyonel (UI'da varsa)
      csvBtn,
      dayPrevBtn,
      dayNextBtn,
    } = CalborUI.els;

    // Arama
    searchBtn.addEventListener('click', onSearch);
    channelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onSearch();
    });

    // Önizleme
    analyzeBtn.addEventListener('click', onAnalyze);
    cancelBtn.addEventListener('click', onCancel);

    // Mod sekmeleri
    modeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = parseInt(tab.dataset.mode, 10);
        if (mode !== state.currentMode) {
          state.currentMode = mode;
          CalborUI.setActiveTab(mode);
          renderChart();
        }
      });
    });

    // Canvas hover
    chartCanvas.addEventListener('mousemove', CalborCharts.handleMouseMove);
    chartCanvas.addEventListener('mouseleave', CalborCharts.handleMouseLeave);

    // CSV export (buton varsa)
    if (csvBtn) {
      csvBtn.addEventListener('click', downloadCSVLast30Days);
    }

    // 1 günlük gezinme (butonlar varsa)
    if (dayPrevBtn) {
      dayPrevBtn.addEventListener('click', () => {
        if (state.currentMode !== 1) return;
        if (state.dayIndex <= 0) return;
        state.dayIndex--;
        state.selectedDayDate = state.daysList[state.dayIndex];
        renderChart();
      });
    }

    if (dayNextBtn) {
      dayNextBtn.addEventListener('click', () => {
        if (state.currentMode !== 1) return;
        if (state.dayIndex >= state.daysList.length - 1) return;
        state.dayIndex++;
        state.selectedDayDate = state.daysList[state.dayIndex];
        renderChart();
      });
    }
  }

  /* ── Arama: kanal çözümle ── */
  async function onSearch() {
    const input = CalborUI.els.channelInput.value.trim();
    if (!input) {
      CalborUI.showError('Lütfen bir kanal linki, @handle veya ID girin.');
      return;
    }

    CalborUI.clearError();
    CalborUI.hidePreview();
    CalborUI.hideResults();
    CalborUI.btnLoading(CalborUI.els.searchBtn, true);

    try {
      const channel = await CalborAPI.resolveChannel(input);
      state.channel = channel;
      CalborUI.showPreview(channel);
    } catch (err) {
      CalborUI.showError(err.message);
    } finally {
      CalborUI.btnLoading(CalborUI.els.searchBtn, false);
    }
  }

  /* ── Analiz: video verilerini çek ── */
  async function onAnalyze() {
    if (!state.channel) return;

    CalborUI.btnLoading(CalborUI.els.analyzeBtn, true);
    CalborUI.showLoading();
    CalborUI.clearError();

    try {
      // 30 günlük veri çek (7 ve 1 gün de buradan filtrelenir)
      const result = await CalborAPI.getChannelVideos(
        state.channel.uploadsPlaylistId,
        35 // biraz fazla çek
      );

      state.videos = result.videos || [];

      if (state.videos.length === 0) {
        CalborUI.showError('Bu kanalda son 30 günde video bulunamadı.');
        CalborUI.hideLoading();
        CalborUI.btnLoading(CalborUI.els.analyzeBtn, false);
        return;
      }

      // En son video tarihini bul (Baku)
      state.latestVideoDate = CalborUtils.findLatestVideoDate(state.videos);

      // 1 günlük gezinme için: video atılan günleri çıkar
      const set = new Set();
      for (const v of state.videos) {
        set.add(CalborUtils.toBaku(v.publishedAt).dateStr);
      }
      state.daysList = Array.from(set).sort(); // eski -> yeni
      state.dayIndex = Math.max(0, state.daysList.length - 1);
      state.selectedDayDate = state.daysList[state.dayIndex] || state.latestVideoDate;

      state.currentMode = 30;

      CalborUI.hidePreview();
      CalborUI.hideLoading();
      CalborUI.btnLoading(CalborUI.els.analyzeBtn, false);

      // Grafik çiz
      CalborUI.setActiveTab(30);
      CalborUI.showResults();

      // Kısa gecikme ile skeleton göster sonra çiz
      CalborUI.showSkeleton();
      setTimeout(() => {
        CalborUI.hideSkeleton();
        renderChart();
      }, 400);
    } catch (err) {
      CalborUI.showError(err.message);
      CalborUI.hideLoading();
      CalborUI.btnLoading(CalborUI.els.analyzeBtn, false);
    }
  }

  /* ── Vazgeç ── */
  function onCancel() {
    state.channel = null;
    CalborUI.hidePreview();
    CalborUI.els.channelInput.value = '';
    CalborUI.els.channelInput.focus();
  }

  /* ── Moda göre videoları filtrele ── */
  function filterVideosByMode(mode) {
    if (mode === 1) {
      const target = state.selectedDayDate || state.latestVideoDate;
      return state.videos.filter((v) => CalborUtils.toBaku(v.publishedAt).dateStr === target);
    }

    const cutoffDate = CalborUtils.daysAgoBaku(mode);
    return state.videos.filter((v) => CalborUtils.toBaku(v.publishedAt).dateStr >= cutoffDate);
  }

  /* ── Yayın düzeni (tutarlılık) — opsiyonel metrik ── */
  function computeConsistency(videos) {
    const mins = videos.map((v) => {
      const b = CalborUtils.toBaku(v.publishedAt);
      return b.hour * 60 + b.minute;
    });

    if (mins.length < 3) {
      if (mins.length === 0) return { label: '—', sub: '' };
      return { label: 'Yetersiz veri', sub: 'En az 3 video gerekir' };
    }

    const mean = mins.reduce((a, b) => a + b, 0) / mins.length;
    const varr = mins.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / mins.length;
    const sd = Math.sqrt(varr);

    let label = 'Dağınık';
    if (sd <= 45) label = 'Düzenli';
    else if (sd <= 120) label = 'Orta';

    return { label, sub: `Sapma: ~${Math.round(sd)} dk` };
  }

  /* ── UI metriklerini güncelle (UI'nin fonksiyon imzasına göre uyumlu) ── */
  function updateMetricsFor(videos) {
    const peak = CalborUtils.findPeakHour(videos);

    // Eğer UI eski sürümse: updateMetrics(total, peakDisplay)
    // Yeni UI sürümse: updateMetrics(total, peak, rec, recSub, cons, consSub)
    const fn = CalborUI.updateMetrics;

    const total = videos.length;
    const peakDisplay = peak.display;

    // Önerilen saat = peak saat; güven = peak.count/total
    const pct = total ? Math.round((peak.count / total) * 100) : 0;
    const recDisplay = peak.display;
    const recSub = total ? `Güven: ${peak.count}/${total} (%${pct})` : '';

    const cons = computeConsistency(videos);

    try {
      if (typeof fn === 'function' && fn.length >= 6) {
        fn(total, peakDisplay, recDisplay, recSub, cons.label, cons.sub);
      } else {
        fn(total, peakDisplay);
      }
    } catch (e) {
      // UI tarafı farklıysa uygulama kırılmasın
      fn(total, peakDisplay);
    }
  }

  /* ── Grafik çiz (moda göre) ── */
  function renderChart() {
    const mode = state.currentMode;
    const videos = filterVideosByMode(mode);

    // Tarih etiketi + 1 günlük oklar (UI varsa)
    if (mode === 1) {
      const target = state.selectedDayDate || state.latestVideoDate;
      const parts = target.split('-');
      const dayLabel = CalborUtils.formatDayLabel(parseInt(parts[2], 10), parseInt(parts[1], 10));

      // UI yeni fonksiyonları varsa kullan
      if (typeof CalborUI.setDayNavVisible === 'function') CalborUI.setDayNavVisible(true);
      if (typeof CalborUI.setDayNavState === 'function') {
        CalborUI.setDayNavState({
          label: dayLabel,
          canPrev: state.dayIndex > 0,
          canNext: state.dayIndex < state.daysList.length - 1,
        });
      } else {
        // eski UI
        CalborUI.setDateLabel(dayLabel);
      }
    } else if (mode === 7) {
      if (typeof CalborUI.setDayNavVisible === 'function') CalborUI.setDayNavVisible(false);
      CalborUI.setDateLabel('Son 7 gün');
    } else {
      if (typeof CalborUI.setDayNavVisible === 'function') CalborUI.setDayNavVisible(false);
      CalborUI.setDateLabel('Son 30 gün');
    }

    // Metrikleri moda göre güncelle
    updateMetricsFor(videos);

    // Grafik
    if (mode === 1) {
      const target = state.selectedDayDate || state.latestVideoDate;
      CalborCharts.drawBandChart(state.videos, target);
    } else {
      // charts.js yeni sürümse animasyon paramını kabul eder
      try {
        if (CalborCharts.drawLineChart.length >= 3) {
          CalborCharts.drawLineChart(videos, mode, { animate: true });
        } else {
          CalborCharts.drawLineChart(videos, mode);
        }
      } catch (e) {
        CalborCharts.drawLineChart(videos, mode);
      }
    }
  }

  /* ── CSV Export: Son 30 gün, tarih + saat(dakika) ── */
  function downloadCSVLast30Days() {
    if (!state.videos || state.videos.length === 0) {
      CalborUI.showError('Önce bir kanal analiz etmelisin.');
      return;
    }

    const cutoff = CalborUtils.daysAgoBaku(30);

    const list = state.videos
      .map((v) => {
        const b = CalborUtils.toBaku(v.publishedAt);
        return {
          title: v.title || '',
          date: b.dateStr, // YYYY-MM-DD
          time: `${CalborUtils.pad(b.hour)}:${CalborUtils.pad(b.minute)}`, // HH:MM (dakika dahil)
          publishedAt: v.publishedAt,
          url: v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : ''),
        };
      })
      .filter((x) => x.date >= cutoff)
      .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

    const header = ['Baslik', 'Tarih', 'Saat', 'Link'];
    const rows = list.map((x) => [csvEscape(x.title), x.date, x.time, x.url]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');

    const now = new Date();
    const filename = `calbor_last30_${now.getFullYear()}-${CalborUtils.pad(now.getMonth() + 1)}-${CalborUtils.pad(now.getDate())}.csv`;

    triggerDownload(csv, filename);
  }

  function csvEscape(value) {
    const s = String(value ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function triggerDownload(text, filename) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 900);
  }

  /* ── DOM hazır olunca başlat ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();