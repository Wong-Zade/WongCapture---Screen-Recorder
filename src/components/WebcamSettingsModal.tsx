import React from 'react';
import { X, Video, Sliders, Check, FlipHorizontal } from 'lucide-react';
import { WebcamConfig, WebcamPosition, WebcamShape, WebcamSize } from '../types';

interface WebcamSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WebcamConfig;
  onUpdateConfig: (config: Partial<WebcamConfig>) => void;
  webcamStream: MediaStream | null;
}

export const WebcamSettingsModal: React.FC<WebcamSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  webcamStream,
}) => {
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      navigator.mediaDevices?.enumerateDevices().then((devs) => {
        setDevices(devs.filter((d) => d.kind === 'videoinput'));
      }).catch(console.warn);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
    }
  }, [webcamStream, isOpen]);

  if (!isOpen) return null;

  const positions: { id: WebcamPosition; label: string }[] = [
    { id: 'top-left', label: 'Top Left' },
    { id: 'top-right', label: 'Top Right' },
    { id: 'bottom-left', label: 'Bottom Left' },
    { id: 'bottom-right', label: 'Bottom Right' },
  ];

  const shapes: { id: WebcamShape; label: string }[] = [
    { id: 'circle', label: 'Circle' },
    { id: 'rounded', label: 'Rounded' },
    { id: 'square', label: 'Square' },
  ];

  const sizes: { id: WebcamSize; label: string }[] = [
    { id: 'small', label: 'Small' },
    { id: 'medium', label: 'Medium' },
    { id: 'large', label: 'Large' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold tracking-tight">Webcam PiP Overlay</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Live Preview Box */}
          <div className="relative aspect-video bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex items-center justify-center">
            {webcamStream && config.enabled ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${config.mirrored ? 'scale-x-[-1]' : ''}`}
              />
            ) : (
              <div className="text-center p-4">
                <Video className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <span className="text-xs text-neutral-400">Webcam is disabled</span>
              </div>
            )}

            {/* Mirror badge */}
            {config.enabled && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-neutral-950/80 rounded text-[10px] text-neutral-300">
                {config.shape.toUpperCase()} · {config.size.toUpperCase()}
              </div>
            )}
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/80">
            <span className="text-xs font-semibold">Enable Webcam Overlay</span>
            <button
              onClick={() => onUpdateConfig({ enabled: !config.enabled })}
              className={`px-3 py-1 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                config.enabled
                  ? 'bg-sky-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {config.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Device selector */}
          {devices.length > 0 && (
            <div>
              <label className="text-[10px] text-neutral-400 uppercase font-mono block mb-1">
                Camera Device
              </label>
              <select
                value={config.deviceId}
                onChange={(e) => onUpdateConfig({ deviceId: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-sky-500"
              >
                <option value="">Default Camera</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Position Selector */}
          <div>
            <label className="text-[10px] text-neutral-400 uppercase font-mono block mb-1.5">
              Screen Corner
            </label>
            <div className="grid grid-cols-2 gap-2">
              {positions.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => onUpdateConfig({ position: pos.id })}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer ${
                    config.position === pos.id
                      ? 'bg-sky-950/80 border-sky-600 text-sky-200'
                      : 'bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shape and Size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-neutral-400 uppercase font-mono block mb-1.5">
                Shape
              </label>
              <div className="flex gap-1.5 p-1 bg-neutral-950 rounded-lg border border-neutral-800">
                {shapes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onUpdateConfig({ shape: s.id })}
                    className={`flex-1 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                      config.shape === s.id ? 'bg-sky-600 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-neutral-400 uppercase font-mono block mb-1.5">
                Size
              </label>
              <div className="flex gap-1.5 p-1 bg-neutral-950 rounded-lg border border-neutral-800">
                {sizes.map((sz) => (
                  <button
                    key={sz.id}
                    onClick={() => onUpdateConfig({ size: sz.id })}
                    className={`flex-1 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                      config.size === sz.id ? 'bg-sky-600 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mirror Video Toggle */}
          <label className="flex items-center justify-between p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/80 cursor-pointer">
            <div className="flex items-center gap-2 text-xs font-medium">
              <FlipHorizontal className="w-4 h-4 text-neutral-400" />
              <span>Mirror Camera View</span>
            </div>
            <input
              type="checkbox"
              checked={config.mirrored}
              onChange={(e) => onUpdateConfig({ mirrored: e.target.checked })}
              className="rounded border-neutral-700 bg-neutral-900 text-sky-500 focus:ring-0"
            />
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-950/80 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
