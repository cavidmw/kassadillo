export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Görsel dosyası seçilmedi."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Görsel okunamadı."));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Görsel yüklenemedi."));
    image.src = src;
  });
}

export function formatCount(value) {
  const count = Math.max(0, Number.parseInt(value || 0, 10) || 0);
  const units = [
    { min: 1_000_000_000, suffix: "Mr" },
    { min: 1_000_000, suffix: "Mn" },
    { min: 1_000, suffix: "B" },
  ];
  const unit = units.find((item) => count >= item.min);

  if (!unit) {
    return String(count);
  }

  const amount = count / unit.min;
  const rounded = amount >= 100 ? Math.floor(amount) : Math.floor(amount * 10) / 10;
  return `${String(rounded).replace(/\.0$/, "")}${unit.suffix}`;
}

export function normalizeHandle(value) {
  const raw = value.trim();
  if (!raw) {
    return { display: "", valid: true };
  }

  const body = raw.startsWith("@") ? raw.slice(1) : raw;
  const valid = /^[A-Za-z0-9._-]{3,30}$/.test(body);
  return {
    display: `@${body}`,
    valid,
  };
}

export function previewDescription(value, limit = 25) {
  const clean = value.trim();
  if (clean.length <= limit) {
    return { text: clean, truncated: false };
  }

  return {
    text: `${clean.slice(0, limit)}...`,
    truncated: true,
  };
}

export function createSvgIcon(path) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathElement.setAttribute("d", path);
  svg.append(pathElement);
  return svg;
}
