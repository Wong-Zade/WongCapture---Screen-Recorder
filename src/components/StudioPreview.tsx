import React from 'react';
import { 
  Monitor, 
  Circle, 
  Square, 
  Pause, 
  Play, 
  Camera, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Volume2, 
  Sliders, 
  ZoomIn, 
  ZoomOut, 
  Crop, 
  RotateCcw,
  Sparkles,
  MousePointerClick,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  AppWindow,
  Minus,
  Minimize2,
  Layers
} from 'lucide-react';
import { 
  RecordingStatus, 
  AudioConfig, 
  WebcamConfig, 
  VideoResolution, 
  VideoFrameRate,
  CropRegion,
  AutoZoomConfig
} from '../types';
import { SelectionToolOverlay } from './SelectionToolOverlay';

interface StudioPreviewProps {
  screenStream: MediaStream | null;
  webcamStream: MediaStream | null;
  sourceName?: string;
  isWindowSource?: boolean;
  preventMirrorLoop?: boolean;
  status: RecordingStatus;
  countdownNumber: number;
  elapsedSeconds: number;
  audioConfig: AudioConfig;
  webcamConfig: WebcamConfig;
  cropRegion: CropRegion;
  onChangeCropRegion: (newCrop: CropRegion) => void;
  isSelectingArea: boolean;
  onToggleSelectingArea: () => void;
  autoZoomConfig: AutoZoomConfig;
  onUpdateAutoZoom: (config: Partial<AutoZoomConfig>) => void;
  onTriggerClickZoom: (normalizedX: number, normalizedY: number) => void;
  onResetZoom: () => void;
  isZoomed: boolean;
  resolution: VideoResolution;
  frameRate: VideoFrameRate;
  format: 'mp4' | 'webm';
  micLevel: number;
  systemLevel: number;
  onRequestScreen: () => void;
  onStopScreen: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTogglePause: () => void;
  onToggleMic: () => void;
  onToggleWebcam: () => void;
  onOpenWebcamSettings: () => void;
  onTakeSnapshot: () => void;
  onOpenMixer: () => void;
  onSwitchToCompact?: () => void;
}

export const StudioPreview: React.FC<StudioPreviewProps> = ({
  screenStream,
  webcamStream,
  sourceName,
  isWindowSource = false,
  preventMirrorLoop = true,
  status,
  countdownNumber,
  elapsedSeconds,
  audioConfig,
  webcamConfig,
  cropRegion,
  onChangeCropRegion,
  isSelectingArea,
  onToggleSelectingArea,
  autoZoomConfig,
  onUpdateAutoZoom,
  onTriggerClickZoom,
  onResetZoom,
  isZoomed,
  resolution,
  frameRate,
  format,
  micLevel,
  systemLevel,
  onRequestScreen,
  onStopScreen,
  onStartRecording,
  onStopRecording,
  onTogglePause,
  onToggleMic,
  onToggleWebcam,
  onOpenWebcamSettings,
  onTakeSnapshot,
  onOpenMixer,
  onSwitchToCompact,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const webcamRef = React.useRef<HTMLVideoElement>(null);

  const [containerDim, setContainerDim] = React.useState({ width: 960, height: 540 });
  const [sourceDim, setSourceDim] = React.useState({ width: 1920, height: 1080 });

  // Update container size on resize
  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerDim({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [screenStream]);

  // Read video track settings for accurate pixel dimensions
  React.useEffect(() => {
    if (screenStream) {
      const track = screenStream.getVideoTracks()[0];
      if (track) {
        const s = track.getSettings();
        setSourceDim({
          width: s.width || 1920,
          height: s.height || 1080,
        });
      }
    }
  }, [screenStream]);

  React.useEffect(() => {
    if (videoRef.current && screenStream) {
      videoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  React.useEffect(() => {
    if (webcamRef.current && webcamStream && webcamConfig.enabled) {
      webcamRef.current.srcObject = webcamStream;
    }
  }, [webcamStream, webcamConfig.enabled]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? `${h.toString().padStart(2, '0')}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isRecording = status === 'recording' || status === 'paused';

  const [isShieldManualToggle, setIsShieldManualToggle] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (status === 'idle') {
      setIsShieldManualToggle(null);
    }
  }, [status]);

  const shouldAutoShield = (isRecording || status === 'countdown') && !isWindowSource && preventMirrorLoop;
  const isShielded = isShieldManualToggle !== null ? isShieldManualToggle : shouldAutoShield;

  // Handle click on the screen preview to trigger Auto-Zoom
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If selecting area or dragging crop handles, don't trigger click zoom
    if (isSelectingArea) return;
    if (isShielded) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) return;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    onTriggerClickZoom(normX, normY);
  };

  // Webcam position styles
  const getWebcamPositionClasses = () => {
    switch (webcamConfig.position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-16 left-4';
      case 'bottom-right':
      default:
        return 'bottom-16 right-4';
    }
  };

  const getWebcamSizeClasses = () => {
    if (webcamConfig.shape === 'circle') {
      switch (webcamConfig.size) {
        case 'small': return 'w-28 h-28';
        case 'medium': return 'w-36 h-36';
        case 'large': return 'w-48 h-48';
      }
    } else {
      switch (webcamConfig.size) {
        case 'small': return 'w-44 h-28';
        case 'medium': return 'w-56 h-36';
        case 'large': return 'w-72 h-44';
      }
    }
  };

  const recordedWidth = cropRegion.enabled ? Math.round(sourceDim.width * cropRegion.width) : sourceDim.width;
  const recordedHeight = cropRegion.enabled ? Math.round(sourceDim.height * cropRegion.height) : sourceDim.height;

  return (
    <div className="relative flex-1 bg-neutral-950 flex flex-col items-center justify-center p-4 overflow-hidden select-none">
      {/* Background Subtle Grid */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Main Preview Container */}
      <div 
        ref={containerRef}
        onClick={handlePreviewClick}
        className={`relative w-full max-w-5xl aspect-video bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl flex items-center justify-center ${
          screenStream ? (!isShielded && autoZoomConfig.enabled ? 'cursor-crosshair' : 'cursor-default') : ''
        }`}
      >
        {screenStream ? (
          <>
            {/* When Anti-Mirror Shield is active: show the anti-mirror monitor instead of infinite recursive mirror */}
            {isShielded ? (
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 flex flex-col items-center justify-center p-6 text-center select-none z-10">
                {/* Visual Radar Indicator */}
                <div className="relative mb-4 flex items-center justify-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-xl ${
                    status === 'recording'
                      ? 'bg-rose-950/60 border-rose-600/60 text-rose-400 shadow-rose-900/30'
                      : status === 'paused'
                      ? 'bg-amber-950/60 border-amber-600/60 text-amber-400'
                      : 'bg-sky-950/60 border-sky-600/60 text-sky-400'
                  }`}>
                    {isWindowSource ? <AppWindow className="w-8 h-8" /> : <Monitor className="w-8 h-8" />}
                  </div>
                  {status === 'recording' && (
                    <div className="absolute -inset-1.5 rounded-2xl border-2 border-rose-500/30 animate-pulse pointer-events-none" />
                  )}
                </div>

                {/* Source Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${status === 'recording' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`} />
                  <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wide">
                    {status === 'recording' ? 'Recording in Progress' : status === 'paused' ? 'Recording Paused' : 'Capture Active'}
                  </span>
                  <span className="text-neutral-600">·</span>
                  <span className="text-xs font-medium text-sky-400 bg-sky-950/70 border border-sky-800/60 px-2 py-0.5 rounded truncate max-w-xs">
                    {sourceName || (isWindowSource ? 'Application Window' : 'Entire Display')}
                  </span>
                </div>

                {/* Big Live Digital Clock */}
                <div className="text-4xl md:text-5xl font-mono font-bold text-white tracking-wider tabular-nums mb-4 drop-shadow">
                  {formatTime(elapsedSeconds)}
                </div>

                {/* Audio Levels VU Meters */}
                <div className="w-full max-w-sm bg-neutral-900/90 border border-neutral-800/80 rounded-xl p-3 mb-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Mic className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="text-[11px] text-neutral-400 w-7">Mic</span>
                    <div className="flex-1 h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-75"
                        style={{ width: `${Math.round(micLevel * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-[11px] text-neutral-400 w-7">Sys</span>
                    <div className="flex-1 h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                      <div
                        className="h-full bg-indigo-400 transition-all duration-75"
                        style={{ width: `${Math.round(systemLevel * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Anti-Mirror Banner */}
                <div className="max-w-md p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/40 text-[11px] text-sky-200/90 flex items-center gap-2.5 mb-4 text-left">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Anti-Mirror Shield Active:</strong> Infinite recursive screen tunnel is blocked. Video & audio are capturing smoothly in full HD 60 FPS.
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsShieldManualToggle(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow border border-neutral-700/60"
                    title="Peek at the live display"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    <span>Peek Live Preview</span>
                  </button>

                  {onSwitchToCompact && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSwitchToCompact();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow border border-neutral-700/60"
                      title="Switch to compact Floating Mini HUD"
                    >
                      <Minimize2 className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Mini Bar HUD</span>
                    </button>
                  )}

                  {typeof window !== 'undefined' && window.wongWindow && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.wongWindow?.minimize();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow border border-neutral-700/60"
                      title="Minimize WongCapture window to taskbar/tray"
                    >
                      <Minus className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Minimize Window</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Live Screen Video Feed */
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain bg-black pointer-events-none"
              />
            )}

            {/* Selection Tool Overlay */}
            {!isShielded && (isSelectingArea || cropRegion.enabled) && (
              <SelectionToolOverlay
                containerWidth={containerDim.width}
                containerHeight={containerDim.height}
                sourceWidth={sourceDim.width}
                sourceHeight={sourceDim.height}
                cropRegion={cropRegion}
                onChangeCropRegion={onChangeCropRegion}
                isSelecting={isSelectingArea}
                onToggleSelecting={onToggleSelectingArea}
              />
            )}

            {/* Webcam PiP Overlay */}
            {!isShielded && webcamConfig.enabled && webcamStream && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenWebcamSettings();
                }}
                className={`absolute ${getWebcamPositionClasses()} ${getWebcamSizeClasses()} cursor-pointer group shadow-2xl border-2 border-white/80 overflow-hidden transition-all duration-150 z-20 ${
                  webcamConfig.shape === 'circle' ? 'rounded-full' : webcamConfig.shape === 'rounded' ? 'rounded-2xl' : 'rounded-none'
                }`}
                title="Click to configure webcam overlay"
              >
                <video
                  ref={webcamRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover bg-neutral-900 ${
                    webcamConfig.mirrored ? 'scale-x-[-1]' : ''
                  }`}
                />
                <div className="absolute inset-0 bg-sky-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Sliders className="w-5 h-5 text-white drop-shadow" />
                </div>
              </div>
            )}

            {/* Top Bar HUD inside Video Canvas */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
              <div className="flex items-center gap-2 pointer-events-auto">
                {isRecording ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-950/85 backdrop-blur-md border border-neutral-700/80 rounded-lg text-xs font-mono font-medium shadow-lg">
                    <span className={`w-2.5 h-2.5 rounded-full ${status === 'recording' ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`} />
                    <span className="text-white text-sm tabular-nums font-semibold tracking-wider">
                      {formatTime(elapsedSeconds)}
                    </span>
                    <span className="text-neutral-500">|</span>
                    <span className="text-sky-400 uppercase font-bold tracking-wider text-[11px]">
                      {format}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 bg-neutral-950/80 backdrop-blur-md border border-neutral-800 rounded-lg text-xs text-neutral-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-neutral-200 truncate max-w-[180px]">
                      {sourceName || (isWindowSource ? 'Window' : 'Screen')}
                    </span>
                    <span className="text-neutral-600">·</span>
                    <span className="font-mono text-neutral-400">{recordedWidth} × {recordedHeight}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pointer-events-auto">
                {/* Anti-Mirror Shield Toggle Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsShieldManualToggle(!isShielded);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow border ${
                    isShielded
                      ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
                      : 'bg-neutral-950/80 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                  }`}
                  title={isShielded ? 'Click to show live screen preview' : 'Click to shield live preview and eliminate infinite mirror tunnel'}
                >
                  {isShielded ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mirror Shielded</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>Shield Mirror</span>
                    </>
                  )}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTakeSnapshot();
                  }}
                  className="px-2.5 py-1.5 bg-neutral-950/80 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow"
                  title="Take instant snapshot"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Snapshot</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestScreen();
                  }}
                  className="px-2.5 py-1.5 bg-neutral-950/80 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs text-neutral-300 hover:text-sky-400 transition-colors cursor-pointer"
                  title="Change screen or window source"
                >
                  Change Source
                </button>
              </div>
            </div>

            {/* Auto-Zoom Click Hint Overlay */}
            {autoZoomConfig.enabled && !isRecording && (
              <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-950/80 border border-sky-800/60 backdrop-blur-md text-[11px] text-sky-200 shadow-lg">
                  <MousePointerClick className="w-3.5 h-3.5 text-sky-400 animate-bounce" />
                  <span>Click anywhere to auto-zoom on click</span>
                </div>
              </div>
            )}

            {/* Countdown Overlay */}
            {status === 'countdown' && (
              <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm flex flex-col items-center justify-center z-30 animate-in fade-in">
                <div className="w-28 h-28 rounded-full border-4 border-rose-500 flex items-center justify-center text-6xl font-bold font-mono text-white shadow-2xl animate-pulse">
                  {countdownNumber}
                </div>
                <p className="mt-4 text-sm font-medium text-neutral-300">Get ready to record...</p>
              </div>
            )}
          </>
        ) : (
          /* Empty / Setup State */
          <div className="p-8 max-w-lg w-full text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 border border-neutral-700/80 flex items-center justify-center text-sky-400 mb-5 shadow-inner">
              <Monitor className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-neutral-100 tracking-tight mb-2">
              Select Capture Source
            </h2>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              Capture your entire display, an application window, or a single browser tab. Audio and webcam can be mixed seamlessly.
            </p>

            <button
              onClick={onRequestScreen}
              className="w-full max-w-xs py-3 px-5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Select Screen or Window</span>
            </button>

            <div className="mt-6 pt-5 border-t border-neutral-800/80 w-full grid grid-cols-3 gap-2 text-left">
              <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/60">
                <span style={{ fontFamily: 'Arial' }} className="text-[10px] text-neutral-500 uppercase block">Export</span>
                <span className="text-xs font-semibold text-neutral-200 uppercase">{format} File</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/60">
                <span style={{ fontFamily: 'Arial' }} className="text-[10px] text-neutral-500 uppercase block">Quality</span>
                <span className="text-xs font-semibold text-neutral-200">{resolution} {frameRate}fps</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/60">
                <span style={{ fontFamily: 'Arial' }} className="text-[10px] text-neutral-500 uppercase block">Audio</span>
                <span className="text-xs font-semibold text-neutral-200">
                  {audioConfig.microphone ? 'Mic' : 'Muted'} {audioConfig.systemAudio ? '+ Sys' : ''}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature Toolbar (Auto-Zoom on Clicks + Selection Tool + Action Bar) */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 px-4 py-2 bg-neutral-900/90 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-xl z-20">
        {/* Main Record/Stop Action */}
        {!isRecording ? (
          <button
            onClick={onStartRecording}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-950/60 transition-all cursor-pointer whitespace-nowrap"
          >
            <Circle className="w-4 h-4 fill-current" />
            <span>Start Recording</span>
          </button>
        ) : (
          <button
            onClick={onStopRecording}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-white active:bg-neutral-200 text-neutral-950 rounded-xl text-sm font-semibold shadow-lg transition-all cursor-pointer whitespace-nowrap"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Stop & Save Clip</span>
          </button>
        )}

        {/* Pause / Resume Button */}
        {isRecording && (
          <button
            onClick={onTogglePause}
            className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
            title={status === 'paused' ? 'Resume' : 'Pause'}
          >
            {status === 'paused' ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
          </button>
        )}

        <div className="h-6 w-px bg-neutral-800 mx-0.5" />

        {/* Selection Tool (Crop / Record Part of Screen) */}
        <button
          onClick={onToggleSelectingArea}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            cropRegion.enabled
              ? 'bg-sky-950 text-sky-300 border border-sky-600/80'
              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white'
          }`}
          title="Select part of the screen to record (Aspect crop or custom region)"
        >
          <Crop className="w-4 h-4 text-sky-400" />
          <span>{cropRegion.enabled ? `Region (${cropRegion.preset})` : 'Selection Tool'}</span>
        </button>

        {/* Auto-Zoom on Clicks Control Group */}
        <div className="flex items-center gap-1 p-1 bg-neutral-950/80 rounded-xl border border-neutral-800">
          <button
            onClick={() => onUpdateAutoZoom({ enabled: !autoZoomConfig.enabled })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              autoZoomConfig.enabled
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title="Automatically zoom smoothly into where you click on screen"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Auto Zoom</span>
          </button>

          {autoZoomConfig.enabled && (
            <div className="flex items-center gap-1 px-1">
              {[1.5, 2.0, 2.5].map((factor) => (
                <button
                  key={factor}
                  onClick={() => onUpdateAutoZoom({ factor })}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                    autoZoomConfig.factor === factor
                      ? 'bg-neutral-800 text-sky-300 font-bold border border-neutral-700'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  title={`Zoom scale ${factor}x`}
                >
                  {factor}x
                </button>
              ))}

              {isZoomed && (
                <button
                  onClick={onResetZoom}
                  className="ml-1 p-1 text-neutral-400 hover:text-sky-300 transition-colors"
                  title="Reset Zoom to 1.0x"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-neutral-800 mx-0.5" />

        {/* Microphone Toggle & Meter */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMic}
            className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
              audioConfig.microphone ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100' : 'bg-neutral-800/50 text-neutral-500 hover:bg-neutral-800'
            }`}
            title={audioConfig.microphone ? 'Mute Microphone' : 'Enable Microphone'}
          >
            {audioConfig.microphone ? <Mic className="w-4 h-4 text-sky-400" /> : <MicOff className="w-4 h-4" />}
          </button>
          {audioConfig.microphone && (
            <div className="w-10 h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-400 transition-all duration-75"
                style={{ width: `${Math.round(micLevel * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Webcam Toggle & Settings */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleWebcam}
            className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
              webcamConfig.enabled ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100' : 'bg-neutral-800/50 text-neutral-500 hover:bg-neutral-800'
            }`}
            title={webcamConfig.enabled ? 'Turn Off Webcam' : 'Turn On Webcam'}
          >
            {webcamConfig.enabled ? <Video className="w-4 h-4 text-sky-400" /> : <VideoOff className="w-4 h-4" />}
          </button>
          {webcamConfig.enabled && (
            <button
              onClick={onOpenWebcamSettings}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              title="Webcam Settings (Shape, Size, Position)"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Audio Mixer Quick Link */}
        <button
          onClick={onOpenMixer}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300 transition-colors cursor-pointer"
          title="Open Audio Mixer"
        >
          <Volume2 className="w-4 h-4 text-sky-400" />
          <span>Mixer</span>
        </button>
      </div>
    </div>
  );
};
