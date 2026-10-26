import React from 'react';
import { 
  X, 
  Play, 
  Pause, 
  Download, 
  Scissors, 
  Camera, 
  Check, 
  Edit2, 
  Clock, 
  HardDrive, 
  Film,
  Sparkles,
  Loader2
} from 'lucide-react';
import { RecordedClip } from '../types';
import { convertToMp4, trimVideo } from '../utils/mp4Converter';

interface ClipPlayerModalProps {
  clip: RecordedClip | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTitle: (id: string, newTitle: string) => void;
  onSaveNewTrimmedClip?: (clip: RecordedClip) => void;
}

export const ClipPlayerModal: React.FC<ClipPlayerModalProps> = ({
  clip,
  isOpen,
  onClose,
  onUpdateTitle,
  onSaveNewTrimmedClip,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleInput, setTitleInput] = React.useState('');

  // Trim sliders
  const [trimStart, setTrimStart] = React.useState(0);
  const [trimEnd, setTrimEnd] = React.useState(0);
  const [isTrimming, setIsTrimming] = React.useState(false);
  const [trimProgress, setTrimProgress] = React.useState(0);

  // Direct MP4 conversion status
  const [isConvertingMp4, setIsConvertingMp4] = React.useState(false);
  const [convertProgress, setConvertProgress] = React.useState(0);

  React.useEffect(() => {
    if (clip) {
      setTitleInput(clip.title);
      setDuration(clip.duration);
      setTrimStart(0);
      setTrimEnd(clip.duration);
      setCurrentTime(0);
      setIsPlaying(false);
      setIsTrimming(false);
      setIsConvertingMp4(false);
    }
  }, [clip]);

  if (!isOpen || !clip) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || clip.duration;
    setDuration(dur);
    if (trimEnd === 0 || trimEnd > dur) {
      setTrimEnd(dur);
    }
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const handleSaveTitle = () => {
    if (titleInput.trim()) {
      onUpdateTitle(clip.id, titleInput.trim());
      setIsEditingTitle(false);
    }
  };

  // Direct MP4 Download handler
  const handleDownloadMp4 = async () => {
    const filename = `${clip.title.replace(/\.[^/.]+$/, '')}.mp4`;

    if (clip.format === 'mp4' || clip.blob.type.includes('mp4')) {
      // Direct download native MP4
      const a = document.createElement('a');
      a.href = clip.url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Convert to MP4 using client-side muxer
    setIsConvertingMp4(true);
    setConvertProgress(0);
    try {
      const mp4Blob = await convertToMp4(clip.blob, (p) => setConvertProgress(Math.round(p * 100)));
      const mp4Url = URL.createObjectURL(mp4Blob);
      const a = document.createElement('a');
      a.href = mp4Url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(mp4Url), 10000);
    } catch (err) {
      console.error('Failed to convert to MP4:', err);
      // Fallback direct download
      const a = document.createElement('a');
      a.href = clip.url;
      a.download = `${clip.title.replace(/\.[^/.]+$/, '')}.${clip.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsConvertingMp4(false);
    }
  };

  // Direct WebM download
  const handleDownloadWebm = () => {
    const a = document.createElement('a');
    a.href = clip.url;
    a.download = `${clip.title.replace(/\.[^/.]+$/, '')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Trim and Export MP4
  const handleExportTrimmed = async () => {
    if (trimEnd <= trimStart) return;
    setIsTrimming(true);
    setTrimProgress(0);

    try {
      const trimmedBlob = await trimVideo(
        clip.blob,
        trimStart,
        trimEnd,
        'mp4',
        (p) => setTrimProgress(Math.round(p * 100))
      );

      const trimmedFilename = `${clip.title.replace(/\.[^/.]+$/, '')}_trimmed.mp4`;
      const url = URL.createObjectURL(trimmedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = trimmedFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (onSaveNewTrimmedClip) {
        const newClip: RecordedClip = {
          id: `clip_${Date.now()}`,
          title: trimmedFilename,
          timestamp: Date.now(),
          duration: trimEnd - trimStart,
          blob: trimmedBlob,
          url,
          thumbnailUrl: clip.thumbnailUrl,
          format: 'mp4',
          sizeBytes: trimmedBlob.size,
          width: clip.width,
          height: clip.height,
          fps: clip.fps,
        };
        onSaveNewTrimmedClip(newClip);
      }
    } catch (err) {
      console.error('Failed to trim video:', err);
    } finally {
      setIsTrimming(false);
    }
  };

  // Snapshot frame
  const handleCaptureFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1920;
    canvas.height = videoRef.current.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `snapshot_${clip.title.replace(/\.[^/.]+$/, '')}_${Math.round(currentTime)}s.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const previewTrimRange = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = trimStart;
    videoRef.current.play();
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/40">
          <div className="flex items-center gap-3">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="px-2 py-1 text-sm bg-neutral-950 border border-sky-500 rounded text-neutral-100 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1 text-emerald-400 hover:text-emerald-300"
                  title="Save title"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                <h3 className="text-sm font-semibold text-neutral-100">{clip.title}</h3>
                <Edit2 className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
              </div>
            )}
            <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60">
              {clip.format}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCaptureFrame}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              title="Save current frame as PNG snapshot"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Canvas */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            src={clip.url}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
            className="w-full h-full object-contain cursor-pointer"
          />

          {/* Center Play Overlay when paused */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute w-14 h-14 rounded-full bg-neutral-900/80 backdrop-blur-md border border-neutral-700/80 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-6 h-6 fill-current translate-x-0.5" />
            </button>
          )}

          {/* Timecode overlay */}
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-neutral-950/80 text-xs font-mono text-neutral-300 tabular-nums">
            {formatSecs(currentTime)} / {formatSecs(duration)}
          </div>
        </div>

        {/* Scrub & Trim Controls */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Main playback scrubber */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={duration || 1}
              step="0.05"
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-800 rounded-lg accent-sky-500 cursor-pointer"
            />
          </div>

          {/* Trimmer Box */}
          <div className="p-3.5 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-xs font-semibold text-neutral-200">Clip Trimmer</span>
              </div>
              <button
                onClick={previewTrimRange}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
              >
                Preview Trim Range
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Start Cut</span>
                  <span className="font-mono text-neutral-200">{formatSecs(trimStart)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, trimEnd - 0.2)}
                  step="0.1"
                  value={trimStart}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTrimStart(val);
                    handleSeek(val);
                  }}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg accent-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>End Cut</span>
                  <span className="font-mono text-neutral-200">{formatSecs(trimEnd)}</span>
                </div>
                <input
                  type="range"
                  min={Math.min(duration, trimStart + 0.2)}
                  max={duration || 1}
                  step="0.1"
                  value={trimEnd}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTrimEnd(val);
                    handleSeek(val);
                  }}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg accent-sky-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Trim action */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-neutral-400">
                Trimmed Length: <span className="font-mono text-neutral-200 font-medium">{formatSecs(Math.max(0, trimEnd - trimStart))}</span>
              </span>

              <button
                onClick={handleExportTrimmed}
                disabled={isTrimming}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-sky-950"
              >
                {isTrimming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Exporting MP4 ({trimProgress}%)</span>
                  </>
                ) : (
                  <>
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Save Trimmed MP4</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/60">
              <span className="text-[10px] text-neutral-500 uppercase font-mono block">Duration</span>
              <span className="font-mono text-neutral-200">{formatSecs(duration)}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/60">
              <span className="text-[10px] text-neutral-500 uppercase font-mono block">Resolution</span>
              <span className="font-mono text-neutral-200">{clip.width} × {clip.height}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/60">
              <span className="text-[10px] text-neutral-500 uppercase font-mono block">File Size</span>
              <span className="font-mono text-neutral-200">
                {(clip.sizeBytes / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/60">
              <span className="text-[10px] text-neutral-500 uppercase font-mono block">Framerate</span>
              <span className="font-mono text-neutral-200">{clip.fps} fps</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-neutral-950/70 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={handleDownloadWebm}
            className="px-3 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
          >
            Download as WebM
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadMp4}
              disabled={isConvertingMp4}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isConvertingMp4 ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Converting MP4 ({convertProgress}%)...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download MP4 File</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
