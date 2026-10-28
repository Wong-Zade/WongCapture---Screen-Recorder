import React from 'react';
import { 
  X, 
  Play, 
  Download, 
  Trash2, 
  Search, 
  Film, 
  HardDrive, 
  Calendar, 
  Clock, 
  Scissors,
  Check,
  AlertCircle
} from 'lucide-react';
import { RecordedClip } from '../types';
import { convertToMp4 } from '../utils/mp4Converter';

interface ClipLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  clips: RecordedClip[];
  onSelectClip: (clip: RecordedClip) => void;
  onDeleteClip: (id: string) => void;
  onClearAll: () => void;
}

export const ClipLibrary: React.FC<ClipLibraryProps> = ({
  isOpen,
  onClose,
  clips,
  onSelectClip,
  onDeleteClip,
  onClearAll,
}) => {
  const [search, setSearch] = React.useState('');
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const filteredClips = clips.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const totalBytes = clips.reduce((acc, c) => acc + c.sizeBytes, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleQuickDownloadMp4 = async (clip: RecordedClip, e: React.MouseEvent) => {
    e.stopPropagation();
    const filename = `${clip.title.replace(/\.[^/.]+$/, '')}.mp4`;

    if (clip.format === 'mp4' || clip.blob.type.includes('mp4')) {
      const a = document.createElement('a');
      a.href = clip.url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Convert WebM to MP4
    setDownloadingId(clip.id);
    try {
      const mp4Blob = await convertToMp4(clip.blob);
      const url = URL.createObjectURL(mp4Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error(err);
      // Fallback
      const a = document.createElement('a');
      a.href = clip.url;
      a.download = `${clip.title.replace(/\.[^/.]+$/, '')}.${clip.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <Film className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Recorded Clips Library</h3>
              <p className="text-[11px] text-neutral-400">
                {clips.length} {clips.length === 1 ? 'recording' : 'recordings'} · {totalMb} MB total stored
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {clips.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-2.5 py-1 text-xs text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Toolbar */}
        {clips.length > 0 && (
          <div className="px-5 py-3 border-b border-neutral-800 bg-neutral-950/40">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search clips by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        )}

        {/* List of Clips */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {filteredClips.length === 0 ? (
            <div className="text-center py-12">
              <Film className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
              <h4 className="text-sm font-medium text-neutral-300 mb-1">
                {clips.length === 0 ? 'No recorded clips yet' : 'No matching clips found'}
              </h4>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {clips.length === 0
                  ? 'Hit Record in the studio or floating bar to capture your screen. Recordings are preserved here with options to trim and save as MP4.'
                  : 'Try searching with a different keyword.'}
              </p>
            </div>
          ) : (
            filteredClips.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectClip(c)}
                className="group flex items-center justify-between p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-950/90 transition-all cursor-pointer"
              >
                {/* Left: Thumbnail & Title */}
                <div className="flex items-center gap-3">
                  <div className="relative w-28 aspect-video bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 shrink-0">
                    {c.thumbnailUrl ? (
                      <img
                        src={c.thumbnailUrl}
                        alt={c.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-6 h-6 text-neutral-700" />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[10px] font-mono text-white">
                      {formatSecs(c.duration)}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-neutral-200 group-hover:text-sky-300 transition-colors line-clamp-1">
                      {c.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400">
                      <span>{c.width}×{c.height}</span>
                      <span>·</span>
                      <span className="font-mono">{(c.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                      <span>·</span>
                      <span>{formatDate(c.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => handleQuickDownloadMp4(c, e)}
                    disabled={downloadingId === c.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-sky-600 hover:text-white text-neutral-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                    title="Download directly as MP4"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloadingId === c.id ? 'Exporting...' : 'Save MP4'}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(c);
                    }}
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                    title="Trim & Preview"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClip(c.id);
                    }}
                    className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors"
                    title="Delete clip"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-950/80 border-t border-neutral-800 flex justify-between items-center text-xs text-neutral-400">
          <span>Clips are stored securely in browser storage</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
