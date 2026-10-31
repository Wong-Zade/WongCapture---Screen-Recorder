export type VideoResolution = '1080p' | '720p' | '4k' | 'source';
export type VideoFrameRate = 60 | 30 | 24;
export type VideoFormat = 'mp4' | 'webm';

export type WebcamPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
export type WebcamShape = 'circle' | 'rounded' | 'square';
export type WebcamSize = 'small' | 'medium' | 'large';

export interface WebcamConfig {
  enabled: boolean;
  deviceId: string;
  position: WebcamPosition;
  shape: WebcamShape;
  size: WebcamSize;
  mirrored: boolean;
}

export interface AudioConfig {
  systemAudio: boolean;
  microphone: boolean;
  micDeviceId: string;
  micVolume: number; // 0 to 1.5
  systemVolume: number; // 0 to 1.5
  noiseSuppression: boolean;
  echoCancellation: boolean;
}

export interface DesktopCaptureSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
  isScreen: boolean;
  display_id?: string;
}

export interface RecordingSettings {
  resolution: VideoResolution;
  frameRate: VideoFrameRate;
  format: VideoFormat;
  countdown: number; // 0, 3, 5
  bitrateKbps: number; // e.g. 5000, 8000, 12000
  filenamePrefix: string;
  preventMirrorLoop: boolean; // Anti-mirror protection to shield preview during recording
  autoMinimizeOnRecord: boolean; // Auto minimize window when recording starts
}

export interface RecordedClip {
  id: string;
  title: string;
  timestamp: number;
  duration: number; // in seconds
  blob: Blob;
  url: string;
  thumbnailUrl: string;
  format: VideoFormat;
  sizeBytes: number;
  width: number;
  height: number;
  fps: number;
}

export interface AutoZoomConfig {
  enabled: boolean;
  factor: number; // 1.5, 2.0, 2.5
  durationSeconds: number; // duration to stay zoomed in seconds (0 = persistent toggle)
  showClickRipple: boolean;
}

export type SelectionPreset = 'full' | 'custom' | '16:9' | '4:3' | '1:1' | '9:16';

export interface CropRegion {
  enabled: boolean;
  preset: SelectionPreset;
  // Normalized coordinates (0 to 1) relative to captured display
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RecordingStatus = 'idle' | 'countdown' | 'recording' | 'paused' | 'processing';
