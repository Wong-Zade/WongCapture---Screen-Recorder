import React from 'react';
import { 
  Square, 
  Circle, 
  Pause, 
  Play, 
  Mic, 
  MicOff, 
  Camera, 
  Video, 
  VideoOff, 
  Maximize2,
  GripHorizontal,
  ZoomIn,
  Crop
} from 'lucide-react';
import { RecordingStatus, AudioConfig, WebcamConfig, AutoZoomConfig, CropRegion } from '../types';

interface FloatingBarProps {
  status: RecordingStatus;
  elapsedSeconds: number;
  audioConfig: AudioConfig;
  webcamConfig: WebcamConfig;
  autoZoomConfig: AutoZoomConfig;
  cropRegion: CropRegion;
  micLevel: number;
  format: 'mp4' | 'webm';
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTogglePause: () => void;
  onToggleMic: () => void;
  onToggleWebcam: () => void;
  onToggleAutoZoom: () => void;
  onToggleCrop: () => void;
  onTakeSnapshot: () => void;
  onExpandStudio: () => void;
}

export const FloatingBar: React.FC<FloatingBarProps> = ({
  status,
  elapsedSeconds,
  audioConfig,
  webcamConfig,
  autoZoomConfig,
  cropRegion,
  micLevel,
  format,
  onStartRecording,
  onStopRecording,
  onTogglePause,
  onToggleMic,
  onToggleWebcam,
  onToggleAutoZoom,
  onToggleCrop,
  onTakeSnapshot,
  onExpandStudio,
}) => {
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? `${h.toString().padStart(2, '0')}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isRecording = status === 'recording' || status === 'paused';

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-2 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-xl shadow-2xl shadow-black/80 select-none animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center text-neutral-500 pr-1 cursor-grab active:cursor-grabbing">
        <GripHorizontal className="w-4 h-4" />
      </div>

      {/* Timer / Status */}
      <div className="flex items-center gap-2 px-2.5 py-1 bg-neutral-950/70 border border-neutral-800/80 rounded-lg">
        {isRecording ? (
          <span className={`w-2 h-2 rounded-full ${status === 'recording' ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`} />
        ) : (
          <span className="w-2 h-2 rounded-full bg-neutral-600" />
        )}
        <span className="font-mono text-sm font-semibold tracking-wider text-neutral-100 tabular-nums min-w-[58px]">
          {formatTime(elapsedSeconds)}
        </span>
        <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/50">
          {format}
        </span>
      </div>

      <div className="h-5 w-px bg-neutral-800 mx-0.5" />

      {/* Primary Record / Stop Action */}
      {!isRecording ? (
        <button
          onClick={onStartRecording}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-rose-900/40 transition-all cursor-pointer whitespace-nowrap"
          title="Start Recording (F9 / Space)"
        >
          <Circle className="w-3.5 h-3.5 fill-current" />
          <span>Record</span>
        </button>
      ) : (
        <button
          onClick={onStopRecording}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-white text-neutral-950 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
          title="Stop Recording and Save Clip"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Done</span>
        </button>
      )}

      {/* Pause / Resume */}
      {isRecording && (
        <button
          onClick={onTogglePause}
          className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
          title={status === 'paused' ? 'Resume Recording' : 'Pause Recording'}
        >
          {status === 'paused' ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
        </button>
      )}

      {/* Mic toggle + VU Meter */}
      <button
        onClick={onToggleMic}
        className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
          audioConfig.microphone ? 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700' : 'bg-neutral-800/40 text-neutral-500 hover:bg-neutral-800'
        }`}
        title={audioConfig.microphone ? 'Microphone On (Click to mute)' : 'Microphone Muted'}
      >
        {audioConfig.microphone ? <Mic className="w-4 h-4 text-sky-400" /> : <MicOff className="w-4 h-4" />}
        {audioConfig.microphone && (
          <span 
            className="absolute bottom-1 left-2 right-2 h-0.5 bg-emerald-400 rounded-full transition-all"
            style={{ transform: `scaleX(${Math.max(0.1, micLevel)})` }}
          />
        )}
      </button>

      {/* Webcam toggle */}
      <button
        onClick={onToggleWebcam}
        className={`p-2 rounded-lg transition-colors cursor-pointer ${
          webcamConfig.enabled ? 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700' : 'bg-neutral-800/40 text-neutral-500 hover:bg-neutral-800'
        }`}
        title={webcamConfig.enabled ? 'Webcam Overlay On' : 'Webcam Overlay Off'}
      >
        {webcamConfig.enabled ? <Video className="w-4 h-4 text-sky-400" /> : <VideoOff className="w-4 h-4" />}
      </button>

      {/* Auto-Zoom toggle */}
      <button
        onClick={onToggleAutoZoom}
        className={`p-2 rounded-lg transition-colors cursor-pointer ${
          autoZoomConfig.enabled ? 'bg-sky-950/80 text-sky-400 border border-sky-800/60' : 'bg-neutral-800/40 text-neutral-500 hover:bg-neutral-800'
        }`}
        title={autoZoomConfig.enabled ? `Auto-Zoom on Clicks Active (${autoZoomConfig.factor}x)` : 'Enable Auto-Zoom on Clicks'}
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      {/* Instant Snapshot */}
      <button
        onClick={onTakeSnapshot}
        className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
        title="Take Instant Snapshot (PNG)"
      >
        <Camera className="w-4 h-4" />
      </button>

      <div className="h-5 w-px bg-neutral-800 mx-0.5" />

      {/* Expand to Studio */}
      <button
        onClick={onExpandStudio}
        className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
        title="Open Full Studio"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
};
