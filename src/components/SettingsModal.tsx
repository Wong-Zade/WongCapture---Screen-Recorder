import React from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  Sliders, 
  Check, 
  Keyboard, 
  FileVideo, 
  Sparkles,
  Info,
  ShieldCheck
} from 'lucide-react';
import { RecordingSettings, VideoResolution, VideoFrameRate, VideoFormat } from '../types';
import { getSupportedFormats } from '../utils/mp4Converter';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RecordingSettings;
  onUpdateSettings: (settings: Partial<RecordingSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const supported = React.useMemo(() => getSupportedFormats(), []);

  if (!isOpen) return null;

  const resolutions: { id: VideoResolution; label: string; desc: string }[] = [
    { id: '1080p', label: '1080p Full HD', desc: '1920 × 1080 (Recommended)' },
    { id: '4k', label: '4K Ultra HD', desc: '3840 × 2160 (Crisp text)' },
    { id: '720p', label: '720p HD', desc: '1280 × 720 (Lightweight)' },
    { id: 'source', label: 'Display Native', desc: 'Exact screen resolution' },
  ];

  const framerates: VideoFrameRate[] = [60, 30, 24];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <SettingsIcon className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold tracking-tight">Recording Preferences</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* Output Format */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-200 block">
              Default Save Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateSettings({ format: 'mp4' })}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  settings.format === 'mp4'
                    ? 'bg-sky-950/70 border-sky-600 text-sky-200'
                    : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">MP4 (H.264 / AAC)</span>
                  {settings.format === 'mp4' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Universal Windows / Mac / Phone playback. Direct export.
                </p>
              </button>

              <button
                onClick={() => onUpdateSettings({ format: 'webm' })}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  settings.format === 'webm'
                    ? 'bg-sky-950/70 border-sky-600 text-sky-200'
                    : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">WebM (VP9 / Opus)</span>
                  {settings.format === 'webm' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  High efficiency web video. Instant browser recording.
                </p>
              </button>
            </div>
          </div>

          {/* Resolution */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-200 block">
              Capture Resolution
            </label>
            <div className="grid grid-cols-2 gap-2">
              {resolutions.map((res) => (
                <button
                  key={res.id}
                  onClick={() => onUpdateSettings({ resolution: res.id })}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    settings.resolution === res.id
                      ? 'bg-sky-950/70 border-sky-600 text-sky-200'
                      : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  <span className="text-xs font-semibold block">{res.label}</span>
                  <span className="text-[11px] text-neutral-500">{res.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Framerate & Bitrate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-neutral-200 block mb-1.5">
                Target Frame Rate
              </label>
              <div className="flex gap-1.5 p-1 bg-neutral-950 rounded-lg border border-neutral-800">
                {framerates.map((fps) => (
                  <button
                    key={fps}
                    onClick={() => onUpdateSettings({ frameRate: fps })}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                      settings.frameRate === fps ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-200 block mb-1.5">
                Countdown Delay
              </label>
              <div className="flex gap-1.5 p-1 bg-neutral-950 rounded-lg border border-neutral-800">
                {[0, 3, 5].map((cd) => (
                  <button
                    key={cd}
                    onClick={() => onUpdateSettings({ countdown: cd })}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                      settings.countdown === cd ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {cd === 0 ? 'Off' : `${cd}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filename Prefix */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-200 block">
              File Name Prefix
            </label>
            <input
              type="text"
              value={settings.filenamePrefix}
              onChange={(e) => onUpdateSettings({ filenamePrefix: e.target.value })}
              className="w-full px-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-sky-500"
              placeholder="e.g. WongCapture_Clip"
            />
            <p className="text-[11px] text-neutral-500">
              Files will be saved as: <code className="font-mono text-neutral-400">{settings.filenamePrefix || 'WongCapture'}_YYYY-MM-DD_HH-mm-ss.{settings.format}</code>
            </p>
          </div>

          {/* Anti-Mirror & Recording Behavior */}
          <div className="space-y-3 p-3.5 bg-neutral-950/60 border border-neutral-800 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Anti-Mirror & Recording Automation</span>
            </div>

            <div className="space-y-2.5">
              {/* Prevent Mirror Loop Toggle */}
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <span className="text-xs font-medium text-neutral-200 block">
                    Prevent Infinite Screen Mirror Loop
                  </span>
                  <span className="text-[11px] text-neutral-400 block leading-tight">
                    Keeps WongCapture's own window out of your recordings and shields the live preview while recording the full screen. Turn off only if you want the app visible in the video.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.preventMirrorLoop !== false}
                  onChange={(e) => onUpdateSettings({ preventMirrorLoop: e.target.checked })}
                  className="mt-0.5 rounded border-neutral-700 text-sky-600 focus:ring-sky-500 bg-neutral-800"
                />
              </label>

              {/* Auto-Minimize on Record */}
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <span className="text-xs font-medium text-neutral-200 block">
                    Auto-Minimize Window on Record
                  </span>
                  <span className="text-[11px] text-neutral-400 block leading-tight">
                    Minimizes WongCapture to the tray/taskbar when recording starts so your desktop stays clear.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={!!settings.autoMinimizeOnRecord}
                  onChange={(e) => onUpdateSettings({ autoMinimizeOnRecord: e.target.checked })}
                  className="mt-0.5 rounded border-neutral-700 text-sky-600 focus:ring-sky-500 bg-neutral-800"
                />
              </label>

              {/* Auto-Switch to Mini Bar */}
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <span className="text-xs font-medium text-neutral-200 block">
                    Auto-Switch to Mini Bar HUD
                  </span>
                  <span className="text-[11px] text-neutral-400 block leading-tight">
                    Automatically collapses to the compact Floating Mini Bar widget when recording starts.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={!!settings.autoSwitchToMiniBar}
                  onChange={(e) => onUpdateSettings({ autoSwitchToMiniBar: e.target.checked })}
                  className="mt-0.5 rounded border-neutral-700 text-sky-600 focus:ring-sky-500 bg-neutral-800"
                />
              </label>
            </div>
          </div>

          {/* Keyboard Shortcuts Table */}
          <div className="p-3.5 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200 mb-1">
              <Keyboard className="w-3.5 h-3.5 text-sky-400" />
              <span>Windows Keyboard Shortcuts</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-neutral-400">
                <span>Start / Stop Recording</span>
                <span className="font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700">
                  F9 or Space
                </span>
              </div>
              <div className="flex items-center justify-between text-neutral-400">
                <span>Pause / Resume</span>
                <span className="font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700">
                  Ctrl + Shift + P
                </span>
              </div>
              <div className="flex items-center justify-between text-neutral-400">
                <span>Take Snapshot</span>
                <span className="font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700">
                  Ctrl + Shift + S
                </span>
              </div>
              <div className="flex items-center justify-between text-neutral-400">
                <span>Toggle Mini Bar</span>
                <span className="font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700">
                  Alt + M
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-950/80 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
