import { WebcamConfig, CropRegion, AutoZoomConfig } from '../types';

interface ClickRipple {
  x: number; // normalized 0..1 in output coordinates
  y: number; // normalized 0..1 in output coordinates
  startTime: number;
  maxRadius: number;
}

export class VideoCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private animFrameId: number | null = null;
  private screenVideo: HTMLVideoElement | null = null;
  private webcamVideo: HTMLVideoElement | null = null;
  private outputStream: MediaStream | null = null;
  private isRunning: boolean = false;
  private targetFps: number = 30;
  private lastDrawTime: number = 0;

  private webcamConfig: WebcamConfig | null = null;
  private cropRegion: CropRegion | null = null;
  private autoZoomConfig: AutoZoomConfig | null = null;

  // Virtual Camera State for Auto-Zoom
  private currentZoom: number = 1.0;
  private targetZoom: number = 1.0;
  private currentPanX: number = 0.5;
  private currentPanY: number = 0.5;
  private targetPanX: number = 0.5;
  private targetPanY: number = 0.5;
  private zoomTimeoutId: number | null = null;

  // Animated Click Ripples
  private ripples: ClickRipple[] = [];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
  }

  setup(
    screenStream: MediaStream,
    webcamStream: MediaStream | null,
    webcamConfig: WebcamConfig | null,
    cropRegion: CropRegion | null,
    autoZoomConfig: AutoZoomConfig | null,
    fps: number = 30
  ): MediaStream {
    this.stop();

    const screenTrack = screenStream.getVideoTracks()[0];
    if (!screenTrack) {
      throw new Error('No video track found in screen stream');
    }

    this.webcamConfig = webcamConfig;
    this.cropRegion = cropRegion;
    this.autoZoomConfig = autoZoomConfig;
    this.targetFps = Math.max(5, Math.min(60, fps || 30));
    this.lastDrawTime = 0;

    // Reset camera state
    this.currentZoom = 1.0;
    this.targetZoom = 1.0;
    this.currentPanX = 0.5;
    this.currentPanY = 0.5;
    this.targetPanX = 0.5;
    this.targetPanY = 0.5;
    this.ripples = [];

    // If NO crop, NO autozoom, and NO webcam: we can output raw screen track directly for max efficiency
    const hasCrop = cropRegion && cropRegion.enabled && (cropRegion.width < 0.99 || cropRegion.height < 0.99 || cropRegion.x > 0.01 || cropRegion.y > 0.01);
    const hasAutoZoom = autoZoomConfig && autoZoomConfig.enabled;
    const hasWebcam = webcamConfig && webcamConfig.enabled && webcamStream && webcamStream.getVideoTracks().length > 0;

    if (!hasCrop && !hasAutoZoom && !hasWebcam) {
      return new MediaStream([screenTrack]);
    }

    const settings = screenTrack.getSettings();
    const sourceWidth = settings.width || 1920;
    const sourceHeight = settings.height || 1080;

    // Determine canvas target dimensions based on crop region
    let targetWidth = sourceWidth;
    let targetHeight = sourceHeight;

    if (hasCrop && cropRegion) {
      targetWidth = Math.round(sourceWidth * cropRegion.width);
      targetHeight = Math.round(sourceHeight * cropRegion.height);
      // Ensure even dimensions for H.264 video encoders
      if (targetWidth % 2 !== 0) targetWidth -= 1;
      if (targetHeight % 2 !== 0) targetHeight -= 1;
      targetWidth = Math.max(320, targetWidth);
      targetHeight = Math.max(240, targetHeight);
    }

    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;

    this.screenVideo = document.createElement('video');
    this.screenVideo.muted = true;
    this.screenVideo.playsInline = true;
    this.screenVideo.srcObject = screenStream;
    this.screenVideo.play().catch(console.error);

    if (hasWebcam && webcamStream) {
      this.webcamVideo = document.createElement('video');
      this.webcamVideo.muted = true;
      this.webcamVideo.playsInline = true;
      this.webcamVideo.srcObject = webcamStream;
      this.webcamVideo.play().catch(console.error);
    }

    this.isRunning = true;
    this.renderLoop();

    this.outputStream = this.canvas.captureStream(fps);
    return this.outputStream;
  }

  updateWebcamConfig(config: WebcamConfig) {
    this.webcamConfig = config;
  }

  updateCropRegion(crop: CropRegion | null) {
    this.cropRegion = crop;
    if (this.screenVideo && crop && crop.enabled) {
      const sw = this.screenVideo.videoWidth || this.canvas.width;
      const sh = this.screenVideo.videoHeight || this.canvas.height;
      let nw = Math.round(sw * crop.width);
      let nh = Math.round(sh * crop.height);
      if (nw % 2 !== 0) nw -= 1;
      if (nh % 2 !== 0) nh -= 1;
      this.canvas.width = Math.max(320, nw);
      this.canvas.height = Math.max(240, nh);
    }
  }

  updateAutoZoomConfig(config: AutoZoomConfig) {
    this.autoZoomConfig = config;
    if (!config.enabled) {
      this.resetZoom();
    }
  }

  /**
   * Triggers a click at normalized coordinates (0..1) relative to the visible preview
   */
  triggerClickZoom(normalizedX: number, normalizedY: number, options?: { ripple?: boolean }) {
    // Add visual click ripple & tutorial spotlight (skipped when the position is only approximate)
    if (options?.ripple !== false && this.autoZoomConfig?.showClickRipple !== false) {
      this.ripples.push({
        x: normalizedX,
        y: normalizedY,
        startTime: performance.now(),
        maxRadius: 48,
      });
    }

    if (!this.autoZoomConfig?.enabled) return;

    // Zoom into the click point
    this.targetZoom = this.autoZoomConfig.factor || 2.0;
    this.targetPanX = Math.max(0.05, Math.min(0.95, normalizedX));
    this.targetPanY = Math.max(0.05, Math.min(0.95, normalizedY));

    // Clear previous auto-reset timer
    if (this.zoomTimeoutId !== null) {
      window.clearTimeout(this.zoomTimeoutId);
      this.zoomTimeoutId = null;
    }

    // Auto glide back out after configured duration (if duration > 0)
    // 0 means "stay zoomed until reset" (see AutoZoomConfig.durationSeconds); only a missing value falls back to 2.5s
    const duration = this.autoZoomConfig.durationSeconds ?? 2.5;
    if (duration > 0) {
      this.zoomTimeoutId = window.setTimeout(() => {
        this.resetZoom();
      }, duration * 1000);
    }
  }

  resetZoom() {
    if (this.zoomTimeoutId !== null) {
      window.clearTimeout(this.zoomTimeoutId);
      this.zoomTimeoutId = null;
    }
    this.targetZoom = 1.0;
    this.targetPanX = 0.5;
    this.targetPanY = 0.5;
  }

  setManualZoom(factor: number) {
    if (this.zoomTimeoutId !== null) {
      window.clearTimeout(this.zoomTimeoutId);
      this.zoomTimeoutId = null;
    }
    this.targetZoom = factor;
  }

  getZoomState() {
    return {
      currentZoom: this.currentZoom,
      targetZoom: this.targetZoom,
      isZoomed: this.targetZoom > 1.05 || this.currentZoom > 1.05,
    };
  }

  private renderLoop = () => {
    if (!this.isRunning || !this.ctx || !this.screenVideo) return;

    // Draw at the recording frame rate, not at the monitor's refresh rate (a 144 Hz display would otherwise
    // redraw a full-resolution frame 144 times a second for a 30 fps recording).
    const now = performance.now();
    if (this.lastDrawTime && now - this.lastDrawTime < 1000 / this.targetFps - 2) {
      this.animFrameId = requestAnimationFrame(this.renderLoop);
      return;
    }
    const dt = this.lastDrawTime ? Math.min(now - this.lastDrawTime, 100) : 16.7;
    this.lastDrawTime = now;

    const outW = this.canvas.width;
    const outH = this.canvas.height;

    const rawW = this.screenVideo.videoWidth || outW;
    const rawH = this.screenVideo.videoHeight || outH;

    // 1. Determine base crop window from cropRegion
    let baseCropX = 0;
    let baseCropY = 0;
    let baseCropW = rawW;
    let baseCropH = rawH;

    if (this.cropRegion && this.cropRegion.enabled) {
      baseCropX = Math.round(this.cropRegion.x * rawW);
      baseCropY = Math.round(this.cropRegion.y * rawH);
      baseCropW = Math.round(this.cropRegion.width * rawW);
      baseCropH = Math.round(this.cropRegion.height * rawH);
    }

    // 2. Smoothly interpolate virtual camera zoom and pan (lerp)
    // (time-based, so the glide looks the same whatever frame rate we draw at)
    const k = 1 - Math.pow(1 - 0.14, dt / 16.667);
    this.currentZoom += (this.targetZoom - this.currentZoom) * k;
    this.currentPanX += (this.targetPanX - this.currentPanX) * k;
    this.currentPanY += (this.targetPanY - this.currentPanY) * k;

    // 3. Compute zoomed sub-rectangle within base crop
    const visibleW = baseCropW / this.currentZoom;
    const visibleH = baseCropH / this.currentZoom;

    // Pan target centers on (baseCropX + currentPanX * baseCropW, baseCropY + currentPanY * baseCropH)
    let srcX = baseCropX + (this.currentPanX * baseCropW) - (visibleW / 2);
    let srcY = baseCropY + (this.currentPanY * baseCropH) - (visibleH / 2);

    // Clamp src rectangle to remain inside base crop bounds
    srcX = Math.max(baseCropX, Math.min(baseCropX + baseCropW - visibleW, srcX));
    srcY = Math.max(baseCropY, Math.min(baseCropY + baseCropH - visibleH, srcY));

    // 4. Draw screen video
    if (this.screenVideo.readyState >= 2) {
      this.ctx.drawImage(this.screenVideo, srcX, srcY, visibleW, visibleH, 0, 0, outW, outH);
    } else {
      this.ctx.fillStyle = '#0f172a';
      this.ctx.fillRect(0, 0, outW, outH);
    }

    // 5. Draw animated click ripples and tutorial spotlight
    this.drawRipples(outW, outH, srcX, srcY, visibleW, visibleH, baseCropX, baseCropY, baseCropW, baseCropH);

    // 6. Draw webcam overlay if enabled
    if (
      this.webcamConfig?.enabled &&
      this.webcamVideo &&
      this.webcamVideo.readyState >= 2
    ) {
      this.drawWebcamOverlay(outW, outH);
    }

    this.animFrameId = requestAnimationFrame(this.renderLoop);
  };

  private drawRipples(
    canvasW: number,
    canvasH: number,
    srcX: number,
    srcY: number,
    visibleW: number,
    visibleH: number,
    baseCropX: number,
    baseCropY: number,
    baseCropW: number,
    baseCropH: number
  ) {
    if (!this.ctx || this.ripples.length === 0) return;

    const now = performance.now();
    const activeRipples: ClickRipple[] = [];

    for (const r of this.ripples) {
      const elapsed = now - r.startTime;
      const duration = 800; // ms
      if (elapsed < duration) {
        activeRipples.push(r);
        const progress = elapsed / duration;
        const radius = progress * r.maxRadius * (this.currentZoom > 1.1 ? 1.3 : 1.0);
        const alpha = Math.max(0, (1 - progress) * 0.9);

        // Project source click coordinates to current virtual camera canvas coordinates
        const pointX = baseCropX + r.x * baseCropW;
        const pointY = baseCropY + r.y * baseCropH;
        const px = ((pointX - srcX) / visibleW) * canvasW;
        const py = ((pointY - srcY) / visibleH) * canvasH;

        if (px >= -60 && px <= canvasW + 60 && py >= -60 && py <= canvasH + 60) {
          this.ctx.save();

          // Outer glowing ripple ring
          this.ctx.beginPath();
          this.ctx.arc(px, py, radius, 0, Math.PI * 2);
          this.ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          this.ctx.lineWidth = 3.5;
          this.ctx.shadowColor = 'rgba(14, 165, 233, 0.8)';
          this.ctx.shadowBlur = 12;
          this.ctx.stroke();

          // Echo ripple wave
          if (progress > 0.15) {
            const echoProgress = (progress - 0.15) / 0.85;
            this.ctx.beginPath();
            this.ctx.arc(px, py, echoProgress * (r.maxRadius * 0.75), 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(244, 63, 94, ${(1 - echoProgress) * 0.75})`;
            this.ctx.lineWidth = 2.5;
            this.ctx.stroke();
          }

          // Inner glowing core target
          if (progress < 0.5) {
            const coreAlpha = (1 - progress / 0.5) * 0.95;
            this.ctx.beginPath();
            this.ctx.arc(px, py, 7 * (1 - progress * 0.4), 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${coreAlpha})`;
            this.ctx.fill();
          }
          this.ctx.restore();
        }
      }
    }

    this.ripples = activeRipples;
  }

  private drawWebcamOverlay(canvasW: number, canvasH: number) {
    if (!this.ctx || !this.webcamVideo || !this.webcamConfig) return;

    const sizeMultiplier =
      this.webcamConfig.size === 'small' ? 0.16 :
      this.webcamConfig.size === 'medium' ? 0.22 : 0.28;

    const overlayWidth = Math.round(canvasW * sizeMultiplier);
    const isCircle = this.webcamConfig.shape === 'circle';
    const overlayHeight = isCircle ? overlayWidth : Math.round(overlayWidth * (9 / 16));

    const margin = Math.round(canvasW * 0.025);

    let x = margin;
    let y = margin;

    switch (this.webcamConfig.position) {
      case 'top-left':
        x = margin;
        y = margin;
        break;
      case 'top-right':
        x = canvasW - overlayWidth - margin;
        y = margin;
        break;
      case 'bottom-left':
        x = margin;
        y = canvasH - overlayHeight - margin;
        break;
      case 'bottom-right':
      default:
        x = canvasW - overlayWidth - margin;
        y = canvasH - overlayHeight - margin;
        break;
    }

    this.ctx.save();

    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    this.ctx.shadowBlur = 16;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 4;

    this.ctx.beginPath();
    if (isCircle) {
      const radius = overlayWidth / 2;
      this.ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
    } else if (this.webcamConfig.shape === 'rounded') {
      this.ctx.roundRect(x, y, overlayWidth, overlayHeight, 16);
    } else {
      this.ctx.rect(x, y, overlayWidth, overlayHeight);
    }
    this.ctx.closePath();
    this.ctx.clip();

    this.ctx.shadowColor = 'transparent';

    if (this.webcamConfig.mirrored) {
      this.ctx.translate(x + overlayWidth, y);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(this.webcamVideo, 0, 0, overlayWidth, overlayHeight);
    } else {
      this.ctx.drawImage(this.webcamVideo, x, y, overlayWidth, overlayHeight);
    }

    this.ctx.restore();

    this.ctx.save();
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    this.ctx.beginPath();
    if (isCircle) {
      const radius = overlayWidth / 2;
      this.ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
    } else if (this.webcamConfig.shape === 'rounded') {
      this.ctx.roundRect(x, y, overlayWidth, overlayHeight, 16);
    } else {
      this.ctx.rect(x, y, overlayWidth, overlayHeight);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  takeSnapshot(screenStream: MediaStream, webcamStream: MediaStream | null, webcamConfig: WebcamConfig | null): string {
    const screenTrack = screenStream.getVideoTracks()[0];
    if (!screenTrack) return '';

    const width = screenTrack.getSettings().width || 1920;
    const height = screenTrack.getSettings().height || 1080;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;
    const snapCtx = snapCanvas.getContext('2d');
    if (!snapCtx) return '';

    if (this.isRunning && this.canvas.width > 0 && this.canvas.height > 0) {
      snapCtx.drawImage(this.canvas, 0, 0, width, height);
      return snapCanvas.toDataURL('image/png');
    }

    if (this.screenVideo && this.screenVideo.readyState >= 2) {
      snapCtx.drawImage(this.screenVideo, 0, 0, width, height);
      return snapCanvas.toDataURL('image/png');
    }

    return '';
  }

  stop() {
    this.isRunning = false;
    if (this.zoomTimeoutId !== null) {
      window.clearTimeout(this.zoomTimeoutId);
      this.zoomTimeoutId = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.screenVideo) {
      this.screenVideo.srcObject = null;
      this.screenVideo = null;
    }
    if (this.webcamVideo) {
      this.webcamVideo.srcObject = null;
      this.webcamVideo = null;
    }
    if (this.outputStream) {
      this.outputStream.getTracks().forEach(t => t.stop());
      this.outputStream = null;
    }
  }
}
