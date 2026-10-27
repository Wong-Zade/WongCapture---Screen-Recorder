import React from 'react';
import { 
  X, 
  Monitor, 
  AppWindow, 
  RefreshCw, 
  Search, 
  Check, 
  Layers, 
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { DesktopCaptureSource } from '../types';

interface SourcePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSource: (source: DesktopCaptureSource) => void;
  onSelectBrowserNative: () => void;
}

export const SourcePickerModal: React.FC<SourcePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSource,
  onSelectBrowserNative,
}) => {
  const [activeTab, setActiveTab] = React.useState<'windows' | 'screens'>('windows');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sources, setSources] = React.useState<DesktopCaptureSource[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasElectronCapture, setHasElectronCapture] = React.useState(false);

  const loadSources = React.useCallback(async () => {
    if (typeof window !== 'undefined' && window.wongCapture?.getSources) {
      setHasElectronCapture(true);
      setIsLoading(true);
      try {
        const fetched = await window.wongCapture.getSources();
        setSources(fetched);
        // Default to screens if no windows found, or windows if present
        const hasWindows = fetched.some(s => !s.isScreen);
        if (!hasWindows) {
          setActiveTab('screens');
        }
      } catch (err) {
        console.warn('Could not query desktop sources:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setHasElectronCapture(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      loadSources();
      setSearchQuery('');
    }
  }, [isOpen, loadSources]);

  if (!isOpen) return null;

  const screens = sources.filter(s => s.isScreen);
  const windows = sources.filter(s => !s.isScreen && (!s.name.includes('WongCapture') || s.name.length > 25));

  const filteredItems = (activeTab === 'windows' ? windows : screens).filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-neutral-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-white">Select Capture Source</h3>
              <p className="text-xs text-neutral-400">
                Choose an individual window or whole screen. Recording a window avoids infinite screen reflections!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasElectronCapture ? (
          <>
            {/* Controls Bar: Tabs, Search & Refresh */}
            <div className="px-6 py-3 border-b border-neutral-800/80 bg-neutral-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Tab Selector */}
              <div className="flex p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                <button
                  onClick={() => setActiveTab('windows')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'windows'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <AppWindow className="w-3.5 h-3.5" />
                  <span>Application Windows ({windows.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('screens')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'screens'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Entire Screens ({screens.length})</span>
                </button>
              </div>

              {/* Search & Refresh */}
              <div className="flex items-center gap-2 flex-1 max-w-xs ml-auto">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={activeTab === 'windows' ? 'Filter windows...' : 'Filter screens...'}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <button
                  onClick={loadSources}
                  disabled={isLoading}
                  className="p-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  title="Refresh open windows"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Grid of Sources */}
            <div className="p-6 overflow-y-auto flex-1">
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-400 mb-3">
                    {activeTab === 'windows' ? <AppWindow className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                  </div>
                  <p className="text-sm font-medium text-neutral-300">
                    {searchQuery ? 'No matching sources found' : 'No sources available'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                    {activeTab === 'windows' 
                      ? 'Ensure your applications are not minimized to the taskbar, then click Refresh.'
                      : 'Make sure your monitor displays are detected.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onSelectSource(item)}
                      className="group relative bg-neutral-950 border border-neutral-800 hover:border-sky-500 rounded-xl overflow-hidden p-2.5 flex flex-col gap-2.5 transition-all hover:shadow-xl hover:shadow-sky-500/10 cursor-pointer text-left"
                    >
                      {/* Thumbnail with overlay badge */}
                      <div className="relative aspect-video w-full rounded-lg bg-neutral-900 overflow-hidden border border-neutral-800/80 group-hover:border-sky-500/50">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            {item.isScreen ? <Monitor className="w-8 h-8" /> : <AppWindow className="w-8 h-8" />}
                          </div>
                        )}

                        {/* Top-Right Badge */}
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-neutral-950/80 backdrop-blur-md border border-neutral-700 text-[10px] text-neutral-300 font-mono">
                          {item.isScreen ? 'Screen' : 'Window'}
                        </div>
                      </div>

                      {/* Title & App Icon */}
                      <div className="flex items-center gap-2 min-w-0">
                        {item.appIcon ? (
                          <img
                            src={item.appIcon}
                            alt=""
                            className="w-4 h-4 rounded shrink-0 object-contain"
                          />
                        ) : item.isScreen ? (
                          <Monitor className="w-4 h-4 text-sky-400 shrink-0" />
                        ) : (
                          <AppWindow className="w-4 h-4 text-sky-400 shrink-0" />
                        )}
                        <span 
                          className="text-xs font-semibold text-neutral-200 group-hover:text-white truncate"
                          title={item.name}
                        >
                          {item.name || 'Unnamed Source'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Browser / Web Mode Selector */
          <div className="p-8 space-y-6 text-center flex flex-col items-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sky-400 shadow-inner">
              <AppWindow className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-semibold text-neutral-100">
                Choose Screen or Window in Browser Dialog
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Click below to open the system picker dialog. You can switch between 
                <strong className="text-sky-300 font-semibold"> Entire Screen</strong> and 
                <strong className="text-sky-300 font-semibold"> Application Window</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-left flex items-start gap-3 w-full">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-neutral-300">
                <span className="font-semibold text-amber-300 block mb-0.5">Tip to avoid infinite mirror feedback:</span>
                Selecting a specific application window (such as Visual Studio Code, Chrome, or a Game) prevents the infinite mirror loop completely!
              </div>
            </div>

            <button
              onClick={onSelectBrowserNative}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-medium text-xs transition-all shadow-lg shadow-sky-600/30 flex items-center gap-2 cursor-pointer"
            >
              <Monitor className="w-4 h-4" />
              <span>Open Window & Screen Selector</span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between shrink-0 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Anti-Mirror Shield active during full-screen recording</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
