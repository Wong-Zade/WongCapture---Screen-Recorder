import React from 'react';
import { useAudioLevel } from '../utils/audioLevelStore';

type Kind = 'micLevel' | 'systemLevel';

/** Bar whose width follows a live audio level. Only this tiny component re-renders as the level moves. */
export const LevelFill: React.FC<{ kind: Kind; className?: string; colorize?: boolean }> = React.memo(
  ({ kind, className = 'h-full bg-emerald-400 transition-all duration-75', colorize = false }) => {
    const level = useAudioLevel(kind);
    const style: React.CSSProperties = { width: `${Math.round(level * 100)}%` };
    if (colorize) style.backgroundColor = level > 0.85 ? '#ef4444' : level > 0.6 ? '#f59e0b' : '#10b981';
    return <div className={className} style={style} />;
  }
);

export const LevelPercent: React.FC<{ kind: Kind; className?: string }> = React.memo(({ kind, className }) => {
  const level = useAudioLevel(kind);
  return <span className={className}>{Math.round(level * 100)}%</span>;
});

/** Thin underline under the mic button in the mini bar. */
export const MicUnderline: React.FC = React.memo(() => {
  const level = useAudioLevel('micLevel');
  return (
    <span
      className="absolute bottom-1 left-2 right-2 h-0.5 bg-emerald-400 rounded-full transition-all"
      style={{ transform: `scaleX(${Math.max(0.1, level)})` }}
    />
  );
});

/** Small dot whose brightness follows the mic level. */
export const MicPulseDot: React.FC = React.memo(() => {
  const level = useAudioLevel('micLevel');
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
      style={{ opacity: Math.max(0.3, level * 2) }}
    />
  );
});
