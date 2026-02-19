/* =========================
   ui-manager.js
   - Genel state
   - Tema (sadece preview)
   - Metin senkronu
   - Handle doğrulama
   - Abone formatı
   - PP yükleme
   - Modal aç/kapat altyapısı
   ========================= */

(() => {
  // ---------- Global state ----------
  window.AppState = {
    theme: "dark",
    channel: {
      name: "Kanal Adı",
      handle: "@handle",
      subsRaw: "",
      aboutRaw: "",
    },
    images: {
      ppUrl: null,
      // banner: cropper-logic.js yönetiyor
    },
    videos: [],
  };

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  function setText(el, text) {
    if (!el) return;
    el.textContent = text ?? "";
  }

  // "Herkese açık kullanıcı adı desteklenmeyen karakterler içeriyor"
  // Kurallar: boşluk yok, emoji yok, @ ile başlamalı, sadece a-z 0-9 . _ -
  function validateHandle(raw) {
    const value = (raw || "").trim();

    if (value.length === 0) return { ok: true, value: "" };

    // başında @ yoksa otomatik eklemeyelim (kullanıcı görsün)
    if (!value.startsWith("@")) return { ok: false, value };

    // boşluk var mı?
    if (/\s/.test(value)) return { ok: false, value };

    // emoji/surrogate (genel) yakalama
    // (emoji ve çoğu özel karakter surrogate pair kullanır)
    if (/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(value)) return { ok: false, value };

    // izinli karakterler
    if (!/^@[a-z0-9._-]+$/i.test(value)) return { ok: false, value };

    return { ok: true, value };
  }

  // 45664 => 45.6B (B = bin)
  // 1250000 => 1.2Mn
  // 2500000000 => 2.5Mr
  function formatCountTR(raw) {
    if (raw == null) return "";
    const cleaned = String(raw).replace(/[^\d]/g, "");
    if (!cleaned) return "";

    const n = Number(cleaned);
    if (!Number.isFinite(n)) return "";

    const fmt = (num) => {
      const str = num.toFixed(1);
      return str.endsWith(".0") ? str.slice(0, -2) : str;
    };

    if (n >= 1_000_000_000) return `${fmt(n / 1_000_000_000)}Mr`;
    if (n >= 1_000_000) return `${fmt(n / 1_000_000)}Mn`;
    if (n >= 1_000) return `${fmt(n / 1_000)}B`;
    return String(n);
  }

  function formatSubsLabel(raw) {
    const pretty = formatCountTR(raw);
    if (!pretty) return "0 abone";
    return `${pretty} abone`;
  }

  function setAboutWithVignette(el, text) {
    if (!el) return;

    // temizle
    el.textContent = "";
    el.style.paddingRight = "0px";

    const raw = (text || "").replace(/\s+/g, " ").trim();

    // max 85 + ...
    const MAX = 85;
    const shown = raw.length > MAX ? raw.slice(0, MAX).trimEnd() + "..." : raw;

    // metin
    const span = document.createElement("span");
    span.textContent = shown;
    el.appendChild(span);

    // vignette overlay (CSS yoksa JS ile)
    // sadece kırpma olduysa ekleyelim
    const hadTrim = raw.length > MAX;
    const existing = el.querySelector(".js-vignette");
    if (existing) existing.remove();

    if (hadTrim) {
      el.style.position = "relative";
      el.style.paddingRight = "34px";

      const v = document.createElement("div");
      v.className = "js-vignette";
      v.style.position = "absolute";
      v.style.top = "0";
      v.style.right = "0";
      v.style.width = "56px";
      v.style.height = "100%";
      v.style.pointerEvents = "none";

      // tema rengine göre gradient
      const isLight = document.getElementById("ytPreview")?.classList.contains("yt--light");
      v.style.background = isLight
        ? "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.92) 55%, rgba(255,255,255,1))"
        : "linear-gradient(90deg, rgba(15,15,15,0), rgba(15,15,15,.92) 55%, rgba(15,15,15,1))";

      el.appendChild(v);
    }
  }

  // ---------- Modal system ----------
  function openModal(modalId) {
    const modal = $(modalId);
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(modalId) {
    const modal = $(modalId);
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function wireModalCloseHandlers() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-close]");
      if (!btn) return;
      const id = btn.getAttribute("data-close");
      closeModal(id);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      // açık olan ilk modalı kapat
      const open = document.querySelector(".modal.is-open");
      if (open && open.id) closeModal(open.id);
    });
  }

  // Dışarıdan kullanılacaklar
  window.UI = {
    openModal,
    closeModal,
    validateHandle,
    formatCountTR,
    formatSubsLabel,
    setAboutWithVignette,
  };

  // ---------- DOM wiring ----------
  function init() {
    const ytPreview = $("ytPreview");

    // Preview refs
    const channelNamePreview = $("channelNamePreview");
    const handlePreview = $("handlePreview");
    const subsPreview = $("subsPreview");
    const aboutPreview = $("aboutPreview");
    const ppPreviewImg = $("ppPreviewImg");
    const ppFallback = document.querySelector(".ytPp__fallback");

    // Inputs
    const channelNameInput = $("channelNameInput");
    const handleInput = $("handleInput");
    const handleError = $("handleError");
    const subsInput = $("subsInput");
    const aboutInput = $("aboutInput");

    const ppInput = $("ppInput");
    const removePpBtn = $("removePpBtn");

    const themeLightBtn = $("themeLightBtn");
    const themeDarkBtn = $("themeDarkBtn");

    // Defaults sync
    setText(channelNamePreview, AppState.channel.name);
    setText(handlePreview, AppState.channel.handle);
    setText(subsPreview, formatSubsLabel(AppState.channel.subsRaw));
    setAboutWithVignette(aboutPreview, AppState.channel.aboutRaw);

    // Channel name
    channelNameInput?.addEventListener("input", () => {
      AppState.channel.name = channelNameInput.value || "Kanal Adı";
      setText(channelNamePreview, AppState.channel.name);
    });

    // Handle
    handleInput?.addEventListener("input", () => {
      const raw = handleInput.value || "";
      const res = validateHandle(raw);

      if (!raw.trim()) {
        handleError.textContent = "";
        AppState.channel.handle = "@handle";
        setText(handlePreview, "@handle");
        return;
      }

      if (!res.ok) {
        handleError.textContent = "Herkese açık kullanıcı adı desteklenmeyen karakterler içeriyor";
      } else {
        handleError.textContent = "";
      }

      // Ön izleme: ne yazdıysa göster (ama boşsa default)
      AppState.channel.handle = raw.trim() || "@handle";
      setText(handlePreview, AppState.channel.handle);
    });

    // Subs
    subsInput?.addEventListener("input", () => {
      AppState.channel.subsRaw = subsInput.value || "";
      setText(subsPreview, formatSubsLabel(AppState.channel.subsRaw));
    });

    // About
    aboutInput?.addEventListener("input", () => {
      AppState.channel.aboutRaw = aboutInput.value || "";
      setAboutWithVignette(aboutPreview, AppState.channel.aboutRaw);
    });

    // Theme (only preview panel)
    function setTheme(theme) {
      AppState.theme = theme;
      if (!ytPreview) return;

      if (theme === "dark") {
        ytPreview.classList.remove("yt--light");
        ytPreview.classList.add("yt--dark"); // sadece isim, değişkenleri .yt yönetiyor
        themeDarkBtn?.classList.add("chip--active");
        themeLightBtn?.classList.remove("chip--active");
      } else {
        ytPreview.classList.add("yt--light");
        ytPreview.classList.remove("yt--dark");
        themeLightBtn?.classList.add("chip--active");
        themeDarkBtn?.classList.remove("chip--active");
      }

      // vignette gradient güncelle
      setAboutWithVignette(aboutPreview, AppState.channel.aboutRaw);
    }
    setTheme(AppState.theme);   // <-- BUNU EKLE (default açılış karanlık)

    themeLightBtn?.addEventListener("click", () => setTheme("light"));
    themeDarkBtn?.addEventListener("click", () => setTheme("dark"));

    // PP upload (GIF yasak)
    ppInput?.addEventListener("change", () => {
      const file = ppInput.files?.[0];
      if (!file) return;

      if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) {
        alert("PP için GIF yasak.");
        ppInput.value = "";
        return;
      }

      // eski url temizle
      if (AppState.images.ppUrl) URL.revokeObjectURL(AppState.images.ppUrl);

      const url = URL.createObjectURL(file);
      AppState.images.ppUrl = url;

      if (ppPreviewImg) {
        ppPreviewImg.src = url;
        ppPreviewImg.style.display = "block";
      }
      if (ppFallback) ppFallback.style.display = "none";

      removePpBtn.disabled = false;
    });

    removePpBtn?.addEventListener("click", () => {
      if (AppState.images.ppUrl) URL.revokeObjectURL(AppState.images.ppUrl);
      AppState.images.ppUrl = null;

      if (ppPreviewImg) {
        ppPreviewImg.removeAttribute("src");
        ppPreviewImg.style.display = "none";
      }
      if (ppFallback) ppFallback.style.display = "block";

      if (ppInput) ppInput.value = "";
      removePpBtn.disabled = true;
    });

    // Modal close system
    wireModalCloseHandlers();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
