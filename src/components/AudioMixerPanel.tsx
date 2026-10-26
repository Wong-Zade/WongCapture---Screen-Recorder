import React from 'react';
import { X, Mic, Volume2, Sparkles, Check, SlidersHorizontal } from 'lucide-react';
import { AudioConfig } from '../types';

interface AudioMixerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  audioConfig: AudioConfig;
  onUpdateConfig: (config: Partial<AudioConfig>) => void;
  micLevel: number; // 0 to 1
  systemLevel: number; // 0 to 1
}

export const AudioMixerPanel: React.FC<AudioMixerPanelProps> = ({
  isOpen,
  onClose,
  audioConfig,
  onUpdateConfig,
  micLevel,
  systemLevel,
}) => {
  const [audioDevices, setAudioDevices] = React.useState<MediaDeviceInfo[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      navigator.mediaDevices?.enumerateDevices().then((devices) => {
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
      }).catch(console.warn);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold tracking-tight">Audio Mixer & Sources</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Microphone Channel */}
          <div className="space-y-3 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className={`w-4 h-4 ${audioConfig.microphone ? 'text-sky-400' : 'text-neutral-500'}`} />
                <span className="text-xs font-semibold">Microphone Voice</span>
              </div>
              <button
                onClick={() => onUpdateConfig({ microphone: !audioConfig.microphone })}
                className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                  audioConfig.microphone
                    ? 'bg-sky-950 text-sky-300 border border-sky-800'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {audioConfig.microphone ? 'Enabled' : 'Muted'}
              </button>
            </div>

            {audioDevices.length > 0 && (
              <div>
                <label className="text-[10px] text-neutral-400 uppercase font-mono block mb-1">
                  Input Device
                </label>
                <select
                  value={audioConfig.micDeviceId}
                  onChange={(e) => onUpdateConfig({ micDeviceId: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="">Default Microphone</option>
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Volume slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400">Mic Gain</span>
                <span className="font-mono text-neutral-300 tabular-nums">
                  {Math.round(audioConfig.micVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={audioConfig.micVolume}
                onChange={(e) => onUpdateConfig({ micVolume: parseFloat(e.target.value) })}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Live VU Meter */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                <span>Signal Level</span>
                <span className="font-mono">{Math.round(micLevel * 100)}%</span>
              </div>
              <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden flex p-0.5 border border-neutral-800">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.round(micLevel * 100)}%`,
                    backgroundColor: micLevel > 0.85 ? '#ef4444' : micLevel > 0.6 ? '#f59e0b' : '#10b981',
                  }}
                />
              </div>
            </div>

            {/* Enhancements */}
            <div className="pt-2 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                <input
                  type="checkbox"
                  checked={audioConfig.noiseSuppression}
                  onChange={(e) => onUpdateConfig({ noiseSuppression: e.target.checked })}
                  className="rounded border-neutral-700 bg-neutral-900 text-sky-500 focus:ring-0"
                />
                <span>Noise Suppression</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                <input
                  type="checkbox"
                  checked={audioConfig.echoCancellation}
                  onChange={(e) => onUpdateConfig({ echoCancellation: e.target.checked })}
                  className="rounded border-neutral-700 bg-neutral-900 text-sky-500 focus:ring-0"
                />
                <span>Echo Cancellation</span>
              </label>
            </div>
          </div>

          {/* System Audio Channel */}
          <div className="space-y-3 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className={`w-4 h-4 ${audioConfig.systemAudio ? 'text-sky-400' : 'text-neutral-500'}`} />
                <span className="text-xs font-semibold">System & Tab Audio</span>
              </div>
              <button
                onClick={() => onUpdateConfig({ systemAudio: !audioConfig.systemAudio })}
                className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                  audioConfig.systemAudio
                    ? 'bg-sky-950 text-sky-300 border border-sky-800'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {audioConfig.systemAudio ? 'Enabled' : 'Muted'}
              </button>
            </div>

            {/* Volume slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400">System Volume</span>
                <span className="font-mono text-neutral-300 tabular-nums">
                  {Math.round(audioConfig.systemVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={audioConfig.systemVolume}
                onChange={(e) => onUpdateConfig({ systemVolume: parseFloat(e.target.value) })}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Live VU Meter */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                <span>Signal Level</span>
                <span className="font-mono">{Math.round(systemLevel * 100)}%</span>
              </div>
              <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden flex p-0.5 border border-neutral-800">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.round(systemLevel * 100)}%`,
                    backgroundColor: systemLevel > 0.85 ? '#ef4444' : systemLevel > 0.6 ? '#f59e0b' : '#10b981',
                  }}
                />
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
