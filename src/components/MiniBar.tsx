import React from 'react';
import { MicUnderline } from './LevelMeters';
import { presetRegion } from '../utils/cropPresets';
import { 
  Monitor, 
  AppWindow, 
  Crop, 
  Circle, 
  Square, 
  Pause, 
  Play, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Video, 
  VideoOff, 
  Camera, 
  Minus, 
  Pin, 
  PinOff, 
  GripHorizontal, 
  ZoomIn, 
  Settings, 
  Film, 
  ChevronDown, 
  Sparkles, 
  X, 
  Sliders, 
  Layers,
  Check
} from 'lucide-react';
import { 
  RecordingStatus, 
  AudioConfig, 
  WebcamConfig, 
  AutoZoomConfig, 
  CropRegion, 
  SelectionPreset,
  RecordingSettings 
} from '../types';

interface MiniBarProps {
  status: RecordingStatus;
  elapsedSeconds: number;
  countdownNumber: number;
  audioConfig: AudioConfig;
  onUpdateAudioConfig: (updates: Partial<AudioConfig>) => void;
  webcamConfig: WebcamConfig;
  onUpdateWebcamConfig: (updates: Partial<WebcamConfig>) => void;
  autoZoomConfig: AutoZoomConfig;
  onUpdateAutoZoomConfig: (updates: Partial<AutoZoomConfig>) => void;
  cropRegion: CropRegion;
  onChangeCropRegion: (newCrop: CropRegion) => void;
  isSelectingArea: boolean;
  onStartAreaSelection: () => void;
  selectedSourceName: string;
  isWindowSource: boolean;
  hasActiveScreen: boolean;
  sourceSize: { width: number; height: number };
  screenStream: MediaStream | null;
  settings: RecordingSettings;
  onUpdateSettings: (updates: Partial<RecordingSettings>) => void;
  clipsCount: number;
  onOpenClips: () => void;
  onOpenSettings: () => void;
  onOpenMixer: () => void;
  onOpenWebcamSettings: () => void;
  onSelectDisplay: () => void;
  onSelectWindow: () => void;
  onSelectArea: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTogglePause: () => void;
  onTakeSnapshot: () => void;
  /** Window buttons (desktop app): pin on top, minimize, close. */
  windowControls?: {
    isPinned: boolean;
    onTogglePin: () => void;
    onMinimize: () => void;
    onClose: () => void;
  };
  onStopScreen: () => void;
}

export const MiniBar: React.FC<MiniBarProps> = ({
  status,
  elapsedSeconds,
  countdownNumber,
  audioConfig,
  onUpdateAudioConfig,
  webcamConfig,
  onUpdateWebcamConfig,
  autoZoomConfig,
  onUpdateAutoZoomConfig,
  cropRegion,
  onChangeCropRegion,
  isSelectingArea,
  onStartAreaSelection,
  selectedSourceName,
  isWindowSource,
  hasActiveScreen,
  sourceSize,
  screenStream,
  settings,
  onUpdateSettings,
  clipsCount,
  onOpenClips,
  onOpenSettings,
  onOpenMixer,
  onOpenWebcamSettings,
  onSelectDisplay,
  onSelectWindow,
  onSelectArea,
  onStartRecording,
  onStopRecording,
  onTogglePause,
  onTakeSnapshot,
  windowControls,
  onStopScreen,
}) => {
  const [activeMenu, setActiveMenu] = React.useState<'area' | 'zoom' | 'audio' | 'webcam' | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuUp, setMenuUp] = React.useState(false);
  const [menuSpace, setMenuSpace] = React.useState(0);

  // Open a dropdown below the bar, or above it when the bar sits near the bottom of the screen
  const toggleMenu = (name: 'area' | 'zoom') => {
    if (activeMenu === name) {
      setActiveMenu(null);
      return;
    }
    const workAreaBottom = ((window.screen as any).availTop ?? 0) + window.screen.availHeight;
    const spaceBelow = workAreaBottom - (window.screenY + window.outerHeight);
    setMenuUp(spaceBelow < 340);
    setActiveMenu(name);
  };

  // The window is only as big as the bar, so while a dropdown is open reserve room for it
  React.useLayoutEffect(() => {
    const menu = menuRef.current?.querySelector('[data-menu]') as HTMLElement | null;
    setMenuSpace(menu ? menu.offsetHeight + 10 : 0);
  }, [activeMenu]);

  // Close popup menus on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    if (activeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenu]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? `${h.toString().padStart(2, '0')}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isRecording = status === 'recording' || status === 'paused';
  const isCountdown = status === 'countdown';

  const presets: { id: SelectionPreset; label: string; ratio: string }[] = [
    { id: 'full', label: 'Full Display', ratio: 'Native' },
    { id: '16:9', label: 'Widescreen', ratio: '16:9' },
    { id: '4:3', label: 'Standard', ratio: '4:3' },
    { id: '1:1', label: 'Square Post', ratio: '1:1' },
    { id: '9:16', label: 'Shorts / Reels', ratio: '9:16' },
  ];

  const handleApplyPreset = (preset: SelectionPreset) => {
    setActiveMenu(null);
    onChangeCropRegion(presetRegion(preset, sourceSize.width, sourceSize.height));
  };

  const zoomLevels = [1.5, 2.0, 2.5, 3.0];

  return (
    <div
      ref={menuRef}
      className="inline-flex flex-col items-start select-none"
      data-menu-open={activeMenu ? 'true' : 'false'}
      data-menu-up={menuUp ? 'true' : 'false'}
    >
      {activeMenu && menuUp && <div aria-hidden style={{ height: menuSpace }} />}
      <div className="relative">
      {/* Floating Mini Bar Container (the whole bar is a drag handle; buttons inside stay clickable) */}
      <div className="drag-region flex items-center gap-2 p-1.5 bg-neutral-900/95 border border-neutral-700/80 rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.5)] text-xs text-neutral-200">
        
        {/* Drag Handle */}
        <div 
          className="flex items-center px-1 text-neutral-500 hover:text-neutral-300 cursor-grab active:cursor-grabbing transition-colors"
          title="Drag Mini Bar"
        >
          <GripHorizontal className="w-4 h-4" />
        </div>

        {/* Brand Label */}
        <div className="hidden sm:flex items-center gap-1.5 pl-0.5 pr-2 border-r border-neutral-800">
          <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-rose-500 to-sky-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm">
            W
          </div>
          <span className="font-semibold tracking-tight text-white text-[13px]">WongCapture</span>
        </div>

        {/* ========================================================================= */}
        {/* CAPTURE MODE GROUP: Display | Window | Select Area                         */}
        {/* ========================================================================= */}
        <div className="flex items-center p-0.5 bg-neutral-950/80 border border-neutral-800/90 rounded-xl">
          {/* Display Mode */}
          <button
            onClick={onSelectDisplay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              hasActiveScreen && !isWindowSource && !cropRegion.enabled
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-950'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
            }`}
            title="Capture Full Display / Screen"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Display</span>
          </button>

          {/* Window Mode */}
          <button
            onClick={onSelectWindow}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              hasActiveScreen && isWindowSource
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-950'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
            }`}
            title="Capture Specific Application Window"
          >
            <AppWindow className="w-3.5 h-3.5" />
            <span>Window</span>
          </button>

          {/* Select Area Mode */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('area')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                cropRegion.enabled
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-950'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
              }`}
              title="Select Area or Crop Aspect Preset"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Area</span>
              {cropRegion.enabled && (
                <span className="text-[10px] font-mono px-1 py-0.2 bg-black/30 rounded font-bold uppercase">
                  {cropRegion.preset}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-neutral-400 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Source Active Indicator (if connected) */}
        {hasActiveScreen && (
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-neutral-950/60 border border-neutral-800/70 rounded-lg text-[11px] text-neutral-300 max-w-[140px] truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            <span className="truncate">{selectedSourceName || 'Screen Ready'}</span>
            <button
              onClick={onStopScreen}
              className="text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer ml-auto flex-shrink-0"
              title="Release Source"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="h-5 w-px bg-neutral-800" />

        {/* ========================================================================= */}
        {/* AUDIO & WEBCAM & AUTO-ZOOM TOGGLES                                        */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-1">
          {/* Microphone */}
          <div className="relative">
            <button
              onClick={() => onUpdateAudioConfig({ microphone: !audioConfig.microphone })}
              onContextMenu={(e) => {
                e.preventDefault();
                onOpenMixer();
              }}
              className={`relative p-2 rounded-xl transition-all cursor-pointer ${
                audioConfig.microphone 
                  ? 'bg-neutral-800/90 text-neutral-100 hover:bg-neutral-700' 
                  : 'bg-neutral-950/50 text-neutral-500 hover:bg-neutral-800'
              }`}
              title={audioConfig.microphone ? 'Microphone Active (Click to mute, right-click for mixer)' : 'Microphone Muted'}
            >
              {audioConfig.microphone ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4" />}
              {audioConfig.microphone && <MicUnderline />}
            </button>
          </div>

          {/* System Audio */}
          <button
            onClick={() => onUpdateAudioConfig({ systemAudio: !audioConfig.systemAudio })}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              audioConfig.systemAudio 
                ? 'bg-neutral-800/90 text-neutral-100 hover:bg-neutral-700' 
                : 'bg-neutral-950/50 text-neutral-500 hover:bg-neutral-800'
            }`}
            title={audioConfig.systemAudio ? 'System Audio Enabled' : 'System Audio Muted'}
          >
            {audioConfig.systemAudio ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Webcam PIP */}
          <button
            onClick={() => {
              if (!webcamConfig.enabled) {
                onUpdateWebcamConfig({ enabled: true });
              } else {
                onUpdateWebcamConfig({ enabled: false });
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onOpenWebcamSettings();
            }}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              webcamConfig.enabled 
                ? 'bg-sky-950/80 text-sky-300 border border-sky-700/60' 
                : 'bg-neutral-950/50 text-neutral-500 hover:bg-neutral-800'
            }`}
            title={webcamConfig.enabled ? 'Webcam PIP Active (Right-click for options)' : 'Webcam PIP Off'}
          >
            {webcamConfig.enabled ? <Video className="w-4 h-4 text-sky-400" /> : <VideoOff className="w-4 h-4" />}
          </button>

          {/* Auto-Zoom on Clicks */}
          <div className="relative">
            <button
              onClick={() => onUpdateAutoZoomConfig({ enabled: !autoZoomConfig.enabled })}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
                autoZoomConfig.enabled 
                  ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/70 shadow-sm' 
                  : 'bg-neutral-950/50 text-neutral-500 hover:bg-neutral-800'
              }`}
              title={autoZoomConfig.enabled ? `Auto-Zoom on Clicks Active (${autoZoomConfig.factor}x) - Hotkey: F10` : 'Enable Tutorial Auto-Zoom on Clicks (F10)'}
            >
              <ZoomIn className={`w-3.5 h-3.5 ${autoZoomConfig.enabled ? 'text-indigo-400' : ''}`} />
              <span className="text-[11px] font-mono font-bold">
                {autoZoomConfig.enabled ? `${autoZoomConfig.factor}x` : 'Zoom'}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMenu('zoom');
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>
            </button>
          </div>
        </div>

        <div className="h-5 w-px bg-neutral-800" />

        {/* ========================================================================= */}
        {/* RECORD / COUNTDOWN / ACTIVE RECORDING STATUS                              */}
        {/* ========================================================================= */}
        {isCountdown ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/20 border border-amber-500/50 rounded-xl text-amber-300 font-mono font-bold animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Starting in {countdownNumber}s</span>
          </div>
        ) : !isRecording ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onStartRecording}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 active:scale-95 text-white rounded-xl text-xs font-bold tracking-wide shadow-lg shadow-rose-950/60 transition-all cursor-pointer"
              title="Start Recording (Hotkey: F9)"
            >
              <Circle className="w-3.5 h-3.5 fill-current text-white animate-pulse" />
              <span>REC</span>
              <span className="text-[10px] opacity-75 font-mono px-1 py-0.2 bg-black/20 rounded">F9</span>
            </button>

            {/* Instant Snapshot */}
            <button
              onClick={onTakeSnapshot}
              className="p-2 rounded-xl bg-neutral-950/60 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer"
              title="Take Instant Screenshot (PNG)"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Active Recording State */
          <div className="flex items-center gap-1.5 bg-neutral-950/90 border border-neutral-800 p-1 rounded-xl">
            {/* Blinking indicator + Monospace Timer */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg">
              <span className={`w-2.5 h-2.5 rounded-full ${status === 'recording' ? 'bg-rose-500 animate-ping' : 'bg-amber-400'}`} />
              <span className="font-mono text-sm font-bold tracking-wider text-white tabular-nums min-w-[62px]">
                {formatTime(elapsedSeconds)}
              </span>
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/50">
                {settings.format}
              </span>
            </div>

            {/* Pause / Resume */}
            <button
              onClick={onTogglePause}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
              title={status === 'paused' ? 'Resume Recording' : 'Pause Recording'}
            >
              {status === 'paused' ? <Play className="w-3.5 h-3.5 fill-current text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            {/* Finish / Done Recording */}
            <button
              onClick={onStopRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-white text-neutral-950 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer"
              title="Finish Recording and Save Clip"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Done</span>
            </button>
          </div>
        )}

        <div className="h-5 w-px bg-neutral-800" />

        {/* ========================================================================= */}
        {/* QUICK TOOLS: Library | Settings | Expand Studio                           */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-1">
          {/* Clips Library */}
          <button
            onClick={onOpenClips}
            className="relative p-2 rounded-xl bg-neutral-950/50 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer"
            title="Recorded Clips Library"
          >
            <Film className="w-4 h-4" />
            {clipsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1 py-0.2 bg-sky-600 text-[9px] font-mono font-bold text-white rounded-full min-w-[16px] text-center">
                {clipsCount}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-neutral-950/50 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer"
            title="Recorder Settings (Resolution, Bitrate, Audio)"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Window controls (desktop app) */}
          {windowControls && (
            <div className="flex items-center gap-0.5 ml-1 pl-2 border-l border-neutral-800">
              <button
                onClick={windowControls.onTogglePin}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  windowControls.isPinned ? 'text-sky-400 hover:bg-neutral-800' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
                }`}
                title={windowControls.isPinned ? 'Always on top (click to unpin)' : 'Keep on top of other windows'}
              >
                {windowControls.isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={windowControls.onMinimize}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Minimize"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={windowControls.onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                title="Close WongCapture"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AREA SELECTION DROPDOWN MENU                                              */}
      {/* ========================================================================= */}
      {activeMenu === 'area' && (
        <div data-menu className={`absolute ${menuUp ? 'bottom-full mb-2' : 'top-full mt-2'} left-32 z-50 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150`}>
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-800 px-1">
            <span className="text-xs font-semibold text-neutral-200">Selection Area Presets</span>
            <span className="text-[10px] text-neutral-400">Crop Mode</span>
          </div>

          <div className="space-y-1">
            {presets.map((p) => {
              const isSelected = (p.id === 'full' && !cropRegion.enabled) || (cropRegion.enabled && cropRegion.preset === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    isSelected ? 'bg-sky-600 text-white font-medium' : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Crop className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{p.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] opacity-70 font-mono">{p.ratio}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-neutral-800">
            <button
              onClick={() => {
                setActiveMenu(null);
                onStartAreaSelection();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Draw Area on Screen…</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZOOM FACTOR DROPDOWN MENU                                                 */}
      {/* ========================================================================= */}
      {activeMenu === 'zoom' && (
        <div data-menu className={`absolute ${menuUp ? 'bottom-full mb-2' : 'top-full mt-2'} left-64 z-50 w-52 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150`}>
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-800 px-1">
            <span className="text-xs font-semibold text-neutral-200">Auto-Zoom Magnification</span>
            <span className="text-[10px] text-indigo-400 font-mono">F10 Hotkey</span>
          </div>

          <div className="grid grid-cols-2 gap-1 mb-2">
            {zoomLevels.map((lvl) => (
              <button
                key={lvl}
                onClick={() => {
                  onUpdateAutoZoomConfig({ enabled: true, factor: lvl });
                  setActiveMenu(null);
                }}
                className={`py-1.5 px-2 rounded-lg text-center text-xs font-mono font-bold transition-colors cursor-pointer ${
                  autoZoomConfig.factor === lvl && autoZoomConfig.enabled
                    ? 'bg-indigo-600 text-white'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700 hover:text-white'
                }`}
              >
                {lvl}x Zoom
              </button>
            ))}
          </div>

          <label className="flex items-center justify-between px-1.5 py-1 rounded bg-neutral-950/60 text-[11px] text-neutral-300 cursor-pointer">
            <span>Click Spotlight Ripples</span>
            <input
              type="checkbox"
              checked={autoZoomConfig.showClickRipple}
              onChange={(e) => onUpdateAutoZoomConfig({ showClickRipple: e.target.checked })}
              className="accent-indigo-500"
            />
          </label>
        </div>
      )}
      </div>
      {activeMenu && !menuUp && <div aria-hidden style={{ height: menuSpace }} />}
    </div>
  );
};
