import React from 'react';
import type { AudioLevels } from './audioMixer';

// Live mic / system loudness lives OUTSIDE React state on purpose.
// Storing it in App's state re-rendered the entire app ten times a second (a new object every tick, even
// when idle). Here only the tiny meter components that read a level re-render, and only when it visibly changes.
let levels: AudioLevels = { micLevel: 0, systemLevel: 0 };
const listeners = new Set<() => void>();

// 2% steps: invisible on a meter, but it removes thousands of pointless updates
const quantize = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 50) / 50;

export function publishAudioLevels(next: AudioLevels): void {
  const micLevel = quantize(next.micLevel);
  const systemLevel = quantize(next.systemLevel);
  if (micLevel === levels.micLevel && systemLevel === levels.systemLevel) return;
  levels = { micLevel, systemLevel };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useAudioLevel(kind: keyof AudioLevels): number {
  return React.useSyncExternalStore(subscribe, () => levels[kind]);
}
