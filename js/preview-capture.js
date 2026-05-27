function collectStyles() {
  return [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

function imageToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Görüntü oluşturulamadı."));
    }, "image/png");
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Görüntü panoya hazırlanamadı."));
    reader.readAsDataURL(blob);
  });
}

async function legacyCopyImage(blob) {
  const dataUrl = await blobToDataUrl(blob);
  const holder = document.createElement("div");
  holder.contentEditable = "true";
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "0";
  holder.style.width = "1px";
  holder.style.height = "1px";

  const image = document.createElement("img");
  image.alt = "";
  image.src = dataUrl;
  holder.append(image);
  document.body.append(holder);

  const range = document.createRange();
  range.selectNode(image);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const copied = document.execCommand("copy");
  selection.removeAllRanges();
  holder.remove();

  if (!copied) {
    throw new Error("Tarayıcı görsel kopyalamayı desteklemiyor.");
  }
}

function loadSerializedSvg(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Ön izleme görsele çevrilemedi."));
    image.src = source;
  });
}

async function renderNodeToPngBlob(node) {
  const width = Math.ceil(node.offsetWidth || node.getBoundingClientRect().width);
  const height = Math.ceil(node.scrollHeight || node.offsetHeight || node.getBoundingClientRect().height);
  const clone = node.cloneNode(true);
  clone.style.position = "static";
  clone.style.inset = "auto";
  clone.style.transform = "none";
  clone.style.zoom = "1";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.overflow = "hidden";

  const style = `<style>${collectStyles()}</style>`;
  const html = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${style}
          ${html}
        </div>
      </foreignObject>
    </svg>
  `;
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = await loadSerializedSvg(source);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return imageToBlob(canvas);
}

export async function copyPreviewToClipboard(previewNode) {
  const blob = await renderNodeToPngBlob(previewNode);

  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
      return;
    } catch {
      await legacyCopyImage(blob);
      return;
    }
  }

  await legacyCopyImage(blob);
}
