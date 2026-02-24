/* ═══════════════════════════════════════════
   ui.js — DOM manipülasyonu, skeleton, tooltip, animasyon
   ═══════════════════════════════════════════ */

const CalborUI = (() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    channelInput:   $('#channelInput'),
    searchBtn:      $('#searchBtn'),
    searchError:    $('#searchError'),
    searchSection:  $('#searchSection'),

    previewSection: $('#previewSection'),
    previewAvatar:  $('#previewAvatar'),
    previewName:    $('#previewName'),
    analyzeBtn:     $('#analyzeBtn'),
    cancelBtn:      $('#cancelBtn'),

    resultsSection: $('#resultsSection'),
    metricsRow:     $('#metricsRow'),
    csvBtn:         $('#csvBtn'),

    metricTotal:    $('#metricTotal'),
    metricPeakHour: $('#metricPeakHour'),

    // ✅ Yeni metrikler
    metricRecommended:    $('#metricRecommended'),
    metricRecommendedSub: $('#metricRecommendedSub'),
    metricConsistency:    $('#metricConsistency'),
    metricConsistencySub: $('#metricConsistencySub'),

    modeTabs:       $$('.mode-tab'),
    modeDateLabel:  $('#modeDateLabel'),

    // ✅ 1 günlük oklar
    dayPrevBtn:     $('#dayPrevBtn'),
    dayNextBtn:     $('#dayNextBtn'),

    chartWrap:      $('#chartWrap'),
    chartCanvas:    $('#chartCanvas'),
    chartSkeleton:  $('#chartSkeleton'),

    chartTooltip:   $('#chartTooltip'),
    tooltipContent: $('#tooltipContent'),

    loadingOverlay: $('#loadingOverlay'),
  };

  function safeChannelImage(url) {
    if (!url) return "assets/default-avatar.png";

    // youtube farklı domainlerden verebiliyor
    if (url.includes("googleusercontent")) return url;

    try {
      const u = new URL(url);
      u.searchParams.set("s", "256");
      return u.toString();
    } catch {
      return url;
    }
  }
  function show(el) {
    if (!el) return;
    el.classList.remove('hidden');
    void el.offsetWidth; // anim tetik
  }

  function hide(el) {
    if (!el) return;
    el.classList.add('hidden');
  }

  function btnLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.classList.add('is-loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
  }

  function showError(msg) {
    els.searchError.textContent = msg || '';
  }

  function clearError() {
    els.searchError.textContent = '';
  }

  function showPreview(channel) {
  const urls = [
    channel.thumbnails?.high,
    channel.thumbnails?.medium,
    channel.thumbnails?.def,
    channel.thumbnail
  ].filter(Boolean);

  // aynı origin’den yükle -> daha stabil
  const qp = new URLSearchParams();
  qp.set('cid', channel.id);

  // her URL'i ayrı ayrı encode ederek ekle
  qp.set('urls', urls.map(u => encodeURIComponent(u)).join('|'));

  els.previewAvatar.src = `/api/channel-avatar?cid=${encodeURIComponent(channel.id)}`;
      
  els.previewAvatar.alt = channel.title;
  els.previewName.textContent = channel.title;

  show(els.previewSection);

  const card = els.previewSection.querySelector('.preview-card');
  card.classList.remove('fade-in');
  void card.offsetWidth;
  card.classList.add('fade-in');
}

  function hidePreview() {
    hide(els.previewSection);
  }

  function showResults() {
    show(els.resultsSection);

    els.resultsSection.querySelectorAll('.fade-in').forEach((el, i) => {
      el.style.animationDelay = `${i * 0.08}s`;
      el.classList.remove('fade-in');
      void el.offsetWidth;
      el.classList.add('fade-in');
    });
  }

  function hideResults() {
    hide(els.resultsSection);
  }

  function animateNumber(el, target) {
    if (!el) return;
    const duration = 600;
    const start = performance.now();
    const from = 0;

    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = Math.round(from + (target - from) * ease);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ✅ Yeni: metrik seti (4 kart)
  function updateMetrics(total, peakHourDisplay, recDisplay, recSub, consLabel, consSub) {
    animateNumber(els.metricTotal, total);
    els.metricPeakHour.textContent = peakHourDisplay || '—';

    if (els.metricRecommended) els.metricRecommended.textContent = recDisplay || '—';
    if (els.metricRecommendedSub) els.metricRecommendedSub.textContent = recSub || '';

    if (els.metricConsistency) els.metricConsistency.textContent = consLabel || '—';
    if (els.metricConsistencySub) els.metricConsistencySub.textContent = consSub || '';
  }

  function setActiveTab(mode) {
    els.modeTabs.forEach((tab) => {
      const isActive = tab.dataset.mode === String(mode);
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive);
    });
  }

  function setDateLabel(text) {
    els.modeDateLabel.textContent = text || '';
  }

  // ✅ 1 günlük okları göster/gizle
  function setDayNavVisible(isVisible) {
    if (!els.dayPrevBtn || !els.dayNextBtn) return;
    els.dayPrevBtn.classList.toggle('hidden', !isVisible);
    els.dayNextBtn.classList.toggle('hidden', !isVisible);
  }

  // ✅ 1 günlük okların enable/disable + label
  function setDayNavState({ label, canPrev, canNext }) {
    setDateLabel(label);
    if (els.dayPrevBtn) els.dayPrevBtn.disabled = !canPrev;
    if (els.dayNextBtn) els.dayNextBtn.disabled = !canNext;
  }

  function showSkeleton() {
    show(els.chartSkeleton);
    const ctx = els.chartCanvas.getContext('2d');
    ctx.clearRect(0, 0, els.chartCanvas.width, els.chartCanvas.height);
  }

  function hideSkeleton() {
    hide(els.chartSkeleton);
  }

  function showLoading() {
    show(els.loadingOverlay);
  }

  function hideLoading() {
    hide(els.loadingOverlay);
  }

  function showTooltip(x, y, htmlContent) {
    els.tooltipContent.innerHTML = htmlContent;
    els.chartTooltip.classList.remove('hidden');

    const rect = els.chartTooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x + 14;
    let top = y - 10;

    if (left + rect.width > vw - 12) left = x - rect.width - 14;
    if (top + rect.height > vh - 12) top = vh - rect.height - 12;
    if (top < 12) top = 12;
    if (left < 12) left = 12;

    els.chartTooltip.style.left = `${left}px`;
    els.chartTooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    els.chartTooltip.classList.add('hidden');
  }

  function buildTooltipHTML(videos) {
    return videos
      .map(
        (v) => `
      <div class="tooltip-item">
        <img class="tooltip-thumb" src="${escapeAttr(v.thumbnail)}" alt="" loading="lazy" />
        <div>
          <div class="tooltip-title">${escapeHTML(v.title)}</div>
          <div class="tooltip-time">${escapeHTML(v.timeStr)}</div>
        </div>
      </div>`
      )
      .join('');
  }

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return {
    els,
    show,
    hide,
    btnLoading,
    showError,
    clearError,
    showPreview,
    hidePreview,
    showResults,
    hideResults,
    updateMetrics,
    setActiveTab,
    setDateLabel,
    setDayNavVisible,
    setDayNavState,
    showSkeleton,
    hideSkeleton,
    showLoading,
    hideLoading,
    showTooltip,
    hideTooltip,
    buildTooltipHTML,
  };
})();