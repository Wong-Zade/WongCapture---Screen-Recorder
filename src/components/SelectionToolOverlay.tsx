import React from 'react';
import { CropRegion, SelectionPreset } from '../types';
import { Crop, Maximize, Check, X, Move, Sparkles } from 'lucide-react';

interface SelectionToolOverlayProps {
  containerWidth: number;
  containerHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  cropRegion: CropRegion;
  onChangeCropRegion: (newCrop: CropRegion) => void;
  isSelecting: boolean;
  onToggleSelecting: () => void;
}

export const SelectionToolOverlay: React.FC<SelectionToolOverlayProps> = ({
  containerWidth,
  containerHeight,
  sourceWidth,
  sourceHeight,
  cropRegion,
  onChangeCropRegion,
  isSelecting,
  onToggleSelecting,
}) => {
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = React.useState<string | null>(null);
  const dragStartRef = React.useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Pixel coordinates within preview container
  const boxLeft = cropRegion.x * containerWidth;
  const boxTop = cropRegion.y * containerHeight;
  const boxWidth = cropRegion.width * containerWidth;
  const boxHeight = cropRegion.height * containerHeight;

  // Real recorded resolution in pixels
  const realPixelWidth = Math.round(cropRegion.width * sourceWidth);
  const realPixelHeight = Math.round(cropRegion.height * sourceHeight);

  const presets: { id: SelectionPreset; label: string }[] = [
    { id: 'full', label: 'Full Screen' },
    { id: '16:9', label: '16:9 (Landscape)' },
    { id: '4:3', label: '4:3 (Standard)' },
    { id: '1:1', label: '1:1 (Square)' },
    { id: '9:16', label: '9:16 (Shorts/Reels)' },
  ];

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

    let targetAspect = 16 / 9;
    if (preset === '4:3') targetAspect = 4 / 3;
    if (preset === '1:1') targetAspect = 1;
    if (preset === '9:16') targetAspect = 9 / 16;

    const sourceAspect = sourceWidth / (sourceHeight || 1);

    let normW = 0.8;
    let normH = 0.8;

    if (targetAspect < sourceAspect) {
      normH = 0.85;
      normW = (normH * targetAspect) / sourceAspect;
    } else {
      normW = 0.85;
      normH = (normW * sourceAspect) / targetAspect;
    }

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

  const handleMouseDown = (e: React.MouseEvent, mode: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDragMode(mode);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: cropRegion.x,
      origY: cropRegion.y,
      origW: cropRegion.width,
      origH: cropRegion.height,
    };
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (!isSelecting || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setDragMode('create');
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: clickX,
      origY: clickY,
      origW: 0.05,
      origH: 0.05,
    };

    onChangeCropRegion({
      enabled: true,
      preset: 'custom',
      x: clickX,
      y: clickY,
      width: 0.05,
      height: 0.05,
    });
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragMode || !dragStartRef.current || !overlayRef.current) return;

      const rect = overlayRef.current.getBoundingClientRect();
      const dxNorm = (e.clientX - dragStartRef.current.startX) / rect.width;
      const dyNorm = (e.clientY - dragStartRef.current.startY) / rect.height;

      const { origX, origY, origW, origH } = dragStartRef.current;

      if (dragMode === 'move') {
        const newX = Math.max(0, Math.min(1 - origW, origX + dxNorm));
        const newY = Math.max(0, Math.min(1 - origH, origY + dyNorm));
        onChangeCropRegion({
          ...cropRegion,
          enabled: true,
          preset: 'custom',
          x: newX,
          y: newY,
        });
      } else if (dragMode === 'create') {
        const curX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const curY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const newX = Math.min(origX, curX);
        const newY = Math.min(origY, curY);
        const newW = Math.max(0.05, Math.abs(curX - origX));
        const newH = Math.max(0.05, Math.abs(curY - origY));

        onChangeCropRegion({
          enabled: true,
          preset: 'custom',
          x: newX,
          y: newY,
          width: Math.min(1 - newX, newW),
          height: Math.min(1 - newY, newH),
        });
      } else {
        // Handle resizing handles
        let newX = origX;
        let newY = origY;
        let newW = origW;
        let newH = origH;

        if (dragMode.includes('r')) {
          newW = Math.max(0.05, Math.min(1 - origX, origW + dxNorm));
        }
        if (dragMode.includes('l')) {
          const maxLeft = origX + origW - 0.05;
          newX = Math.max(0, Math.min(maxLeft, origX + dxNorm));
          newW = origW - (newX - origX);
        }
        if (dragMode.includes('b')) {
          newH = Math.max(0.05, Math.min(1 - origY, origH + dyNorm));
        }
        if (dragMode.includes('t')) {
          const maxTop = origY + origH - 0.05;
          newY = Math.max(0, Math.min(maxTop, origY + dyNorm));
          newH = origH - (newY - origY);
        }

        onChangeCropRegion({
          enabled: true,
          preset: 'custom',
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
      }
    };

    const handleMouseUp = () => {
      setDragMode(null);
      dragStartRef.current = null;
    };

    if (dragMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragMode, cropRegion, onChangeCropRegion]);

  return (
    <>
      {/* Dimmed backdrop mask when crop is active */}
      {cropRegion.enabled && (
        <div
          ref={overlayRef}
          onMouseDown={handleContainerMouseDown}
          className="absolute inset-0 pointer-events-auto select-none overflow-hidden z-20 cursor-crosshair"
          style={{ width: containerWidth, height: containerHeight }}
        >
          {/* Top mask */}
          <div
            className="absolute top-0 left-0 right-0 bg-black/60 pointer-events-none transition-all"
            style={{ height: `${boxTop}px` }}
          />
          {/* Bottom mask */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-black/60 pointer-events-none transition-all"
            style={{ top: `${boxTop + boxHeight}px` }}
          />
          {/* Left mask */}
          <div
            className="absolute left-0 bg-black/60 pointer-events-none transition-all"
            style={{ top: `${boxTop}px`, height: `${boxHeight}px`, width: `${boxLeft}px` }}
          />
          {/* Right mask */}
          <div
            className="absolute right-0 bg-black/60 pointer-events-none transition-all"
            style={{ top: `${boxTop}px`, height: `${boxHeight}px`, left: `${boxLeft + boxWidth}px` }}
          />

          {/* Active Crop Box */}
          <div
            className="absolute border-2 border-sky-400 shadow-2xl shadow-sky-500/20 box-border pointer-events-auto"
            style={{
              left: `${boxLeft}px`,
              top: `${boxTop}px`,
              width: `${boxWidth}px`,
              height: `${boxHeight}px`,
            }}
          >
            {/* Center Move Handle */}
            <div
              onMouseDown={(e) => handleMouseDown(e, 'move')}
              className="absolute inset-0 cursor-move flex items-center justify-center group"
            >
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 px-2.5 py-1 rounded text-[11px] text-white flex items-center gap-1.5 shadow-lg">
                <Move className="w-3.5 h-3.5 text-sky-400" />
                <span>Drag to Move Region</span>
              </div>
            </div>

            {/* Corner Resize Handles */}
            <div
              onMouseDown={(e) => handleMouseDown(e, 'tl')}
              className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-sky-400 border border-white rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'tr')}
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-sky-400 border border-white rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'bl')}
              className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-sky-400 border border-white rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'br')}
              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-sky-400 border border-white rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
            />

            {/* Edge Resize Handles */}
            <div
              onMouseDown={(e) => handleMouseDown(e, 't')}
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-sky-400 border border-white rounded-sm cursor-ns-resize shadow"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'b')}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-sky-400 border border-white rounded-sm cursor-ns-resize shadow"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'l')}
              className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-4 bg-sky-400 border border-white rounded-sm cursor-ew-resize shadow"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'r')}
              className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-2 h-4 bg-sky-400 border border-white rounded-sm cursor-ew-resize shadow"
            />

            {/* Dimension Tag */}
            <div className="absolute -top-7 left-0 px-2 py-0.5 rounded bg-sky-950/95 border border-sky-600/80 text-[10px] font-mono text-sky-200 font-bold whitespace-nowrap shadow-lg flex items-center gap-1.5 pointer-events-none">
              <span>{realPixelWidth} × {realPixelHeight} px</span>
              <span className="text-sky-400/80">({cropRegion.preset})</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Selection Tool Bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 rounded-xl shadow-xl select-none text-xs">
        <div className="flex items-center gap-1.5 pr-2 border-r border-neutral-700/60">
          <Crop className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-semibold text-neutral-200">Selection Tool</span>
        </div>

        {/* Preset Buttons */}
        <div className="flex items-center gap-1">
          {presets.map((p) => {
            const isActive = (p.id === 'full' && !cropRegion.enabled) || (cropRegion.enabled && cropRegion.preset === p.id);
            return (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p.id)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {cropRegion.enabled && (
          <button
            onClick={() => handleApplyPreset('full')}
            className="ml-1 p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Reset to Full Screen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </>
  );
};
