/* =========================
   cropper-logic.js
   - Banner yükleme -> modal aç
   - Cropper.js CDN ile otomatik yükleme (kurulum yok)
   - Kırpılan görseli preview banner'a bas
   - Düzenle / kaldır
   ========================= */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- DOM refs
  const bannerInput = $("bannerInput");
  const editBannerBtn = $("editBannerBtn");
  const removeBannerBtn = $("removeBannerBtn");

  const bannerModal = $("bannerModal");
  const saveBannerBtn = $("saveBannerBtn");
  const bannerZoom = $("bannerZoom");

  const bannerPreviewImg = $("bannerPreviewImg");
  const bannerFallback = document.querySelector(".ytBanner__fallback");

  // Crop stage
  const cropStage = bannerModal?.querySelector(".cropStage");

  // ---- Cropper state
  let cropper = null;

  const BannerState = {
    originalUrl: null,     // yüklenen ham görsel
    croppedUrl: null,      // kırpılmış sonuç
    cropperData: null,     // tekrar düzenleme için
    ready: false,
  };

  // ---- Load Cropper.js from CDN (no install)
  function loadCropperLib() {
    return new Promise((resolve, reject) => {
      if (window.Cropper) return resolve();

      // CSS
      const cssId = "cropper-css";
      if (!document.getElementById(cssId)) {
        const link = document.createElement("link");
        link.id = cssId;
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/cropperjs@1.6.2/dist/cropper.min.css";
        document.head.appendChild(link);
      }

      // JS
      const s = document.createElement("script");
      s.src = "https://unpkg.com/cropperjs@1.6.2/dist/cropper.min.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Cropper.js yüklenemedi"));
      document.body.appendChild(s);
    });
  }

  function openBannerModal() {
    if (!window.UI) return;
    window.UI.openModal("bannerModal");
  }

  function closeBannerModal() {
    if (!window.UI) return;
    window.UI.closeModal("bannerModal");
  }

  function destroyCropper() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  }

  function clearStage() {
    if (!cropStage) return;
    cropStage.querySelectorAll("img[data-role='crop-image']").forEach((n) => n.remove());
    cropStage.querySelectorAll(".cropStage__placeholder").forEach((n) => n.style.display = "none");
  }

  function showStagePlaceholder() {
    if (!cropStage) return;
    const ph = cropStage.querySelector(".cropStage__placeholder");
    if (ph) ph.style.display = "flex";
  }

  function computeAspectRatioForDesktopPreview() {
    // Sağdaki banner alanının oranını baz alalım (en yakın masaüstü hissi)
    const w = bannerPreviewImg?.clientWidth || 2560;
    const h = bannerPreviewImg?.clientHeight || 423;
    return w / h;
  }

  async function startCroppingWithUrl(imgUrl) {
    await loadCropperLib();

    destroyCropper();
    clearStage();

    const img = document.createElement("img");
    img.dataset.role = "crop-image";
    img.src = imgUrl;
    img.alt = "Banner";
    img.style.maxWidth = "none"; // cropper yönetiyor
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.display = "block";

    // Crop stage içine görseli koy
    cropStage.appendChild(img);

    const aspect = computeAspectRatioForDesktopPreview();

    cropper = new window.Cropper(img, {
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 1,
      background: false,
      responsive: true,
      modal: true,
      guides: false,
      center: true,
      highlight: false,
      zoomOnWheel: false, // zoom slider ile
      aspectRatio: aspect,
      ready() {
        BannerState.ready = true;

        // tekrar düzenleme datası varsa uygula
        if (BannerState.cropperData) {
          try { cropper.setData(BannerState.cropperData); } catch (_) {}
        }

        // slider sync
        bannerZoom.value = "1";
      }
    });
  }

  function setBannerPreview(url) {
    if (!bannerPreviewImg) return;

    bannerPreviewImg.src = url;
    bannerPreviewImg.style.display = "block";
    if (bannerFallback) bannerFallback.style.display = "none";
  }

  function resetBannerPreview() {
    if (!bannerPreviewImg) return;

    bannerPreviewImg.removeAttribute("src");
    bannerPreviewImg.style.display = "none";
    if (bannerFallback) bannerFallback.style.display = "block";
  }

  function revokeIfAny(key) {
    if (BannerState[key]) {
      URL.revokeObjectURL(BannerState[key]);
      BannerState[key] = null;
    }
  }

  // ---- Events
  bannerInput?.addEventListener("change", async () => {
    const file = bannerInput.files?.[0];
    if (!file) return;

    // eski url’leri temizle
    revokeIfAny("originalUrl");
    revokeIfAny("croppedUrl");
    BannerState.cropperData = null;

    BannerState.originalUrl = URL.createObjectURL(file);

    // modal aç + crop başlat
    openBannerModal();
    try {
      await startCroppingWithUrl(BannerState.originalUrl);
    } catch (e) {
      alert("Banner düzenleyici yüklenemedi. İnternet bağlantını kontrol et.");
      console.error(e);
      closeBannerModal();
    }
  });

  editBannerBtn?.addEventListener("click", async () => {
    if (!BannerState.originalUrl) return;

    openBannerModal();
    try {
      await startCroppingWithUrl(BannerState.originalUrl);
    } catch (e) {
      alert("Banner düzenleyici yüklenemedi. İnternet bağlantını kontrol et.");
      console.error(e);
      closeBannerModal();
    }
  });

  removeBannerBtn?.addEventListener("click", () => {
    destroyCropper();
    showStagePlaceholder();

    revokeIfAny("originalUrl");
    revokeIfAny("croppedUrl");
    BannerState.cropperData = null;
    BannerState.ready = false;

    if (bannerInput) bannerInput.value = "";
    resetBannerPreview();

    editBannerBtn.disabled = true;
    removeBannerBtn.disabled = true;
  });

  bannerZoom?.addEventListener("input", () => {
    if (!cropper) return;
    const v = Number(bannerZoom.value);
    if (!Number.isFinite(v)) return;

    // Cropper zoom: fark kadar uygula
    // slider 1..3 arası, 1 başlangıç
    // cropper.getImageData() üzerinden oran hesaplamak yerine,
    // basit: mevcut zoom'u set etmek için small steps
    const current = cropper.getData(); // data almak için
    // Doğrudan setZoom yok, zoomTo var:
    cropper.zoomTo(v);
  });

  saveBannerBtn?.addEventListener("click", async () => {
    if (!cropper) {
      closeBannerModal();
      return;
    }

    // tekrar düzenleme için data sakla
    try { BannerState.cropperData = cropper.getData(true); } catch (_) {}

    // Kırpılmış canvas üret
    const canvas = cropper.getCroppedCanvas({
      // preview’de daha net gözüksün
      width: 2560,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high"
    });

    if (!canvas) {
      closeBannerModal();
      return;
    }

    // eski cropped url temizle
    revokeIfAny("croppedUrl");

    canvas.toBlob((blob) => {
      if (!blob) {
        closeBannerModal();
        return;
      }
      BannerState.croppedUrl = URL.createObjectURL(blob);

      // preview'e bas
      setBannerPreview(BannerState.croppedUrl);

      // butonları aktif et
      editBannerBtn.disabled = false;
      removeBannerBtn.disabled = false;

      closeBannerModal();
    }, "image/jpeg", 0.92);
  });

  // Modal kapanınca cropper’ı RAM şişirmemek için kapat (ama data kalsın)
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-close='bannerModal']");
    const backdrop = e.target.classList?.contains("modal__backdrop") && e.target.getAttribute("data-close") === "bannerModal";
    if (closeBtn || backdrop) {
      destroyCropper();
      showStagePlaceholder();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (bannerModal?.classList.contains("is-open")) {
      destroyCropper();
      showStagePlaceholder();
    }
  });
})();
