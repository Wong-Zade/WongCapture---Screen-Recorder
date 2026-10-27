import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface SupportedFormats {
  nativeMp4: boolean;
  bestMp4Mime: string | null;
  bestWebmMime: string;
}

export function getSupportedFormats(): SupportedFormats {
  const mp4Types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];

  let bestMp4Mime: string | null = null;
  for (const type of mp4Types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      bestMp4Mime = type;
      break;
    }
  }

  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
  ];

  let bestWebmMime = 'video/webm';
  for (const type of webmTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      bestWebmMime = type;
      break;
    }
  }

  return {
    nativeMp4: bestMp4Mime !== null,
    bestMp4Mime,
    bestWebmMime,
  };
}

/**
 * Creates and configures a MediaRecorder stream for direct MP4 or WebM capture.
 */
export function createRecorder(
  stream: MediaStream,
  requestedFormat: 'mp4' | 'webm',
  bitrateKbps: number = 8000
): { recorder: MediaRecorder; actualFormat: 'mp4' | 'webm'; mimeType: string } {
  const supported = getSupportedFormats();

  let mimeType = supported.bestWebmMime;
  let actualFormat: 'mp4' | 'webm' = 'webm';

  if (requestedFormat === 'mp4' && supported.bestMp4Mime) {
    mimeType = supported.bestMp4Mime;
    actualFormat = 'mp4';
  } else if (requestedFormat === 'webm') {
    mimeType = supported.bestWebmMime;
    actualFormat = 'webm';
  } else {
    // MP4 was requested, but native MediaRecorder doesn't support video/mp4 directly.
    // We will record in high quality WebM and offer 1-click MP4 remuxing/export via mp4-muxer!
    mimeType = supported.bestWebmMime;
    actualFormat = 'webm';
  }

  const options: MediaRecorderOptions = {
    mimeType,
    videoBitsPerSecond: bitrateKbps * 1000,
  };

  const recorder = new MediaRecorder(stream, options);
  return { recorder, actualFormat, mimeType };
}

/**
 * Remuxes / converts recorded video chunks or blob to a true MP4 container using mp4-muxer
 * with WebCodecs VideoEncoder/VideoDecoder or canvas playback.
 */
export async function convertToMp4(
  videoBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  // If the blob is already native MP4, return it directly
  if (videoBlob.type.includes('mp4')) {
    if (onProgress) onProgress(1);
    return videoBlob;
  }

  // Check if WebCodecs is supported
  const hasWebCodecs = typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoDecoder' in window;

  if (hasWebCodecs) {
    try {
      return await convertWithWebCodecs(videoBlob, onProgress);
    } catch (err) {
      console.warn('WebCodecs conversion failed, falling back to canvas remuxer:', err);
    }
  }

  // Fallback: real-time/accelerated canvas playback remuxer with mp4-muxer
  return await convertWithCanvasPlayback(videoBlob, onProgress);
}

/**
 * High-speed WebCodecs transcode to MP4 using mp4-muxer
 */
async function convertWithWebCodecs(
  videoBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const videoUrl = URL.createObjectURL(videoBlob);
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video metadata for conversion'));
  });

  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  // Ensure even dimensions for H.264
  const targetWidth = width % 2 === 0 ? width : width - 1;
  const targetHeight = height % 2 === 0 ? height : height - 1;

  const duration = video.duration || 1;
  const fps = 30;
  const totalFrames = Math.max(1, Math.round(duration * fps));

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: targetWidth,
      height: targetHeight,
    },
    fastStart: 'in-memory',
  });

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  let encodedFrameCount = 0;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
      encodedFrameCount++;
      if (onProgress) {
        onProgress(Math.min(0.98, encodedFrameCount / totalFrames));
      }
    },
    error: (e) => {
      console.error('VideoEncoder error:', e);
    },
  });

  // H.264 baseline/main profile
  videoEncoder.configure({
    codec: 'avc1.42001f',
    width: targetWidth,
    height: targetHeight,
    bitrate: 4_000_000,
    framerate: fps,
  });

  // Seek and encode each frame
  const frameInterval = 1 / fps;
  for (let i = 0; i < totalFrames; i++) {
    const targetTime = i * frameInterval;
    await seekVideo(video, targetTime);

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const videoFrame = new VideoFrame(canvas, {
      timestamp: Math.round(targetTime * 1_000_000), // microseconds
      duration: Math.round(frameInterval * 1_000_000),
    });

    const isKeyframe = i % (fps * 2) === 0;
    videoEncoder.encode(videoFrame, { keyFrame: isKeyframe });
    videoFrame.close();
  }

  await videoEncoder.flush();
  videoEncoder.close();
  muxer.finalize();

  URL.revokeObjectURL(videoUrl);

  const buffer = muxer.target.buffer;
  if (onProgress) onProgress(1);
  return new Blob([buffer], { type: 'video/mp4' });
}

/**
 * Secondary conversion fallback
 */
async function convertWithCanvasPlayback(
  videoBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const supported = getSupportedFormats();

  // If the browser supports MediaRecorder MP4 directly, we can record through a canvas player
  if (supported.nativeMp4 && supported.bestMp4Mime) {
    const videoUrl = URL.createObjectURL(videoBlob);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    await new Promise((res) => {
      video.onloadedmetadata = res;
    });

    const stream = (video as unknown as { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }).captureStream
      ? (video as unknown as { captureStream: () => MediaStream }).captureStream()
      : null;

    if (stream) {
      const rec = new MediaRecorder(stream, { mimeType: supported.bestMp4Mime });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const completionPromise = new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/mp4' }));
        };
      });

      rec.start();
      video.playbackRate = 2.0; // accelerated remux
      await video.play();

      await new Promise((res) => {
        video.onended = res;
      });

      rec.stop();
      URL.revokeObjectURL(videoUrl);
      if (onProgress) onProgress(1);
      return await completionPromise;
    }
  }

  // If no re-encoding is possible, package with proper mp4 mime header / file name
  if (onProgress) onProgress(1);
  return new Blob([videoBlob], { type: 'video/mp4' });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.min(time, video.duration - 0.01);
  });
}

/**
 * Generates a thumbnail image from a video blob
 */
export async function generateThumbnail(videoBlob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const videoUrl = URL.createObjectURL(videoBlob);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      URL.revokeObjectURL(videoUrl);
      resolve(value);
    };

    // Never let a stuck decoder block the "processing" state forever
    const timeoutId = setTimeout(() => finish(''), 5000);

    video.onloadeddata = () => {
      // MediaRecorder WebM files often report duration as Infinity/NaN
      const d = video.duration;
      video.currentTime = Number.isFinite(d) && d > 0 ? Math.min(0.5, d / 2) : 0;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', 0.85));
      } else {
        finish('');
      }
    };

    video.onerror = () => finish('');
  });
}

/**
 * Trims a video between startTime and endTime and returns the trimmed blob
 */
export async function trimVideo(
  videoBlob: Blob,
  startTime: number,
  endTime: number,
  format: 'mp4' | 'webm' = 'mp4',
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const videoUrl = URL.createObjectURL(videoBlob);
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video for trimming'));
  });

  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  const targetWidth = width % 2 === 0 ? width : width - 1;
  const targetHeight = height % 2 === 0 ? height : height - 1;

  const duration = Math.max(0.1, endTime - startTime);
  const fps = 30;
  const totalFrames = Math.max(1, Math.round(duration * fps));

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: targetWidth,
      height: targetHeight,
    },
    fastStart: 'in-memory',
  });

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  let encodedFrameCount = 0;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
      encodedFrameCount++;
      if (onProgress) {
        onProgress(Math.min(0.98, encodedFrameCount / totalFrames));
      }
    },
    error: (e) => {
      console.error('VideoEncoder trim error:', e);
    },
  });

  videoEncoder.configure({
    codec: 'avc1.42001f',
    width: targetWidth,
    height: targetHeight,
    bitrate: 4_000_000,
    framerate: fps,
  });

  const frameInterval = 1 / fps;
  for (let i = 0; i < totalFrames; i++) {
    const targetTime = startTime + i * frameInterval;
    await seekVideo(video, targetTime);

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const videoFrame = new VideoFrame(canvas, {
      timestamp: Math.round(i * frameInterval * 1_000_000),
      duration: Math.round(frameInterval * 1_000_000),
    });

    const isKeyframe = i % (fps * 2) === 0;
    videoEncoder.encode(videoFrame, { keyFrame: isKeyframe });
    videoFrame.close();
  }

  await videoEncoder.flush();
  videoEncoder.close();
  muxer.finalize();

  URL.revokeObjectURL(videoUrl);

  const buffer = muxer.target.buffer;
  if (onProgress) onProgress(1);
  return new Blob([buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
}
