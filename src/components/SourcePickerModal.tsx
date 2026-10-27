import React from 'react';
import { 
  X, 
  Monitor, 
  AppWindow, 
  RefreshCw, 
  Search, 
  Check, 
  Layers, 
  Crop, 
  Sparkles,
  ShieldAlert,
  Maximize2,
  Square,
  Smartphone,
  Move
} from 'lucide-react';
import { DesktopCaptureSource, CropRegion, SelectionPreset } from '../types';

interface SourcePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSource: (source: DesktopCaptureSource) => void;
  onSelectBrowserNative: () => void;
  cropRegion: CropRegion;
  onChangeCropRegion: (newCrop: CropRegion) => void;
  onStartAreaSelection: () => void;
  hasActiveScreen: boolean;
}

export const SourcePickerModal: React.FC<SourcePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSource,
  onSelectBrowserNative,
  cropRegion,
  onChangeCropRegion,
  onStartAreaSelection,
  hasActiveScreen,
}) => {
  const [activeTab, setActiveTab] = React.useState<'windows' | 'screens' | 'area'>('windows');
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
        const hasWindows = fetched.some((s) => !s.isScreen);
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
      // In web browser, default to area or screens
      setActiveTab('area');
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      loadSources();
      setSearchQuery('');
    }
  }, [isOpen, loadSources]);

  if (!isOpen) return null;

  const screens = sources.filter((s) => s.isScreen);
  const windows = sources.filter((s) => !s.isScreen && (!s.name.includes('WongCapture') || s.name.length > 25));

  const filteredItems = (activeTab === 'windows' ? windows : screens).filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApplyPreset = (preset: SelectionPreset) => {
    if (preset === 'full') {
      onChangeCropRegion({
        enabled: false,
        preset: 'full',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      });
      return;
    }

    let normW = 0.8;
    let normH = 0.8;

    if (preset === '16:9') {
      normW = 0.85;
      normH = (0.85 * 9) / 16;
    } else if (preset === '4:3') {
      normW = 0.75;
      normH = (0.75 * 3) / 4;
    } else if (preset === '1:1') {
      normH = 0.75;
      normW = (0.75 * 9) / 16;
    } else if (preset === '9:16') {
      normH = 0.88;
      normW = (0.88 * 9) / 16 * (9 / 16);
    } else {
      normW = 0.8;
      normH = 0.7;
    }

    normW = Math.max(0.2, Math.min(0.95, normW));
    normH = Math.max(0.2, Math.min(0.95, normH));

    const normX = Math.max(0, (1 - normW) / 2);
    const normY = Math.max(0, (1 - normH) / 2);

    onChangeCropRegion({
      enabled: true,
      preset,
      x: normX,
      y: normY,
      width: normW,
      height: normH,
    });
  };

  const handleStartFraming = () => {
    if (!cropRegion.enabled) {
      handleApplyPreset('16:9');
    }
    onStartAreaSelection();
    onClose();
  };

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
              <h3 className="text-base font-semibold tracking-tight text-white">Select Capture Source & Area</h3>
              <p className="text-xs text-neutral-400">
                Choose an individual application window, full screen display, or crop a custom recording area.
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

        {/* Tab Selector Bar */}
        <div className="px-6 py-3 border-b border-neutral-800/80 bg-neutral-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex p-1 bg-neutral-950 rounded-xl border border-neutral-800">
            {hasElectronCapture && (
              <>
                <button
                  onClick={() => setActiveTab('windows')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'windows'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <AppWindow className="w-3.5 h-3.5" />
                  <span>Windows ({windows.length})</span>
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
                  <span>Screens ({screens.length})</span>
                </button>
              </>
            )}

            {/* Custom Area / Region Tab */}
            <button
              onClick={() => setActiveTab('area')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'area'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>
                Selection Area {cropRegion.enabled ? `(${cropRegion.preset})` : ''}
              </span>
            </button>
          </div>

          {/* Search bar for Windows/Screens tabs */}
          {activeTab !== 'area' && hasElectronCapture && (
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
          )}
        </div>

        {/* Tab 1 & 2: Electron Windows & Screens */}
        {activeTab !== 'area' && hasElectronCapture && (
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
                    ? 'Make sure applications are not minimized to the taskbar, then click Refresh.'
                    : 'Ensure monitors are connected and detected.'}
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

                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-neutral-950/80 backdrop-blur-md border border-neutral-700 text-[10px] text-neutral-300 font-mono">
                        {item.isScreen ? 'Screen' : 'Window'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      {item.appIcon ? (
                        <img src={item.appIcon} alt="" className="w-4 h-4 rounded shrink-0 object-contain" />
                      ) : item.isScreen ? (
                        <Monitor className="w-4 h-4 text-sky-400 shrink-0" />
                      ) : (
                        <AppWindow className="w-4 h-4 text-sky-400 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-neutral-200 group-hover:text-white truncate" title={item.name}>
                        {item.name || 'Unnamed Source'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Custom Area / Region Selection */}
        {activeTab === 'area' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Crop className="w-4 h-4 text-sky-400" />
                  <h4 className="text-sm font-semibold text-white">Record a Selected Part of Your Screen</h4>
                </div>
                <p className="text-xs text-neutral-400 max-w-xl leading-relaxed">
                  Crop your recording to a specific area or aspect ratio. Perfect for capturing just one panel of an app, creating portrait 9:16 Shorts/Reels, or focusing on code without toolbars.
                </p>
              </div>

              <button
                onClick={handleStartFraming}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-all shadow-md shadow-sky-950/50 flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <Move className="w-3.5 h-3.5" />
                <span>Frame Area on Screen</span>
              </button>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
                Recording Area Aspect Presets
              </label>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Full Screen */}
                <button
                  onClick={() => handleApplyPreset('full')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    !cropRegion.enabled || cropRegion.preset === 'full'
                      ? 'bg-sky-950/60 border-sky-500 text-white shadow-sm'
                      : 'bg-neutral-950/50 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Maximize2 className="w-4 h-4 text-sky-400" />
                    {(!cropRegion.enabled || cropRegion.preset === 'full') && <Check className="w-4 h-4 text-sky-400" />}
                  </div>
                  <div className="text-xs font-semibold">Full Display</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Capture 100% of the screen</div>
                </button>

                {/* 16:9 Landscape */}
                <button
                  onClick={() => handleApplyPreset('16:9')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    cropRegion.enabled && cropRegion.preset === '16:9'
                      ? 'bg-sky-950/60 border-sky-500 text-white shadow-sm'
                      : 'bg-neutral-950/50 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Monitor className="w-4 h-4 text-sky-400" />
                    {cropRegion.enabled && cropRegion.preset === '16:9' && <Check className="w-4 h-4 text-sky-400" />}
                  </div>
                  <div className="text-xs font-semibold">16:9 Widescreen</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">YouTube & standard video</div>
                </button>

                {/* 4:3 Standard */}
                <button
                  onClick={() => handleApplyPreset('4:3')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    cropRegion.enabled && cropRegion.preset === '4:3'
                      ? 'bg-sky-950/60 border-sky-500 text-white shadow-sm'
                      : 'bg-neutral-950/50 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Square className="w-4 h-4 text-sky-400" />
                    {cropRegion.enabled && cropRegion.preset === '4:3' && <Check className="w-4 h-4 text-sky-400" />}
                  </div>
                  <div className="text-xs font-semibold">4:3 Standard</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Classic presentations</div>
                </button>

                {/* 1:1 Square */}
                <button
                  onClick={() => handleApplyPreset('1:1')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    cropRegion.enabled && cropRegion.preset === '1:1'
                      ? 'bg-sky-950/60 border-sky-500 text-white shadow-sm'
                      : 'bg-neutral-950/50 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Square className="w-4 h-4 text-sky-400" />
                    {cropRegion.enabled && cropRegion.preset === '1:1' && <Check className="w-4 h-4 text-sky-400" />}
                  </div>
                  <div className="text-xs font-semibold">1:1 Square</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Instagram & social posts</div>
                </button>

                {/* 9:16 Vertical */}
                <button
                  onClick={() => handleApplyPreset('9:16')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    cropRegion.enabled && cropRegion.preset === '9:16'
                      ? 'bg-sky-950/60 border-sky-500 text-white shadow-sm'
                      : 'bg-neutral-950/50 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Smartphone className="w-4 h-4 text-sky-400" />
                    {cropRegion.enabled && cropRegion.preset === '9:16' && <Check className="w-4 h-4 text-sky-400" />}
                  </div>
                  <div className="text-xs font-semibold">9:16 Vertical</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">TikTok, Reels & Shorts</div>
                </button>

                {/* Freeform Custom Area */}
                <button
                  onClick={handleStartFraming}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    cropRegion.enabled && cropRegion.preset === 'custom'
                      ? 'bg-sky-950/60 border-sky-500 text-white shadow-sm'
                      : 'bg-neutral-950/50 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Crop className="w-4 h-4 text-sky-400" />
                    {cropRegion.enabled && cropRegion.preset === 'custom' && <Check className="w-4 h-4 text-sky-400" />}
                  </div>
                  <div className="text-xs font-semibold">Custom Area</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Drag 8-handle box freely</div>
                </button>
              </div>
            </div>

            {/* Quick Status / Reset Button */}
            {cropRegion.enabled && (
              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between">
                <div className="text-xs text-neutral-300">
                  <span>Currently active: </span>
                  <span className="font-semibold text-sky-400 font-mono">
                    {cropRegion.preset.toUpperCase()} ({Math.round(cropRegion.width * 100)}% × {Math.round(cropRegion.height * 100)}%)
                  </span>
                </div>
                <button
                  onClick={() => handleApplyPreset('full')}
                  className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  Reset to Full Screen
                </button>
              </div>
            )}
          </div>
        )}

        {/* Browser fallback note if opened in web */}
        {!hasElectronCapture && activeTab !== 'area' && (
          <div className="p-8 text-center flex flex-col items-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sky-400 shadow-inner mb-4">
              <AppWindow className="w-8 h-8" />
            </div>

            <h4 className="text-base font-semibold text-neutral-100 mb-2">
              Select Application Window or Screen in Browser
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed mb-6">
              Click below to open the browser selector and choose between 
              <strong className="text-sky-300"> Entire Screen</strong> and 
              <strong className="text-sky-300"> Application Window</strong>.
            </p>

            <button
              onClick={() => {
                onClose();
                onSelectBrowserNative();
              }}
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
