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
      setContentProtection?: (enabled: boolean) => void;
      onMaximizedChange?: (callback: (isMaximized: boolean) => void) => () => void;
    };
    wongCapture?: {
      getSources: () => Promise<Array<{
        id: string;
        name: string;
        thumbnail: string;
        appIcon: string | null;
        isScreen: boolean;
        display_id?: string;
      }>>;
      setPreferredSource: (sourceId: string | null, displayId?: string) => Promise<boolean>;
      onAutoZoomTrigger?: (callback: (coords: { normX: number; normY: number; approximate?: boolean }) => void) => () => void;
    };
  }
}
