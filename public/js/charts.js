/* ═══════════════════════════════════════════
   charts.js — Canvas chart çizimi (smooth animasyon + hover)
   ═══════════════════════════════════════════ */

const CalborCharts = (() => {
  'use strict';

  const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  let canvas, ctx;
  let currentDots = [];   // line chart noktaları
  let currentBands = [];  // 1 günlük bandlar (24 saat)
  let currentMode = 30;

  const C = {
    grid: 'rgba(255,255,255,0.08)',
    gridText: 'rgba(233,238,245,0.55)',
    line: 'rgba(62,166,255,0.65)',
    dot: 'rgba(62,166,255,1)',
    dotGlow: 'rgba(62,166,255,0.25)',
    bandOn: 'rgba(62,166,255,0.28)',
    bandOff: 'rgba(255,255,255,0.06)',
    bandStroke: 'rgba(255,255,255,0.10)',
  };

  function initCanvas(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resizeCanvas();
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * DPR);
    canvas.height = Math.floor(rect.height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function clear() {
    const W = canvas.width / DPR;
    const H = canvas.height / DPR;
    ctx.clearRect(0, 0, W, H);
  }

  // ─────────────────────────────────────────────
  // Hover handlers
  // ─────────────────────────────────────────────
  function handleMouseMove(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Önce line dot hover
    const hitDot = hitTestDot(mx, my);
    if (hitDot) {
      const html = CalborUI.buildTooltipHTML([hitDot.video]);
      CalborUI.showTooltip(e.clientX, e.clientY, html);
      return;
    }

    // Sonra band hover
    const hitBand = hitTestBand(mx, my);
    if (hitBand) {
      const html = CalborUI.buildTooltipHTML(hitBand.videos);
      CalborUI.showTooltip(e.clientX, e.clientY, html);
      return;
    }

    CalborUI.hideTooltip();
  }

  function handleMouseLeave() {
    CalborUI.hideTooltip();
  }

  function hitTestDot(x, y) {
    for (let i = currentDots.length - 1; i >= 0; i--) {
      const d = currentDots[i];
      const r = (d.radius || 5) + 8;
      const dx = x - d.x;
      const dy = y - d.y;
      if (dx * dx + dy * dy <= r * r) return d;
    }
    return null;
  }

  function hitTestBand(x, y) {
    for (let i = 0; i < currentBands.length; i++) {
      const b = currentBands[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.videos && b.videos.length) return b;
        return null;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // Line chart (30 / 7)
  // X: gün, Y: 00-23 saat (Baku)
  // ─────────────────────────────────────────────
  function drawLineChart(videos, days, opts = {}) {
    currentMode = days;
    currentDots = [];
    currentBands = [];
    resizeCanvas();

    const animate = opts.animate !== false;

    const W = canvas.width / DPR;
    const H = canvas.height / DPR;
    const PAD = { top: 24, right: 20, bottom: 40, left: 52 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    // Gün listesi (Baku)
    const dayLabels = [];
    for (let i = days - 1; i >= 0; i--) dayLabels.push(CalborUtils.daysAgoBaku(i));

    const dayIndexMap = {};
    dayLabels.forEach((d, i) => (dayIndexMap[d] = i));

    // Noktalar
    const dots = [];
    for (const v of videos) {
      const b = CalborUtils.toBaku(v.publishedAt);
      const di = dayIndexMap[b.dateStr];
      if (di === undefined) continue;

      const x = PAD.left + (di / (days - 1 || 1)) * plotW;

      const hourFrac = b.hour + b.minute / 60;
      const y = PAD.top + plotH - (hourFrac / 23) * plotH;

      const rounded = CalborUtils.roundMinute(b.hour, b.minute);

      dots.push({
        x,
        y,
        radius: 5,
        video: { ...v, timeStr: rounded.display, dayLabel: b.dayLabel },
      });
    }

    dots.sort((a, b) => new Date(a.video.publishedAt) - new Date(b.video.publishedAt));

    // Toplam path length (dash animasyon)
    let totalLen = 0;
    for (let i = 1; i < dots.length; i++) {
      totalLen += Math.hypot(dots[i].x - dots[i - 1].x, dots[i].y - dots[i - 1].y);
    }

    function drawGrid() {
      clear();

      // yatay saat çizgileri
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      const yHours = [0, 4, 8, 12, 16, 20, 23];
      for (const h of yHours) {
        const y = PAD.top + plotH - (h / 23) * plotH;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + plotW, y);
        ctx.stroke();

        ctx.fillStyle = C.gridText;
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${CalborUtils.pad(h)}:00`, PAD.left - 10, y);
      }

      // dikey gün çizgileri + label
      const dayStep = days <= 7 ? 1 : Math.ceil(days / 8);
      for (let i = 0; i < days; i += dayStep) {
        const x = PAD.left + (i / (days - 1 || 1)) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, PAD.top);
        ctx.lineTo(x, PAD.top + plotH);
        ctx.stroke();

        const parts = dayLabels[i].split('-');
        const label = `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}`;
        ctx.fillStyle = C.gridText;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x, PAD.top + plotH + 10);
      }

      // son gün label (sağ)
      if (days > 1) {
        const x = PAD.left + plotW;
        const last = dayLabels[days - 1].split('-');
        const label = `${parseInt(last[2], 10)}/${parseInt(last[1], 10)}`;
        ctx.fillStyle = C.gridText;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x, PAD.top + plotH + 10);
      }

      ctx.setLineDash([]);
    }

    function drawLine(progress) {
      if (dots.length <= 1) return;

      ctx.save();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1.7;

      // smooth reveal: dash offset
      if (totalLen > 0) {
        ctx.setLineDash([totalLen, totalLen]);
        ctx.lineDashOffset = totalLen * (1 - progress);
      }

      ctx.beginPath();
      ctx.moveTo(dots[0].x, dots[0].y);
      for (let i = 1; i < dots.length; i++) ctx.lineTo(dots[i].x, dots[i].y);
      ctx.stroke();

      ctx.restore();
    }

    function drawDots(progress) {
      const a = Math.max(0, Math.min(progress, 1));
      for (const d of dots) {
        // glow
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(62,166,255,${0.22 * a})`;
        ctx.fill();

        // dot
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(62,166,255,${Math.max(0.35, a)})`;
        ctx.fill();
      }
    }

    // çiz
    drawGrid();

    if (!animate || dots.length <= 1) {
      drawLine(1);
      drawDots(1);
      currentDots = dots;
      return;
    }

    const dur = 520;
    const t0 = performance.now();

    function tick(now) {
      const t = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic

      drawGrid();
      drawLine(ease);
      drawDots(ease);

      if (t < 1) requestAnimationFrame(tick);
      else currentDots = dots;
    }
    requestAnimationFrame(tick);
  }

  // ─────────────────────────────────────────────
  // Band chart (1 Gün)
  // 24 saat dilimi: video olan saatler parlıyor
  // ─────────────────────────────────────────────
  function drawBandChart(allVideos, targetDateStr) {
    currentMode = 1;
    currentDots = [];
    currentBands = [];
    resizeCanvas();

    const W = canvas.width / DPR;
    const H = canvas.height / DPR;

    const PAD = { top: 22, right: 18, bottom: 34, left: 18 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    // hedef güne filtrele
    const vids = allVideos.filter((v) => CalborUtils.toBaku(v.publishedAt).dateStr === targetDateStr);

    // saat -> videolar
    const map = new Map();
    for (let h = 0; h < 24; h++) map.set(h, []);
    for (const v of vids) {
      const b = CalborUtils.toBaku(v.publishedAt);
      const rounded = CalborUtils.roundMinute(b.hour, b.minute);
      const vv = { ...v, timeStr: rounded.display, dayLabel: b.dayLabel };
      map.get(b.hour).push(vv);
    }

    // grid: 24 bar
    clear();

    // label üst
    ctx.fillStyle = C.gridText;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('24 saat dilimi (video olan saatler aydınlanır)', PAD.left, 6);

    const gap = 10;
    const cols = 6;                 // 6x4 = 24
    const rows = 4;
    const cellW = (plotW - gap * (cols - 1)) / cols;
    const cellH = (plotH - gap * (rows - 1)) / rows;

    const bands = [];

    for (let i = 0; i < 24; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;

      const x = PAD.left + c * (cellW + gap);
      const y = PAD.top + r * (cellH + gap);

      const videosInHour = map.get(i) || [];
      const on = videosInHour.length > 0;

      // background
      ctx.beginPath();
      roundRect(ctx, x, y, cellW, cellH, 16);
      ctx.fillStyle = on ? C.bandOn : C.bandOff;
      ctx.fill();

      // stroke
      ctx.strokeStyle = C.bandStroke;
      ctx.lineWidth = 1;
      ctx.stroke();

      // text
      ctx.fillStyle = on ? 'rgba(233,238,245,0.95)' : 'rgba(233,238,245,0.55)';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${CalborUtils.pad(i)}:00`, x + 12, y + 10);

      // count
      if (on) {
        ctx.fillStyle = 'rgba(233,238,245,0.85)';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(`${videosInHour.length} video`, x + cellW - 12, y + 10);
      }

      bands.push({
        hour: i,
        x, y, w: cellW, h: cellH,
        videos: videosInHour,
      });
    }

    currentBands = bands;
  }

  // helper: rounded rect
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  return {
    initCanvas,
    drawLineChart,
    drawBandChart,
    handleMouseMove,
    handleMouseLeave,
  };
})();