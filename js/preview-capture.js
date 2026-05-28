export function createPreviewClone(previewNode) {
  if (!previewNode) {
    throw new Error("On izleme bulunamadi.");
  }

  const clone = previewNode.cloneNode(true);
  clone.classList.add("lightbox-preview-clone");
  clone.removeAttribute("id");
  clone.style.position = "relative";
  clone.style.inset = "auto";
  clone.style.top = "auto";
  clone.style.left = "auto";
  clone.style.transform = "none";
  clone.style.zoom = "1";
  clone.style.margin = "0";
  return clone;
}
