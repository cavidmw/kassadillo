/* =========================
   video-system.js (REBUILD)
   - Sağ grid: her zaman 8 slot (2x4)
   - Zaman otomatik: gün -> hafta -> ay -> yıl
   - Başlık/meta yerleşimi YouTube gibi stabil
   ========================= */

(() => {
  const $ = (id) => document.getElementById(id);

  const addVideoBtn = $("addVideoBtn");
  const videoModal = $("videoModal");

  const thumbInput = $("thumbInput");
  const videoTitleInput = $("videoTitleInput");
  const viewsInput = $("viewsInput");
  const timeAgoInput = $("timeAgoInput");
  const saveVideoBtn = $("saveVideoBtn");

  const videoGrid = $("videoGrid");
  const videoList = $("videoList");

  const MAX_VIDEOS = 8;

  function openVideoModal() { window.UI?.openModal("videoModal"); }
  function closeVideoModal() { window.UI?.closeModal("videoModal"); }

  function digitsOnly(raw) {
    return String(raw || "").replace(/[^\d]/g, "");
  }

  function formatViewsLabel(raw) {
    const pretty = window.UI?.formatCountTR(raw) || "";
    if (!pretty) return "0 görüntülenme";
    return `${pretty} görüntülenme`;
  }

  // Zaman normalize:
  // - kullanıcı "20" yazarsa => 20 gün önce
  // - kullanıcı "20 gün" yazarsa => 20 gün önce
  // - kullanıcı "3 hafta önce" / "2 ay önce" / "1 yıl önce" yazarsa aynen bırak
  function normalizeTimeAgo(input) {
    const raw = String(input || "").trim();
    if (!raw) return "—";

    const lower = raw.toLowerCase();

    // kullanıcı zaten "hafta/ay/yıl" yazdıysa aynen bırak
    if (/(hafta|ay|yıl|sene)\s*önce/.test(lower)) return raw;
    if (/gün\s*önce/.test(lower)) {
      // gün sayısını çıkarıp tekrar normalize edelim
      const n = Number((lower.match(/\d+/) || [])[0] || "");
      if (!Number.isFinite(n) || n <= 0) return raw;
      return daysToHuman(n);
    }

    // sadece sayıysa gün kabul et
    const justNumber = Number(raw);
    if (Number.isFinite(justNumber) && justNumber > 0) {
      return daysToHuman(justNumber);
    }

    // içinde sayı varsa onu gün sayısı kabul et
    const m = lower.match(/\d+/);
    if (m) {
      const n = Number(m[0]);
      if (Number.isFinite(n) && n > 0) return daysToHuman(n);
    }

    // hiç sayı yoksa olduğu gibi göster
    return raw;
  }

  function daysToHuman(days) {
    const d = Math.max(1, Math.floor(days));

    if (d <= 14) return `${d} gün önce`;

    if (d <= 28) {
      const w = Math.round(d / 7);
      return `${w} hafta önce`;
    }

    if (d <= 365) {
      const mo = Math.round(d / 30);
      return `${mo} ay önce`;
    }

    const y = Math.round(d / 365);
    return `${y} yıl önce`;
  }

  function resetVideoForm() {
    if (thumbInput) thumbInput.value = "";
    if (videoTitleInput) videoTitleInput.value = "";
    if (viewsInput) viewsInput.value = "";
    if (timeAgoInput) timeAgoInput.value = "";
  }

  function syncAddBtnState() {
    const count = window.AppState?.videos?.length || 0;
    if (addVideoBtn) addVideoBtn.disabled = count >= MAX_VIDEOS;
  }

  function createCard(data, isEmpty = false) {
    const card = document.createElement("div");
    card.className = "ytCard" + (isEmpty ? " ytCard--empty" : "");

    const thumb = document.createElement("div");
    thumb.className = "ytThumb";

    if (!isEmpty) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = data.thumbUrl || "";
      thumb.appendChild(img);
    }

    const t = document.createElement("div");
    t.className = "ytCardTitle";
    t.textContent = isEmpty ? "—" : (data.title || "Başlıksız video");

    const meta = document.createElement("div");
    meta.className = "ytCardMeta";
    if (isEmpty) {
      meta.textContent = "—";
    } else {
      const views = formatViewsLabel(data.viewsRaw);
      const time = normalizeTimeAgo(data.timeAgo);
      meta.textContent = `${views} • ${time}`;
    }

    card.appendChild(thumb);
    card.appendChild(t);
    card.appendChild(meta);
    return card;
  }

  function renderRightGridFixed8() {
    if (!videoGrid) return;
    videoGrid.innerHTML = "";

    const vids = window.AppState?.videos || [];

    for (let i = 0; i < MAX_VIDEOS; i++) {
      const v = vids[i];
      videoGrid.appendChild(v ? createCard(v, false) : createCard({}, true));
    }
  }

  function renderLeftList() {
    if (!videoList) return;
    videoList.innerHTML = "";

    const vids = window.AppState?.videos || [];

    vids.forEach((v, idx) => {
      const item = document.createElement("div");
      item.className = "miniItem";

      const left = document.createElement("div");
      left.className = "miniItem__left";

      const t = document.createElement("div");
      t.className = "miniItem__title";
      t.textContent = v.title || "Başlıksız video";

      const m = document.createElement("div");
      m.className = "miniItem__meta";
      m.textContent = `${formatViewsLabel(v.viewsRaw)} • ${normalizeTimeAgo(v.timeAgo)}`;

      left.appendChild(t);
      left.appendChild(m);

      const actions = document.createElement("div");
      actions.className = "miniItem__actions";

      const del = document.createElement("button");
      del.className = "btn btn--ghost";
      del.type = "button";
      del.textContent = "Sil";
      del.addEventListener("click", () => {
        if (v.thumbUrl) URL.revokeObjectURL(v.thumbUrl);
        window.AppState.videos.splice(idx, 1);
        renderAll();
        syncAddBtnState();
      });

      actions.appendChild(del);

      item.appendChild(left);
      item.appendChild(actions);

      videoList.appendChild(item);
    });
  }

  function renderAll() {
    renderRightGridFixed8();
    renderLeftList();
  }

  // ----- Events -----
  addVideoBtn?.addEventListener("click", () => {
    syncAddBtnState();
    const count = window.AppState?.videos?.length || 0;
    if (count >= MAX_VIDEOS) return;
    resetVideoForm();
    openVideoModal();
  });

  // views: sadece rakam
  viewsInput?.addEventListener("input", () => {
    const c = digitsOnly(viewsInput.value);
    if (viewsInput.value !== c) viewsInput.value = c;
  });

  saveVideoBtn?.addEventListener("click", () => {
    const count = window.AppState?.videos?.length || 0;
    if (count >= MAX_VIDEOS) {
      closeVideoModal();
      return;
    }

    const file = thumbInput?.files?.[0] || null;
    if (!file) {
      alert("Lütfen thumbnail seç.");
      return;
    }

    const title = (videoTitleInput?.value || "").trim();
    const viewsRaw = digitsOnly(viewsInput?.value || "");
    const timeAgo = (timeAgoInput?.value || "").trim();

    const thumbUrl = URL.createObjectURL(file);

    window.AppState.videos.push({
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      thumbUrl,
      title: title || "Başlıksız video",
      viewsRaw,
      timeAgo: timeAgo || "—",
    });

    closeVideoModal();
    renderAll();
    syncAddBtnState();
  });

  // modal kapanınca form temizle
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-close='videoModal']");
    const backdrop = e.target.classList?.contains("modal__backdrop") && e.target.getAttribute("data-close") === "videoModal";
    if (closeBtn || backdrop) resetVideoForm();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && videoModal?.classList.contains("is-open")) resetVideoForm();
  });

  document.addEventListener("DOMContentLoaded", () => {
    syncAddBtnState();
    renderAll();
  });
})();
