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
      close: () => void;
      setAlwaysOnTop: (pinned: boolean) => void;
      setContentProtection?: (enabled: boolean) => void;
      setLayout?: (layout: { width: number; height: number; expanded: boolean; anchor: 'top' | 'bottom' }) => void;
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
      selectAreaOnScreen?: () => Promise<{
        region: { x: number; y: number; width: number; height: number };
        sourceId: string;
        sourceName: string;
        changedSource: boolean;
      } | null>;
      onAutoZoomTrigger?: (callback: (coords: { normX: number; normY: number; approximate?: boolean }) => void) => () => void;
    };
  }
}
