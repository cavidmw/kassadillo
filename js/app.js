import { $, createSvgIcon, formatCount, normalizeHandle, previewDescription, readImageFile } from "./utils.js";
import { BannerCropper } from "./cropper.js";
import { initFeedback, showToast } from "./feedback.js";
import { createPreviewClone } from "./preview-capture.js";

const state = {
  avatar: "",
  bannerDesktop: "",
  bannerMobile: "",
  videos: [],
  thumbDraft: "",
  editingIndex: null,
  dragIndex: null,
  visibleSections: {
    shorts: true,
    playlists: true,
    posts: true,
    live: true,
  },
  verified: true,
};

const elements = {
  screen: $("#youtubeScreen"),
  stage: $("#deviceStage"),
  bannerInput: $("#bannerInput"),
  bannerTile: $("#bannerTile"),
  bannerTilePreview: $("#bannerTilePreview"),
  avatarInput: $("#avatarInput"),
  avatarTile: $("#avatarTile"),
  avatarTilePreview: $("#avatarTilePreview"),
  nameInput: $("#channelName"),
  handleInput: $("#channelHandle"),
  handleError: $("#handleError"),
  subsInput: $("#subscriberCount"),
  descInput: $("#channelDescription"),
  descCount: $("#descCount"),
  previewBanner: $("#previewBanner"),
  previewAvatar: $("#previewAvatar"),
  previewName: $("#previewName"),
  previewVerifiedBadge: $("#previewVerifiedBadge"),
  previewMobileName: $("#previewMobileName"),
  previewHandle: $("#previewHandle"),
  previewSubs: $("#previewSubs"),
  previewVideoTotal: $("#previewVideoTotal"),
  metaDotHandleSubs: $("#metaDotHandleSubs"),
  metaDotSubsVideos: $("#metaDotSubsVideos"),
  previewDescription: $("#previewDescription"),
  previewMobileLink: $("#previewMobileLink"),
  previewVideos: $("#previewVideos"),
  videoCount: $("#videoCount"),
  videoList: $("#videoList"),
  videoPanel: $("#videoPanel"),
  videoPanelTitle: $("#videoPanelTitle"),
  openVideoPanel: $("#openVideoPanel"),
  closeVideoPanel: $("#closeVideoPanel"),
  thumbInput: $("#thumbInput"),
  thumbPreviewFrame: $("#thumbPreviewFrame"),
  thumbPreview: $("#thumbPreview"),
  videoTitle: $("#videoTitle"),
  videoViews: $("#videoViews"),
  videoDuration: $("#videoDuration"),
  videoAgeDays: $("#videoAgeDays"),
  saveVideo: $("#saveVideo"),
  desktopMode: $("#desktopMode"),
  mobileMode: $("#mobileMode"),
  lightTheme: $("#lightTheme"),
  darkTheme: $("#darkTheme"),
  showPreviewButton: $("#showPreviewButton"),
  previewLightbox: $("#previewLightbox"),
  previewLightboxMount: $("#previewLightboxMount"),
  toggleShorts: $("#toggleShorts"),
  togglePlaylists: $("#togglePlaylists"),
  togglePosts: $("#togglePosts"),
  toggleLive: $("#toggleLive"),
  toggleVerified: $("#toggleVerified"),
  openFeedbackPanel: $("#openFeedbackPanel"),
  feedbackPanel: $("#feedbackPanel"),
  feedbackForm: $("#feedbackForm"),
  closeFeedbackPanel: $("#closeFeedbackPanel"),
  feedbackName: $("#feedbackName"),
  feedbackMessage: $("#feedbackMessage"),
  feedbackStatus: $("#feedbackStatus"),
  submitFeedback: $("#submitFeedback"),
  toastHost: $("#toastHost"),
};

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const allowedImageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

const cropper = new BannerCropper({
  onSave: ({ desktop, mobile }) => {
    state.bannerDesktop = desktop;
    state.bannerMobile = mobile;
    setTilePreview(elements.bannerTile, elements.bannerTilePreview, desktop);
    renderBanner();
  },
});

function setBackground(element, url) {
  element.style.backgroundImage = url ? `url("${url}")` : "";
}

function setTilePreview(tile, preview, url) {
  setBackground(preview, url);
  tile.classList.toggle("has-preview", Boolean(url));
}

function setThumbPreview(url) {
  setBackground(elements.thumbPreview, url);
  elements.thumbPreviewFrame.hidden = !url;
}

function isAllowedImage(file) {
  if (!file) return false;

  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "gif" || file.type === "image/gif") return false;

  return allowedImageTypes.has(file.type) || allowedImageExtensions.has(extension);
}

function setHidden(element, hidden) {
  element.hidden = hidden;
}

function renderBanner() {
  const image = elements.screen.classList.contains("is-mobile") ? state.bannerMobile : state.bannerDesktop;
  setBackground(elements.previewBanner, image);
}

function renderChannelInfo() {
  const name = elements.nameInput.value.trim();
  const handle = normalizeHandle(elements.handleInput.value);
  const subsValue = elements.subsInput.value.trim();
  const desc = previewDescription(elements.descInput.value, 70, "...devamı");
  const visibleDescLength = elements.descInput.value.trim().length;

  elements.previewName.textContent = name;
  elements.previewMobileName.textContent = name;
  elements.previewHandle.textContent = handle.display;
  elements.previewSubs.textContent = subsValue ? `${formatCount(subsValue)} abone` : "";
  elements.previewVideoTotal.textContent = `${state.videos.length} video`;
  elements.previewDescription.replaceChildren(document.createTextNode(desc.text));
  if (desc.truncated) {
    const more = document.createElement("span");
    more.className = "desc-more";
    more.textContent = desc.suffix;
    elements.previewDescription.append(more);
  }
  elements.previewDescription.classList.toggle("is-truncated", desc.truncated);
  elements.previewMobileLink.textContent = handle.valid && handle.display ? `youtube.com/${handle.display}` : "";
  elements.previewVerifiedBadge.classList.toggle("is-hidden", !state.verified);
  elements.toggleVerified.classList.toggle("is-active", state.verified);
  elements.toggleVerified.setAttribute("aria-pressed", String(state.verified));
  elements.descCount.textContent = visibleDescLength;

  const hasHandle = Boolean(handle.display);
  const hasSubs = Boolean(subsValue);
  setHidden(elements.metaDotHandleSubs, !(hasHandle && hasSubs));
  setHidden(elements.metaDotSubsVideos, !(hasSubs || hasHandle));
  elements.handleError.hidden = handle.valid;
  elements.handleInput.closest(".field").classList.toggle("has-error", !handle.valid);
}

function renderVideos() {
  elements.previewVideos.replaceChildren();
  elements.videoList.replaceChildren();
  elements.videoCount.textContent = state.videos.length;
  elements.previewVideoTotal.textContent = `${state.videos.length} video`;
  elements.openVideoPanel.disabled = state.videos.length >= 8;

  if (state.videos.length === 0) {
    fitDevice();
    return;
  }

  state.videos.forEach((video, index) => {
    elements.previewVideos.append(createPreviewVideo(video));
    elements.videoList.append(createVideoRow(video, index));
  });
  fitDevice();
}

function createPreviewVideo(video) {
  const card = document.createElement("article");
  card.className = "video-card";

  const thumb = document.createElement("div");
  thumb.className = "video-thumb";
  setBackground(thumb, video.thumbnail);

  const duration = document.createElement("span");
  duration.className = "video-duration";
  duration.textContent = video.duration || "0:00";
  thumb.append(duration);

  const meta = document.createElement("div");
  meta.className = "video-meta-row";

  const textWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "video-title";
  title.textContent = video.title || "Video başlığı";

  const submeta = document.createElement("div");
  submeta.className = "video-submeta";
  submeta.textContent = `${formatCount(video.views)} görüntüleme • ${video.time || "az önce"}`;

  const more = document.createElement("div");
  more.className = "video-more";
  more.append(createSvgIcon("M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"));

  textWrap.append(title, submeta);
  meta.append(textWrap, more);
  card.append(thumb, meta);
  return card;
}

function createVideoRow(video, index) {
  const row = document.createElement("div");
  row.className = "video-row";
  row.draggable = true;
  row.dataset.index = String(index);

  const handle = document.createElement("div");
  handle.className = "drag-handle";
  handle.append(createSvgIcon("M8 6.5A1.5 1.5 0 1 1 8 3a1.5 1.5 0 0 1 0 3.5Zm8 0A1.5 1.5 0 1 1 16 3a1.5 1.5 0 0 1 0 3.5ZM8 13.5A1.5 1.5 0 1 1 8 10a1.5 1.5 0 0 1 0 3.5Zm8 0A1.5 1.5 0 1 1 16 10a1.5 1.5 0 0 1 0 3.5ZM8 21A1.5 1.5 0 1 1 8 17.5 1.5 1.5 0 0 1 8 21Zm8 0a1.5 1.5 0 1 1 0-3.5A1.5 1.5 0 0 1 16 21Z"));

  const thumb = document.createElement("div");
  thumb.className = "video-row-thumb";
  setBackground(thumb, video.thumbnail);

  const copy = document.createElement("div");
  copy.className = "video-row-copy";
  const title = document.createElement("strong");
  title.textContent = video.title || "Video başlığı";
  const meta = document.createElement("span");
  meta.textContent = `${formatCount(video.views)} görüntüleme`;
  copy.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "video-row-actions";

  const edit = document.createElement("button");
  edit.className = "row-action-button";
  edit.type = "button";
  edit.title = "Düzenle";
  edit.append(createSvgIcon("M4.75 16.8 15.9 5.65a2.15 2.15 0 0 1 3.04 3.04L7.8 19.85 4 20.6l.75-3.8Zm12.43-9.88L6.4 17.7l-.2.95.95-.2L17.92 7.67a.55.55 0 0 0-.74-.75Z"));
  edit.addEventListener("click", () => openVideoPanel(index));

  const remove = document.createElement("button");
  remove.className = "row-action-button";
  remove.type = "button";
  remove.title = "Sil";
  remove.append(createSvgIcon("m12 10.73 4.06-4.06a.9.9 0 1 1 1.27 1.27L13.27 12l4.06 4.06a.9.9 0 0 1-1.27 1.27L12 13.27l-4.06 4.06a.9.9 0 0 1-1.27-1.27L10.73 12 6.67 7.94a.9.9 0 0 1 1.27-1.27L12 10.73Z"));
  remove.addEventListener("click", () => {
    state.videos.splice(index, 1);
    renderVideos();
    renderChannelInfo();
  });

  actions.append(edit, remove);
  row.append(handle, thumb, copy, actions);
  bindRowDrag(row);
  return row;
}

function bindRowDrag(row) {
  row.addEventListener("dragstart", (event) => {
    state.dragIndex = Number(row.dataset.index);
    row.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
  });

  row.addEventListener("dragend", () => {
    state.dragIndex = null;
    row.classList.remove("is-dragging");
  });

  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    row.classList.add("is-drop-target");
  });

  row.addEventListener("dragleave", () => {
    row.classList.remove("is-drop-target");
  });

  row.addEventListener("drop", (event) => {
    event.preventDefault();
    const targetIndex = Number(row.dataset.index);
    row.classList.remove("is-drop-target");
    if (state.dragIndex === null || state.dragIndex === targetIndex) return;
    const [moved] = state.videos.splice(state.dragIndex, 1);
    state.videos.splice(targetIndex, 0, moved);
    renderVideos();
  });
}

function formatDurationInput(value) {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 2) {
    const totalSeconds = Number(digits);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
  }
  const rawSeconds = Number(digits.slice(-2));
  const rawMinutes = Number(digits.slice(0, -2));
  const minutes = String(rawMinutes + Math.floor(rawSeconds / 60));
  const seconds = String(rawSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatUploadAge(daysValue) {
  const days = Math.max(0, Number.parseInt(daysValue || 0, 10) || 0);
  if (days <= 0) return "bugün";
  if (days <= 13) return `${days} gün önce`;
  if (days <= 20) return "2 hafta önce";
  if (days <= 27) return "3 hafta önce";
  const months = Math.max(1, Math.floor(days / 30));
  return `${months} ay önce`;
}

function resetVideoDraft() {
  state.thumbDraft = "";
  state.editingIndex = null;
  elements.thumbInput.value = "";
  elements.videoTitle.value = "";
  elements.videoViews.value = "";
  elements.videoDuration.value = "";
  elements.videoAgeDays.value = "";
  setThumbPreview("");
  elements.videoPanelTitle.textContent = "Video Ekle";
  elements.saveVideo.textContent = "Ekle";
}

function openAnimatedPanel() {
  elements.videoPanel.hidden = false;
  elements.videoPanel.classList.remove("is-closing");
  requestAnimationFrame(() => {
    elements.videoPanel.classList.add("is-open");
  });
}

function closeAnimatedPanel() {
  elements.videoPanel.classList.remove("is-open");
  elements.videoPanel.classList.add("is-closing");
  window.setTimeout(() => {
    elements.videoPanel.hidden = true;
    elements.videoPanel.classList.remove("is-closing");
    resetVideoDraft();
  }, 220);
}

function openVideoPanel(index = null) {
  if (index === null && state.videos.length >= 8) return;
  state.editingIndex = index;
  state.thumbDraft = "";

  if (index === null) {
    resetVideoDraft();
  } else {
    const video = state.videos[index];
    elements.videoPanelTitle.textContent = "Videoyu Düzenle";
    elements.saveVideo.textContent = "Kaydet";
    elements.videoTitle.value = video.title;
    elements.videoViews.value = video.views;
    elements.videoDuration.value = video.duration;
    elements.videoAgeDays.value = video.ageDays;
    elements.thumbInput.value = "";
    setThumbPreview(video.thumbnail);
  }

  openAnimatedPanel();
  elements.videoTitle.focus();
}

function saveVideo() {
  const duration = formatDurationInput(elements.videoDuration.value) || "0:00";
  const ageDays = elements.videoAgeDays.value || 0;
  const nextVideo = {
    thumbnail: state.thumbDraft,
    title: elements.videoTitle.value.trim() || "Video başlığı",
    views: elements.videoViews.value || 0,
    duration,
    ageDays,
    time: formatUploadAge(ageDays),
  };

  if (state.editingIndex === null) {
    if (state.videos.length >= 8) return;
    state.videos.push(nextVideo);
  } else {
    const current = state.videos[state.editingIndex];
    state.videos[state.editingIndex] = {
      ...current,
      ...nextVideo,
      thumbnail: state.thumbDraft || current.thumbnail,
    };
  }

  renderVideos();
  renderChannelInfo();
  closeAnimatedPanel();
}

function applyVisibility(section) {
  const active = state.visibleSections[section];
  const buttonMap = {
    shorts: elements.toggleShorts,
    playlists: elements.togglePlaylists,
    posts: elements.togglePosts,
    live: elements.toggleLive,
  };
  buttonMap[section].classList.toggle("is-active", active);
  elements.screen.classList.toggle(`hide-${section}`, !active);
}

function setDevice(device) {
  const isMobile = device === "mobile";
  elements.screen.classList.toggle("is-mobile", isMobile);
  elements.screen.classList.toggle("is-desktop", !isMobile);
  elements.desktopMode.classList.toggle("is-active", !isMobile);
  elements.mobileMode.classList.toggle("is-active", isMobile);
  elements.screen.style.setProperty("--device-width", isMobile ? "430px" : "1280px");
  elements.screen.style.setProperty("--device-height", isMobile ? "932px" : "780px");
  fitDevice();
  renderBanner();
  renderChannelInfo();
}

function setTheme(theme) {
  const light = theme === "light";
  elements.screen.classList.toggle("theme-light", light);
  elements.screen.classList.toggle("theme-dark", !light);
  elements.lightTheme.classList.toggle("is-active", light);
  elements.darkTheme.classList.toggle("is-active", !light);
}

function fitDevice() {
  const isMobile = elements.screen.classList.contains("is-mobile");
  const width = isMobile ? 430 : 1280;
  const height = isMobile ? 932 : 780;
  const rect = elements.stage.getBoundingClientRect();
  const compact = rect.width < 700 || rect.height < 620;
  const sidePadding = isMobile ? (compact ? 28 : 56) : (compact ? 28 : 170);
  const verticalPadding = isMobile ? (compact ? 36 : 72) : (compact ? 44 : 120);
  const scale = Math.min(1, (rect.width - sidePadding) / width, (rect.height - verticalPadding) / height);
  const minScale = isMobile ? (compact ? 0.44 : 0.68) : (compact ? 0.24 : 0.62);
  const appliedScale = Math.max(minScale, scale);
  elements.screen.style.setProperty("--device-scale", String(appliedScale));
  elements.screen.style.zoom = String(appliedScale);
  elements.screen.style.transform = "translate(-50%, -50%)";
}

function openPreviewLightbox() {
  elements.previewLightbox.classList.toggle("is-mobile-preview", elements.screen.classList.contains("is-mobile"));
  elements.previewLightbox.hidden = false;
  fitLightboxPreview();
  elements.previewLightbox.offsetHeight;
  elements.previewLightbox.classList.add("is-open");
}

function closePreviewLightbox() {
  if (elements.previewLightbox.hidden || elements.previewLightbox.classList.contains("is-closing")) return;
  elements.previewLightbox.classList.remove("is-open");
  elements.previewLightbox.classList.add("is-closing");
  window.setTimeout(() => {
    elements.previewLightbox.hidden = true;
    elements.previewLightbox.classList.remove("is-closing", "is-mobile-preview");
    elements.previewLightboxMount.replaceChildren();
  }, 220);
}

function fitLightboxPreview() {
  const clone = elements.previewLightboxMount.querySelector(".lightbox-preview-clone");
  if (!clone) return;

  const isMobilePreview = clone.classList.contains("is-mobile");
  const width = isMobilePreview ? 430 : 1280;
  const height = isMobilePreview ? 932 : Math.max(780, elements.screen.scrollHeight || 780);
  const maxWidth = window.innerWidth - (isMobilePreview ? 80 : 96);
  const maxHeight = window.innerHeight - (isMobilePreview ? 80 : 96);
  const scale = Math.min(1, maxWidth / width, maxHeight / height);

  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.minHeight = `${height}px`;
  clone.style.zoom = String(Math.max(0.2, scale));
  elements.previewLightboxMount.style.width = `${width * Math.max(0.2, scale)}px`;
  elements.previewLightboxMount.style.height = `${height * Math.max(0.2, scale)}px`;
}

function bindEvents() {
  [elements.nameInput, elements.handleInput, elements.subsInput, elements.descInput].forEach((input) => {
    input.addEventListener("input", renderChannelInfo);
  });

  elements.bannerInput.addEventListener("change", async () => {
    const [file] = elements.bannerInput.files;
    if (!file) return;
    if (!isAllowedImage(file)) {
      window.alert("Yalnızca JPG, JPEG, PNG veya WEBP görsel yüklenebilir. GIF desteklenmiyor.");
      elements.bannerInput.value = "";
      return;
    }
    await cropper.openFile(file);
    elements.bannerInput.value = "";
  });

  elements.avatarInput.addEventListener("change", async () => {
    const [file] = elements.avatarInput.files;
    if (!file) return;
    if (!isAllowedImage(file)) {
      window.alert("Yalnızca JPG, JPEG, PNG veya WEBP görsel yüklenebilir. GIF desteklenmiyor.");
      elements.avatarInput.value = "";
      return;
    }
    state.avatar = await readImageFile(file);
    setBackground(elements.previewAvatar, state.avatar);
    setTilePreview(elements.avatarTile, elements.avatarTilePreview, state.avatar);
  });

  elements.openVideoPanel.addEventListener("click", () => openVideoPanel());
  elements.closeVideoPanel.addEventListener("click", closeAnimatedPanel);
  elements.videoPanel.addEventListener("click", (event) => {
    if (event.target === elements.videoPanel) closeAnimatedPanel();
  });
  elements.saveVideo.addEventListener("click", saveVideo);
  elements.videoDuration.addEventListener("blur", () => {
    elements.videoDuration.value = formatDurationInput(elements.videoDuration.value);
  });
  elements.thumbInput.addEventListener("change", async () => {
    const [file] = elements.thumbInput.files;
    if (!file) return;
    if (!isAllowedImage(file)) {
      window.alert("Yalnızca JPG, JPEG, PNG veya WEBP görsel yüklenebilir. GIF desteklenmiyor.");
      elements.thumbInput.value = "";
      return;
    }
    state.thumbDraft = await readImageFile(file);
    setThumbPreview(state.thumbDraft);
  });

  [elements.toggleShorts, elements.togglePlaylists, elements.togglePosts, elements.toggleLive].forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.section;
      state.visibleSections[section] = !state.visibleSections[section];
      applyVisibility(section);
    });
  });

  elements.toggleVerified.addEventListener("click", () => {
    state.verified = !state.verified;
    renderChannelInfo();
  });

  elements.desktopMode.addEventListener("click", () => setDevice("desktop"));
  elements.mobileMode.addEventListener("click", () => setDevice("mobile"));
  elements.lightTheme.addEventListener("click", () => setTheme("light"));
  elements.darkTheme.addEventListener("click", () => setTheme("dark"));
  elements.showPreviewButton.addEventListener("click", async () => {
    try {
      elements.showPreviewButton.disabled = true;
      elements.previewLightboxMount.replaceChildren(createPreviewClone(elements.screen));
      openPreviewLightbox();
    } catch (error) {
      console.error(error);
      showToast(elements.toastHost, "Önizleme gösterilemedi.", "error");
    } finally {
      elements.showPreviewButton.disabled = false;
    }
  });
  elements.previewLightbox.addEventListener("click", (event) => {
    if (event.target === elements.previewLightbox) {
      closePreviewLightbox();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePreviewLightbox();
    }
  });
  initFeedback({
    openButton: elements.openFeedbackPanel,
    panel: elements.feedbackPanel,
    closeButton: elements.closeFeedbackPanel,
    form: elements.feedbackForm,
    nameInput: elements.feedbackName,
    messageInput: elements.feedbackMessage,
    status: elements.feedbackStatus,
    submitButton: elements.submitFeedback,
    toastHost: elements.toastHost,
  });
  window.addEventListener("resize", fitDevice);
  window.addEventListener("resize", fitLightboxPreview);
}

bindEvents();
Object.keys(state.visibleSections).forEach(applyVisibility);
renderChannelInfo();
renderVideos();

const params = new URLSearchParams(window.location.search);
setDevice(params.get("device") === "mobile" ? "mobile" : "desktop");
setTheme(params.get("theme") === "light" ? "light" : "dark");
