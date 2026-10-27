import React from 'react';
import { 
  Minus, 
  Square, 
  Copy,
  X, 
  Pin, 
  PinOff, 
  Minimize2, 
  Maximize2,
  Video,
  Settings,
  Film
} from 'lucide-react';
import { RecordingStatus } from '../types';

interface WindowsTitleBarProps {
  status: RecordingStatus;
  isCompact: boolean;
  isPinned: boolean;
  onToggleCompact: () => void;
  onTogglePin: () => void;
  onOpenSettings: () => void;
  onOpenLibrary: () => void;
  clipCount: number;
}

export const WindowsTitleBar: React.FC<WindowsTitleBarProps> = ({
  status,
  isCompact,
  isPinned,
  onToggleCompact,
  onTogglePin,
  onOpenSettings,
  onOpenLibrary,
  clipCount,
}) => {
  const [isWindowMaximized, setIsWindowMaximized] = React.useState(false);

  React.useEffect(() => {
    return window.wongWindow?.onMaximizedChange?.((isMax) => {
      setIsWindowMaximized(isMax);
    });
  }, []);

  const handleDoubleClickHeader = (e: React.MouseEvent) => {
    // Only trigger if double clicking the draggable bar, not child buttons
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV' || (e.target as HTMLElement).tagName === 'SPAN') {
      if (window.wongWindow) {
        window.wongWindow.maximize();
      }
    }
  };

  return (
    <header 
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleDoubleClickHeader}
      className="h-10 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800/80 flex items-center justify-between px-3 select-none text-xs text-neutral-300 shrink-0 z-50 cursor-default"
    >
      {/* Zone 1: App Brand & Window Name */}
      <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
        <div className="w-5 h-5 rounded bg-sky-600 flex items-center justify-center text-white shadow-sm shadow-sky-500/20">
          <Video className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold text-neutral-100 tracking-tight">WongCapture</span>
        <span className="text-neutral-500">|</span>
        <span className="text-neutral-400">
          {status === 'recording' ? 'Recording' : status === 'paused' ? 'Paused' : isCompact ? 'Mini Bar' : 'Studio'}
        </span>
      </div>

      {/* Zone 2: Navigation & Quick Views */}
      <nav 
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-2 shrink-0"
      >
        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title="Recorded Clips Library"
        >
          <Film className="w-3.5 h-3.5 text-sky-400" />
          <span>Clips</span>
          {clipCount > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-neutral-800 text-sky-400 rounded border border-neutral-700/60 font-mono">
              {clipCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title="Recording Settings & Shortcuts"
        >
          <Settings className="w-3.5 h-3.5 text-neutral-400" />
          <span>Settings</span>
        </button>
      </nav>

      {/* Zone 3: Windows Window Controls */}
      <div 
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-1 shrink-0"
      >
        <button
          onClick={() => {
            onTogglePin();
            window.wongWindow?.setAlwaysOnTop(!isPinned);
          }}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isPinned ? 'text-sky-400 bg-sky-950/50' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
          }`}
          title={isPinned ? 'Unpin always on top' : 'Pin always on top'}
        >
          {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={onToggleCompact}
          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title={isCompact ? 'Switch to Full Studio' : 'Switch to Mini Bar Widget'}
        >
          {isCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => {
            if (window.wongWindow) {
              window.wongWindow.minimize();
            }
          }}
          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            if (window.wongWindow) {
              window.wongWindow.maximize();
            } else {
              onToggleCompact();
            }
          }}
          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title={isWindowMaximized ? 'Restore Down' : 'Maximize'}
        >
          {isWindowMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-3 h-3" />}
        </button>

        <button
          onClick={() => {
            if (window.wongWindow) {
              window.wongWindow.close();
            } else {
              window.location.reload();
            }
          }}
          className="p-1.5 rounded hover:bg-rose-600 hover:text-white text-neutral-400 transition-colors cursor-pointer"
          title="Close WongCapture"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
