import { $, loadImage, readImageFile } from "./utils.js";

const BANNER = {
  width: 2560,
  height: 1440,
  desktopHeight: 423,
  safeWidth: 1546,
};

export class BannerCropper {
  constructor({ onSave }) {
    this.onSave = onSave;
    this.modal = $("#cropModal");
    this.stage = $("#cropStage");
    this.imageNode = $("#cropImage");
    this.zoomInput = $("#cropZoom");
    this.closeButton = $("#closeCrop");
    this.cancelButton = $("#cancelCrop");
    this.saveButton = $("#saveCrop");
    this.image = null;
    this.source = "";
    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.drag = null;
    this.bind();
  }

  bind() {
    this.stage.addEventListener("pointerdown", (event) => this.startDrag(event));
    window.addEventListener("pointermove", (event) => this.dragImage(event));
    window.addEventListener("pointerup", () => this.endDrag());
    this.zoomInput.addEventListener("input", () => {
      this.zoom = Number(this.zoomInput.value);
      this.clampOffsets();
      this.render();
    });
    this.closeButton.addEventListener("click", () => this.close());
    this.cancelButton.addEventListener("click", () => this.close());
    this.saveButton.addEventListener("click", () => this.save());
    window.addEventListener("resize", () => this.render());
  }

  async openFile(file) {
    const source = await readImageFile(file);
    await this.openSource(source, true);
  }

  async openExisting() {
    if (!this.source) return;
    await this.openSource(this.source, false);
  }

  async openSource(source, resetPosition) {
    this.source = source;
    this.image = await loadImage(source);
    this.imageNode.src = source;
    if (resetPosition) {
      this.zoom = 1;
      this.offsetX = 0;
      this.offsetY = 0;
      this.zoomInput.value = "1";
    }
    this.modal.hidden = false;
    requestAnimationFrame(() => this.render());
  }

  close() {
    this.modal.hidden = true;
  }

  getDrawMetrics() {
    if (!this.image) return null;
    const baseScale = Math.max(BANNER.width / this.image.naturalWidth, BANNER.height / this.image.naturalHeight);
    const drawWidth = this.image.naturalWidth * baseScale * this.zoom;
    const drawHeight = this.image.naturalHeight * baseScale * this.zoom;
    const dx = (BANNER.width - drawWidth) / 2 + this.offsetX;
    const dy = (BANNER.height - drawHeight) / 2 + this.offsetY;
    return { drawWidth, drawHeight, dx, dy };
  }

  clampOffsets() {
    const metrics = this.getDrawMetrics();
    if (!metrics) return;

    const maxX = Math.max(0, (metrics.drawWidth - BANNER.width) / 2);
    const maxY = Math.max(0, (metrics.drawHeight - BANNER.height) / 2);
    this.offsetX = Math.min(maxX, Math.max(-maxX, this.offsetX));
    this.offsetY = Math.min(maxY, Math.max(-maxY, this.offsetY));
  }

  render() {
    const metrics = this.getDrawMetrics();
    if (!metrics) return;

    const rect = this.stage.getBoundingClientRect();
    const scaleX = rect.width / BANNER.width;
    const scaleY = rect.height / BANNER.height;
    this.imageNode.style.width = `${metrics.drawWidth * scaleX}px`;
    this.imageNode.style.height = `${metrics.drawHeight * scaleY}px`;
    this.imageNode.style.transform = `translate(${metrics.dx * scaleX}px, ${metrics.dy * scaleY}px)`;
  }

  startDrag(event) {
    if (!this.image) return;
    this.stage.setPointerCapture(event.pointerId);
    this.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    };
  }

  dragImage(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    const rect = this.stage.getBoundingClientRect();
    const deltaX = (event.clientX - this.drag.startX) / (rect.width / BANNER.width);
    const deltaY = (event.clientY - this.drag.startY) / (rect.height / BANNER.height);
    this.offsetX = this.drag.offsetX + deltaX;
    this.offsetY = this.drag.offsetY + deltaY;
    this.clampOffsets();
    this.render();
  }

  endDrag() {
    this.drag = null;
  }

  save() {
    if (!this.image) return;
    const metrics = this.getDrawMetrics();
    const virtualCanvas = document.createElement("canvas");
    virtualCanvas.width = BANNER.width;
    virtualCanvas.height = BANNER.height;
    const ctx = virtualCanvas.getContext("2d");
    ctx.fillStyle = "#0f0f0f";
    ctx.fillRect(0, 0, BANNER.width, BANNER.height);
    ctx.drawImage(this.image, metrics.dx, metrics.dy, metrics.drawWidth, metrics.drawHeight);

    const desktop = this.cropFromVirtual(virtualCanvas, 0, (BANNER.height - BANNER.desktopHeight) / 2, BANNER.width, BANNER.desktopHeight);
    const mobile = this.cropFromVirtual(virtualCanvas, (BANNER.width - BANNER.safeWidth) / 2, (BANNER.height - BANNER.desktopHeight) / 2, BANNER.safeWidth, BANNER.desktopHeight);

    this.onSave({
      desktop,
      mobile,
      source: this.source,
      zoom: this.zoom,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    });
    this.close();
  }

  cropFromVirtual(canvas, sourceX, sourceY, sourceWidth, sourceHeight) {
    const target = document.createElement("canvas");
    target.width = sourceWidth;
    target.height = sourceHeight;
    const ctx = target.getContext("2d");
    ctx.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    return target.toDataURL("image/jpeg", 0.92);
  }
}
