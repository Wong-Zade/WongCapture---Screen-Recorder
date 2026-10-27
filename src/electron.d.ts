export type TrayCommand = 'start' | 'stop' | 'toggle-pause';

declare global {
  interface Window {
    /** Provided by electron/preload.cjs. Undefined when running in a normal browser (e.g. `npm run dev`). */
    wongTray?: {
      sendState: (status: string, elapsedSeconds: number) => void;
      onCommand: (callback: (command: TrayCommand) => void) => () => void;
    };
    wongWindow?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      setAlwaysOnTop: (pinned: boolean) => void;
      onMaximizedChange?: (callback: (isMaximized: boolean) => void) => () => void;
    };
  }
}
