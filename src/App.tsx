import React from 'react';
import { 
  Monitor, 
  AppWindow, 
  Crop 
} from 'lucide-react';
import { 
  RecordingSettings, 
  AudioConfig, 
  WebcamConfig, 
  RecordedClip, 
  RecordingStatus,
  AutoZoomConfig,
  CropRegion,
  DesktopCaptureSource
} from './types';
import { WindowsTitleBar } from './components/WindowsTitleBar';
import { MiniBar } from './components/MiniBar';
import { AudioMixer } from './utils/audioMixer';
import { publishAudioLevels } from './utils/audioLevelStore';
import { MicPulseDot } from './components/LevelMeters';
import { VideoCompositor } from './utils/compositor';
import { createRecorder, generateThumbnail, getSupportedFormats } from './utils/mp4Converter';
import { 
  saveClipToDB, 
  getAllClipsFromDB, 
  deleteClipFromDB, 
  updateClipTitleInDB,
  requestPersistentStorage
} from './utils/storage';

// Loaded on demand: the first screen only needs the title bar and the mini bar, everything below is fetched
// the first time it is opened. This keeps start-up fast and memory low.
function lazyNamed<K extends string, C extends React.ComponentType<any>>(load: () => Promise<Record<K, C>>, name: K) {
  return React.lazy(() => load().then((m) => ({ default: m[name] })));
}

const StudioPreview = lazyNamed(() => import('./components/StudioPreview'), 'StudioPreview');
const SelectionToolOverlay = lazyNamed(() => import('./components/SelectionToolOverlay'), 'SelectionToolOverlay');
const AudioMixerPanel = lazyNamed(() => import('./components/AudioMixerPanel'), 'AudioMixerPanel');
const WebcamSettingsModal = lazyNamed(() => import('./components/WebcamSettingsModal'), 'WebcamSettingsModal');
const ClipPlayerModal = lazyNamed(() => import('./components/ClipPlayerModal'), 'ClipPlayerModal');
const ClipLibrary = lazyNamed(() => import('./components/ClipLibrary'), 'ClipLibrary');
const SettingsModal = lazyNamed(() => import('./components/SettingsModal'), 'SettingsModal');
const SourcePickerModal = lazyNamed(() => import('./components/SourcePickerModal'), 'SourcePickerModal');

const DEFAULT_SETTINGS: RecordingSettings = {
  resolution: '1080p',
  frameRate: 30, // 60 fps doubles the encoding work; it is one click away in Settings
  format: 'mp4',
  countdown: 3,
  bitrateKbps: 8000,
  filenamePrefix: 'WongCapture',
  preventMirrorLoop: true,
  autoMinimizeOnRecord: false,
  autoSwitchToMiniBar: false,
};

const DEFAULT_AUDIO: AudioConfig = {
  systemAudio: true,
  microphone: true,
  micDeviceId: '',
  micVolume: 1.0,
  systemVolume: 1.0,
  noiseSuppression: true,
  echoCancellation: true,
};

const DEFAULT_WEBCAM: WebcamConfig = {
  enabled: false,
  deviceId: '',
  position: 'bottom-right',
  shape: 'circle',
  size: 'medium',
  mirrored: true,
};

const DEFAULT_AUTO_ZOOM: AutoZoomConfig = {
  enabled: false,
  factor: 1.8,
  durationSeconds: 2.5,
  showClickRipple: true,
};

const DEFAULT_CROP: CropRegion = {
  enabled: false,
  preset: 'full',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export default function App() {
  // Settings & Configuration
  const [settings, setSettings] = React.useState<RecordingSettings>(() => {
    try {
      const saved = localStorage.getItem('wongcapture_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [audioConfig, setAudioConfig] = React.useState<AudioConfig>(() => {
    try {
      const saved = localStorage.getItem('wongcapture_audio');
      return saved ? { ...DEFAULT_AUDIO, ...JSON.parse(saved) } : DEFAULT_AUDIO;
    } catch {
      return DEFAULT_AUDIO;
    }
  });

  const [webcamConfig, setWebcamConfig] = React.useState<WebcamConfig>(() => {
    try {
      const saved = localStorage.getItem('wongcapture_webcam');
      return saved ? { ...DEFAULT_WEBCAM, ...JSON.parse(saved) } : DEFAULT_WEBCAM;
    } catch {
      return DEFAULT_WEBCAM;
    }
  });

  const [autoZoomConfig, setAutoZoomConfig] = React.useState<AutoZoomConfig>(() => {
    try {
      const saved = localStorage.getItem('wongcapture_autozoom');
      return saved ? { ...DEFAULT_AUTO_ZOOM, ...JSON.parse(saved) } : DEFAULT_AUTO_ZOOM;
    } catch {
      return DEFAULT_AUTO_ZOOM;
    }
  });

  const [cropRegion, setCropRegion] = React.useState<CropRegion>(() => {
    try {
      const saved = localStorage.getItem('wongcapture_crop');
      return saved ? { ...DEFAULT_CROP, ...JSON.parse(saved) } : DEFAULT_CROP;
    } catch {
      return DEFAULT_CROP;
    }
  });

  const [isSelectingArea, setIsSelectingArea] = React.useState(false);
  const [isZoomed, setIsZoomed] = React.useState(false);

  // UI Modes & Modals
  const [isCompact, setIsCompact] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wongcapture_compact_mode');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  // User-initiated switches are remembered; the automatic switch when recording starts is not
  const changeCompactMode = (next: boolean) => {
    setIsCompact(next);
    try {
      localStorage.setItem('wongcapture_compact_mode', JSON.stringify(next));
    } catch {
      /* storage unavailable: just don't remember */
    }
  };
  const [sourcePickerTab, setSourcePickerTab] = React.useState<'windows' | 'screens' | 'area'>('screens');
  const [isPinned, setIsPinned] = React.useState(false);
  const [isMixerOpen, setIsMixerOpen] = React.useState(false);
  const [isWebcamModalOpen, setIsWebcamModalOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);
  const [isSourcePickerOpen, setIsSourcePickerOpen] = React.useState(false);
  const [sourceSize, setSourceSize] = React.useState({ width: 1920, height: 1080 });
  // "Frame an area" was chosen before any screen was connected: pick a source first, then start framing
  const [awaitingAreaFraming, setAwaitingAreaFraming] = React.useState(false);
  const awaitingAreaRef = React.useRef(false);
  const setAwaitingArea = (value: boolean) => {
    awaitingAreaRef.current = value;
    setAwaitingAreaFraming(value);
  };
  const [selectedClip, setSelectedClip] = React.useState<RecordedClip | null>(null);

  // Streams & Engine
  const [screenStream, setScreenStream] = React.useState<MediaStream | null>(null);
  const [selectedSourceName, setSelectedSourceName] = React.useState<string>('');
  const [isWindowSource, setIsWindowSource] = React.useState<boolean>(false);
  const [webcamStream, setWebcamStream] = React.useState<MediaStream | null>(null);
  const [micStream, setMicStream] = React.useState<MediaStream | null>(null);

  // Recording State
  const [status, setStatus] = React.useState<RecordingStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [countdownNumber, setCountdownNumber] = React.useState(3);

  // Clip Storage
  const [clips, setClips] = React.useState<RecordedClip[]>([]);

  // Engine Refs
  const audioMixerRef = React.useRef<AudioMixer>(new AudioMixer());
  const compositorRef = React.useRef<VideoCompositor>(new VideoCompositor());
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const timerIntervalRef = React.useRef<number | null>(null);
  const countdownIntervalRef = React.useRef<number | null>(null);

  // Refs mirror live state so long-lived callbacks (onended, recorder.onstop, timers) never read stale values
  const statusRef = React.useRef<RecordingStatus>('idle');
  const screenStreamRef = React.useRef<MediaStream | null>(null);
  const recordingStartRef = React.useRef(0);
  const pausedAccumMsRef = React.useRef(0);
  const pauseStartRef = React.useRef<number | null>(null);
  const handleStopScreenRef = React.useRef<() => void>(() => {});
  const cropRegionRef = React.useRef<CropRegion>(cropRegion);
  cropRegionRef.current = cropRegion;
  const isCompactRef = React.useRef(isCompact);
  isCompactRef.current = isCompact;
  statusRef.current = status;
  screenStreamRef.current = screenStream;

  // Recorded time in ms, excluding paused time (frozen while paused)
  const getElapsedMs = () => {
    if (!recordingStartRef.current) return 0;
    const now = pauseStartRef.current ?? Date.now();
    return Math.max(0, now - recordingStartRef.current - pausedAccumMsRef.current);
  };

  // Sync settings to localStorage
  React.useEffect(() => {
    localStorage.setItem('wongcapture_settings', JSON.stringify(settings));
  }, [settings]);

  React.useEffect(() => {
    localStorage.setItem('wongcapture_audio', JSON.stringify(audioConfig));
  }, [audioConfig]);

  React.useEffect(() => {
    localStorage.setItem('wongcapture_webcam', JSON.stringify(webcamConfig));
    compositorRef.current.updateWebcamConfig(webcamConfig);
  }, [webcamConfig]);

  React.useEffect(() => {
    localStorage.setItem('wongcapture_autozoom', JSON.stringify(autoZoomConfig));
    compositorRef.current.updateAutoZoomConfig(autoZoomConfig);
  }, [autoZoomConfig]);

  React.useEffect(() => {
    localStorage.setItem('wongcapture_crop', JSON.stringify(cropRegion));
    compositorRef.current.updateCropRegion(cropRegion);
  }, [cropRegion]);

  // Load clips from IndexedDB on startup
  React.useEffect(() => {
    requestPersistentStorage();
    getAllClipsFromDB().then(setClips).catch(console.warn);
  }, []);

  // Capture at a trickle while nothing is recording and no live preview is showing (compact mode has none)
  React.useEffect(() => {
    if (!screenStream) return;
    const previewVisible = !isCompact;
    const fps = status === 'idle' ? (previewVisible ? Math.min(30, settings.frameRate) : 5) : settings.frameRate;
    applyCaptureFps(screenStream, fps);
  }, [screenStream, status, isCompact, settings.frameRate]);

  // "Hide WongCapture from recordings" follows the Settings toggle (on by default)
  React.useEffect(() => {
    window.wongWindow?.setContentProtection?.(settings.preventMirrorLoop !== false);
  }, [settings.preventMirrorLoop]);

  // Release everything on unmount (camera/mic/screen indicators, timers, compositor loop)
  React.useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      compositorRef.current.stop();
      [timerIntervalRef, countdownIntervalRef].forEach((r) => {
        if (r.current !== null) clearInterval(r.current);
      });
    };
  }, []);

  // Audio meters. Levels go to a tiny external store (see audioLevelStore) instead of React state, and the
  // timer only runs while there is actually an audio source to measure.
  const hasAudioSource = micStream !== null || (screenStream?.getAudioTracks().length ?? 0) > 0;
  React.useEffect(() => {
    if (!hasAudioSource) {
      publishAudioLevels({ micLevel: 0, systemLevel: 0 });
      return;
    }
    const id = window.setInterval(() => publishAudioLevels(audioMixerRef.current.getLevels()), 100);
    return () => clearInterval(id);
  }, [hasAudioSource]);

  // The zoom indicator only matters while recording (the compositor only runs then)
  React.useEffect(() => {
    if (status !== 'recording' && status !== 'paused') return;
    const id = window.setInterval(() => setIsZoomed(compositorRef.current.getZoomState().isZoomed), 250);
    return () => clearInterval(id);
  }, [status]);

  // Webcam stream management (cleanup stops the camera when the device changes, it is disabled, or on unmount)
  React.useEffect(() => {
    if (!webcamConfig.enabled) {
      setWebcamStream(null);
      return;
    }

    let cancelled = false;
    let acquired: MediaStream | null = null;

    const constraints: MediaStreamConstraints = {
      video: {
        deviceId: webcamConfig.deviceId ? { exact: webcamConfig.deviceId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    navigator.mediaDevices?.getUserMedia(constraints)
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        acquired = stream;
        setWebcamStream(stream);
      })
      .catch((err) => {
        console.warn('Failed to get webcam stream:', err);
        if (!cancelled) setWebcamConfig((prev) => ({ ...prev, enabled: false }));
      });

    return () => {
      cancelled = true;
      const old = acquired;
      old?.getTracks().forEach((t) => t.stop());
      setWebcamStream((prev) => (prev === old ? null : prev));
    };
  }, [webcamConfig.enabled, webcamConfig.deviceId]);

  // Mic stream management (cleanup stops the previous stream when the device/processing options change)
  React.useEffect(() => {
    if (!audioConfig.microphone) {
      setMicStream(null);
      audioMixerRef.current.setMicStream(null);
      return;
    }

    let cancelled = false;
    let acquired: MediaStream | null = null;

    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: audioConfig.micDeviceId ? { exact: audioConfig.micDeviceId } : undefined,
        echoCancellation: audioConfig.echoCancellation,
        noiseSuppression: audioConfig.noiseSuppression,
      },
      video: false,
    };

    navigator.mediaDevices?.getUserMedia(constraints)
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        acquired = stream;
        setMicStream(stream);
        audioMixerRef.current.setMicStream(stream, audioConfig.micVolume);
      })
      .catch((err) => {
        console.warn('Failed to get microphone stream:', err);
        if (!cancelled) setAudioConfig((prev) => ({ ...prev, microphone: false }));
      });

    return () => {
      cancelled = true;
      const old = acquired;
      if (old) {
        audioMixerRef.current.setMicStream(null);
        old.getTracks().forEach((t) => t.stop());
      }
      setMicStream((prev) => (prev === old ? null : prev));
    };
  }, [audioConfig.microphone, audioConfig.micDeviceId, audioConfig.echoCancellation, audioConfig.noiseSuppression]);

  // Update mixer volume adjustments
  React.useEffect(() => {
    audioMixerRef.current.setMicVolume(audioConfig.micVolume);
  }, [audioConfig.micVolume]);

  React.useEffect(() => {
    audioMixerRef.current.setSystemVolume(audioConfig.systemVolume);
  }, [audioConfig.systemVolume]);

  // Lowers/raises how often the screen is captured. Capturing is the single most expensive thing the app does,
  // so it only runs at full rate while recording (or while a live preview is on screen).
  const applyCaptureFps = async (stream: MediaStream | null, fps: number) => {
    const track = stream?.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') return;
    try {
      await track.applyConstraints({ frameRate: { ideal: fps, max: fps } });
    } catch {
      /* some sources cannot change their frame rate: keep whatever they give us */
    }
  };

  // Screen / Window selection
  const handleRequestScreen = async (tab?: 'windows' | 'screens' | 'area') => {
    // Never swap the source underneath a countdown / recording / save
    if (statusRef.current !== 'idle') return;
    // (a click handler can pass its event in here: only accept a real tab name)
    setSourcePickerTab(tab === 'windows' || tab === 'area' ? tab : 'screens');
    // In the desktop app, open our own picker (screens + windows with thumbnails)
    if (typeof window !== 'undefined' && window.wongCapture?.getSources) {
      setIsSourcePickerOpen(true);
      return;
    }
    // Otherwise the browser shows its native picker
    await acquireScreenStream();
  };

  const handleSelectDisplay = async () => {
    setCropRegion((prev) => ({ ...prev, enabled: false, preset: 'full' }));
    compositorRef.current.updateCropRegion({ enabled: false, preset: 'full', x: 0, y: 0, width: 1, height: 1 });
    await handleRequestScreen('screens');
  };

  const handleSelectWindow = async () => {
    await handleRequestScreen('windows');
  };

  // Start framing a recording area. That needs a connected source to frame against, so if there is none yet
  // ask for one first; framing starts as soon as the source is connected.
  const beginAreaSelection = async () => {
    if (screenStreamRef.current) {
      setIsSelectingArea(true);
      return;
    }
    setAwaitingArea(true);
    await handleRequestScreen('screens');
  };
  const handleSelectArea = beginAreaSelection;

  const acquireScreenStream = async (hint?: { name: string; isWindow: boolean }): Promise<MediaStream | null> => {
    try {
      const widthVal = settings.resolution === '4k' ? 3840 : settings.resolution === '1080p' ? 1920 : settings.resolution === '720p' ? 1280 : undefined;
      const heightVal = settings.resolution === '4k' ? 2160 : settings.resolution === '1080p' ? 1080 : settings.resolution === '720p' ? 720 : undefined;

      const constraints: DisplayMediaStreamOptions = {
        video: {
          frameRate: { ideal: settings.frameRate, max: 60 },
          ...(widthVal ? { width: { ideal: widthVal } } : {}),
          ...(heightVal ? { height: { ideal: heightVal } } : {}),
        },
        audio: audioConfig.systemAudio,
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      // Replacing a connected source: release the old capture instead of leaving it running in the background
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      setScreenStream(stream);

      const track = stream.getVideoTracks()[0];
      if (track) {
        const label = track.label || '';
        const isWindow = hint
          ? hint.isWindow
          : label.toLowerCase().includes('window') || (!label.toLowerCase().includes('screen') && label.length > 0);
        setSelectedSourceName(hint?.name || label || (isWindow ? 'Application Window' : 'Entire Display'));
        setIsWindowSource(isWindow);

        // Real size of what is captured (needed to frame areas with the right proportions)
        const { width, height } = track.getSettings();
        if (width && height) setSourceSize({ width, height });

        // Handle the user ending the share from the OS
        track.onended = () => {
          handleStopScreenRef.current();
        };
      }

      // Connect system audio if present
      if (stream.getAudioTracks().length > 0) {
        audioMixerRef.current.setSystemStream(stream, audioConfig.systemVolume);
      }

      // "Frame an area" was waiting for a source: start framing now
      if (awaitingAreaRef.current) {
        setAwaitingArea(false);
        setIsSelectingArea(true);
      }
      return stream;
    } catch (err) {
      console.warn('Screen selection cancelled or failed:', err);
      setAwaitingArea(false);
      return null;
    }
  };

  const handleSelectDesktopSource = async (source: DesktopCaptureSource) => {
    setIsSourcePickerOpen(false);
    try {
      if (typeof window !== 'undefined' && window.wongCapture?.setPreferredSource) {
        const accepted = await window.wongCapture.setPreferredSource(source.id, source.display_id);
        if (!accepted) {
          console.warn('That capture source is no longer available');
          setAwaitingArea(false);
          return;
        }
      }
      await acquireScreenStream({ name: source.name, isWindow: !source.isScreen });
    } catch (err) {
      console.error('Failed to select desktop source:', err);
      setAwaitingArea(false);
    }
  };

  const handleStopScreen = () => {
    const currentStatus = statusRef.current;
    if (currentStatus === 'recording' || currentStatus === 'paused' || currentStatus === 'countdown') {
      handleStopRecording();
    }
    const currentStream = screenStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
    audioMixerRef.current.setSystemStream(null);
    compositorRef.current.stop();
  };
  // Always point at the latest version so the track's onended handler never sees stale state
  handleStopScreenRef.current = handleStopScreen;

  // Recording Execution
  const executeStartRecording = async (activeScreenStream: MediaStream) => {
    try {
      // Automatic window adjustments on recording start
      if (settings.autoMinimizeOnRecord && typeof window !== 'undefined' && window.wongWindow) {
        window.wongWindow.minimize();
      } else if (settings.autoSwitchToMiniBar) {
        setIsCompact(true);
      }

      recordedChunksRef.current = [];

      // Composite screen + webcam + crop + autozoom
      const compositeVideoStream = compositorRef.current.setup(
        activeScreenStream,
        webcamStream,
        webcamConfig,
        cropRegion,
        autoZoomConfig,
        settings.frameRate
      );

      // Create destination media stream
      const finalStream = new MediaStream();

      // Add video track
      const videoTrack = compositeVideoStream.getVideoTracks()[0];
      if (videoTrack) {
        finalStream.addTrack(videoTrack);
      }

      // Add mixed audio track
      const audioTrack = audioMixerRef.current.getMixedAudioTrack();
      if (audioTrack) {
        finalStream.addTrack(audioTrack);
      }

      // Create recorder
      const { recorder, actualFormat } = createRecorder(
        finalStream,
        settings.format,
        settings.bitrateKbps
      );

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Measure before anything else: real recorded time, excluding paused time
        const durationSeconds = Math.max(1, Math.round(getElapsedMs() / 1000));
        recordingStartRef.current = 0;
        pausedAccumMsRef.current = 0;
        pauseStartRef.current = null;

        setStatus('processing');
        if (timerIntervalRef.current !== null) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        try {
          const mime = recorder.mimeType || (actualFormat === 'mp4' ? 'video/mp4' : 'video/webm');
          const recordedBlob = new Blob(recordedChunksRef.current, { type: mime });

          // Calculate metadata
          const now = new Date();
          const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
          const prefix = settings.filenamePrefix || 'WongCapture';
          const title = `${prefix}_${timestampStr}.${actualFormat}`;

          const videoSettings = videoTrack?.getSettings();
          const width = videoSettings?.width || (cropRegion.enabled ? Math.round(1920 * cropRegion.width) : 1920);
          const height = videoSettings?.height || (cropRegion.enabled ? Math.round(1080 * cropRegion.height) : 1080);

          let thumbnailUrl = '';
          try {
            thumbnailUrl = await generateThumbnail(recordedBlob);
          } catch (err) {
            console.warn('Thumbnail generation failed:', err);
          }

          const newClip: RecordedClip = {
            id: `clip_${Date.now()}`,
            title,
            timestamp: Date.now(),
            duration: durationSeconds,
            blob: recordedBlob,
            url: URL.createObjectURL(recordedBlob),
            thumbnailUrl,
            format: actualFormat,
            sizeBytes: recordedBlob.size,
            width,
            height,
            fps: settings.frameRate,
          };

          const saved = await saveClipToDB(newClip);
          setClips((prev) => [newClip, ...prev]);
          setSelectedClip(newClip);
          if (!saved) {
            window.alert(
              'The recording finished, but it could not be saved to your clip library (storage may be full or blocked).\n\n' +
              'It is open in the player now — use the download button to keep a copy before closing it.'
            );
          }
        } catch (err) {
          console.error('Failed to finalize recording:', err);
          window.alert('Something went wrong while finishing the recording.');
        } finally {
          setStatus('idle');
          setElapsedSeconds(0);
        }
      };

      recorder.start(1000); // 1-second chunks
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      pausedAccumMsRef.current = 0;
      pauseStartRef.current = null;
      setStatus('recording');
      setElapsedSeconds(0);

      // Derive elapsed time from the clock (frozen while paused) instead of counting ticks
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds(Math.floor(getElapsedMs() / 1000));
      }, 250);
    } catch (err) {
      console.error('Failed to start recorder:', err);
      setStatus('idle');
    }
  };

  const handleStartRecording = async () => {
    // Ignore re-entry (double click, F9 mashing) while a countdown/recording/save is already in progress
    if (statusRef.current !== 'idle') return;
    let activeStream = screenStream;
    if (!activeStream) {
      activeStream = await acquireScreenStream();
      if (!activeStream) return; // cancelled
    }

    // The capture may be idling at a trickle: bring it back to full speed before the countdown starts
    await applyCaptureFps(activeStream, settings.frameRate);

    if (!activeStream) return;

    if (settings.countdown > 0) {
      setStatus('countdown');
      setCountdownNumber(settings.countdown);
      let remaining = settings.countdown;

      countdownIntervalRef.current = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownIntervalRef.current !== null) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          executeStartRecording(activeStream!);
        } else {
          setCountdownNumber(remaining);
        }
      }, 1000);
    } else {
      executeStartRecording(activeStream);
    }
  };

  const handleStopRecording = () => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (statusRef.current === 'countdown') {
      // Cancelled before recording began: nothing to save, go back to idle
      setStatus('idle');
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleTogglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (statusRef.current === 'recording') {
      mediaRecorderRef.current.pause();
      pauseStartRef.current = Date.now(); // freezes getElapsedMs()
      setStatus('paused');
    } else if (statusRef.current === 'paused') {
      mediaRecorderRef.current.resume();
      if (pauseStartRef.current !== null) {
        pausedAccumMsRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
      setStatus('recording');
    }
  };

  // Instant Snapshot
  const handleTakeSnapshot = () => {
    if (!screenStream) return;
    const snap = compositorRef.current.takeSnapshot(screenStream, webcamStream, webcamConfig);
    if (snap) {
      const a = document.createElement('a');
      a.href = snap;
      a.download = `WongCapture_Snapshot_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Auto Zoom handlers
  const handleTriggerClickZoom = (normX: number, normY: number, options?: { ripple?: boolean }) => {
    compositorRef.current.triggerClickZoom(normX, normY, options);
    setIsZoomed(compositorRef.current.getZoomState().isZoomed);
  };

  const handleResetZoom = () => {
    compositorRef.current.resetZoom();
    setIsZoomed(false);
  };

  // Clip library actions
  const handleDeleteClip = async (id: string) => {
    await deleteClipFromDB(id);
    const removed = clips.find((c) => c.id === id);
    if (removed?.url) URL.revokeObjectURL(removed.url);
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (selectedClip?.id === id) {
      setSelectedClip(null);
    }
  };

  const handleClearAllClips = async () => {
    for (const c of clips) {
      await deleteClipFromDB(c.id);
      if (c.url) URL.revokeObjectURL(c.url);
    }
    setClips([]);
    setSelectedClip(null);
  };

  const handleUpdateClipTitle = async (id: string, newTitle: string) => {
    await updateClipTitleInDB(id, newTitle);
    setClips((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
    if (selectedClip?.id === id) {
      setSelectedClip((prev) => (prev ? { ...prev, title: newTitle } : null));
    }
  };

  // System tray: keep the tray icon/tooltip in sync, and run its menu actions.
  // Actions go through a ref that always points at the latest handlers, so the single subscription never goes stale.
  const trayActionsRef = React.useRef({
    start: () => {},
    stop: () => {},
    togglePause: () => {},
  });
  trayActionsRef.current = {
    start: handleStartRecording,
    stop: handleStopRecording,
    togglePause: handleTogglePause,
  };

  React.useEffect(() => {
    return window.wongTray?.onCommand((command) => {
      if (command === 'start') trayActionsRef.current.start();
      else if (command === 'stop') trayActionsRef.current.stop();
      else if (command === 'toggle-pause') trayActionsRef.current.togglePause();
    });
  }, []);

  React.useEffect(() => {
    window.wongTray?.sendState(status, elapsedSeconds);
  }, [status, elapsedSeconds]);

  // Listen for global tutorial click/hotkey zoom triggers from Electron
  React.useEffect(() => {
    return window.wongCapture?.onAutoZoomTrigger?.(({ normX, normY, approximate }) => {
      // normX/normY are positions on the recorded display. The zoom works inside the recorded AREA, so when an
      // area is cropped, convert to area coordinates (and ignore the key if the cursor is outside it).
      const crop = cropRegionRef.current;
      let x = normX;
      let y = normY;
      if (!approximate && crop.enabled) {
        x = (normX - crop.x) / crop.width;
        y = (normY - crop.y) / crop.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) return;
      }
      handleTriggerClickZoom(x, y, { ripple: !approximate });
    });
  }, []);

  // Keyboard Shortcuts Listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes modals or exits selection
      if (e.key === 'Escape') {
        if (isSelectingArea) {
          setIsSelectingArea(false);
          return;
        }
        setIsSourcePickerOpen(false);
        setAwaitingArea(false);
        setIsMixerOpen(false);
        setIsWebcamModalOpen(false);
        setIsSettingsOpen(false);
        setIsLibraryOpen(false);
        setSelectedClip(null);
        return;
      }

      // F10 or Alt+Z triggers tutorial zoom
      if (e.key === 'F10' || (e.altKey && (e.key === 'z' || e.key === 'Z'))) {
        e.preventDefault();
        handleTriggerClickZoom(0.5, 0.5);
        return;
      }

      // Alt+M toggles mini bar
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        changeCompactMode(!isCompactRef.current);
        return;
      }

      // Ctrl+Shift+S instant snapshot
      if (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleTakeSnapshot();
        return;
      }

      // Ctrl+Shift+P pause/resume
      if (e.ctrlKey && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handleTogglePause();
        return;
      }

      // F9 start/stop
      if (e.key === 'F9') {
        e.preventDefault();
        if (status === 'recording' || status === 'paused' || status === 'countdown') {
          handleStopRecording(); // during the countdown this cancels it
        } else {
          handleStartRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, screenStream, webcamStream, webcamConfig, isSelectingArea]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Windows 11 Title Bar */}
      <WindowsTitleBar
        status={status}
        isCompact={isCompact}
        isPinned={isPinned}
        onToggleCompact={() => changeCompactMode(!isCompact)}
        onTogglePin={() => setIsPinned(!isPinned)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        clipCount={clips.length}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {isCompact ? (
          <div className="flex-1 relative flex flex-col items-center justify-between p-6 overflow-hidden bg-gradient-to-b from-neutral-950 via-neutral-900/90 to-neutral-950 select-none">
            {/* Ambient Background Lighting */}
            {/* soft ambient glows: plain gradients (a 120px blur filter is re-painted by the GPU every frame) */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[34rem] h-[34rem] rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(2,132,199,0.08), transparent)' }} />
            <div className="absolute bottom-1/4 right-1/3 w-[28rem] h-[28rem] rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(225,29,72,0.07), transparent)' }} />

            {/* Top Area: Centered Floating MiniBar */}
            <div className="z-30 mt-4 max-w-full">
              <MiniBar
                status={status}
                elapsedSeconds={elapsedSeconds}
                countdownNumber={countdownNumber}
                audioConfig={audioConfig}
                onUpdateAudioConfig={(updates) => setAudioConfig((prev) => ({ ...prev, ...updates }))}
                webcamConfig={webcamConfig}
                onUpdateWebcamConfig={(updates) => setWebcamConfig((prev) => ({ ...prev, ...updates }))}
                autoZoomConfig={autoZoomConfig}
                onUpdateAutoZoomConfig={(updates) => {
                  const next = { ...autoZoomConfig, ...updates };
                  setAutoZoomConfig(next);
                  compositorRef.current.updateAutoZoomConfig(next);
                }}
                cropRegion={cropRegion}
                onChangeCropRegion={(newCrop) => {
                  setCropRegion(newCrop);
                  compositorRef.current.updateCropRegion(newCrop);
                }}
                isSelectingArea={isSelectingArea}
                onStartAreaSelection={beginAreaSelection}
                selectedSourceName={selectedSourceName}
                isWindowSource={isWindowSource}
                hasActiveScreen={screenStream !== null}
                screenStream={screenStream}
                settings={settings}
                onUpdateSettings={(updates) => setSettings((prev) => ({ ...prev, ...updates }))}
                sourceSize={sourceSize}
                clipsCount={clips.length}
                onOpenClips={() => setIsLibraryOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenMixer={() => setIsMixerOpen(true)}
                onOpenWebcamSettings={() => setIsWebcamModalOpen(true)}
                onSelectDisplay={handleSelectDisplay}
                onSelectWindow={handleSelectWindow}
                onSelectArea={handleSelectArea}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                onTogglePause={handleTogglePause}
                onTakeSnapshot={handleTakeSnapshot}
                onExpandStudio={() => changeCompactMode(false)}
                onStopScreen={handleStopScreen}
              />
            </div>

            {/* Center Area: Status Card / Safe Monitor or Quick Start Guidance */}
            <div className="z-20 my-auto flex flex-col items-center max-w-lg w-full text-center">
              {screenStream ? (
                /* Source Connected: Active Status & Safe Monitor */
                <div className="w-full bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-2xl text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <div>
                        <div className="text-xs font-bold text-white tracking-wide truncate max-w-[260px]">
                          {selectedSourceName || 'Active Capture Source'}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          {isWindowSource ? 'Application Window' : 'Display Monitor'} • {settings.resolution.toUpperCase()} @ {settings.frameRate}fps
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleStopScreen}
                      className="px-2 py-1 text-[11px] text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                      title="Disconnect Screen"
                    >
                      Change
                    </button>
                  </div>

                  {/* Feed Specs & Toggles Summary */}
                  <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                    <div className="bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80 flex items-center justify-between">
                      <span className="text-neutral-400">Area Region</span>
                      <span className="font-mono font-semibold text-neutral-200">
                        {cropRegion.enabled ? `${cropRegion.preset.toUpperCase()} Crop` : 'Full Screen'}
                      </span>
                    </div>

                    <div className="bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80 flex items-center justify-between">
                      <span className="text-neutral-400">Auto-Zoom</span>
                      <span className="font-mono font-semibold text-indigo-300">
                        {autoZoomConfig.enabled ? `${autoZoomConfig.factor}x on Clicks` : 'Disabled'}
                      </span>
                    </div>

                    <div className="bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80 flex items-center justify-between">
                      <span className="text-neutral-400">Microphone</span>
                      <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        {audioConfig.microphone ? 'Connected' : 'Muted'}
                        {audioConfig.microphone && (
                          <MicPulseDot />
                        )}
                      </span>
                    </div>

                    <div className="bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80 flex items-center justify-between">
                      <span className="text-neutral-400">Webcam PIP</span>
                      <span className="font-semibold text-sky-400">
                        {webcamConfig.enabled ? `${webcamConfig.shape} (${webcamConfig.position})` : 'Off'}
                      </span>
                    </div>
                  </div>

                  {/* Action Banner */}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-[11px] text-neutral-400">
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 font-mono text-[10px]">F9</kbd>
                      <span>to Start/Stop</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 font-mono text-[10px]">F10</kbd>
                      <span>to Zoom Cursor</span>
                    </span>
                    <button
                      onClick={() => changeCompactMode(false)}
                      className="text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                    >
                      Open Studio Preview →
                    </button>
                  </div>
                </div>
              ) : (
                /* No Source Connected: Quick Start Guide */
                <div className="w-full bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-6 shadow-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center mx-auto mb-3 text-sky-400 shadow-inner">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Select a Source to Begin</h3>
                  <p className="text-xs text-neutral-400 mb-5 leading-relaxed max-w-sm mx-auto">
                    Choose <span className="text-sky-400 font-semibold">Display</span> for full monitors, <span className="text-sky-400 font-semibold">Window</span> for individual apps, or <span className="text-amber-400 font-semibold">Area</span> to frame a custom recording region.
                  </p>

                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleSelectDisplay}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold border border-neutral-700/70 transition-all cursor-pointer"
                    >
                      <Monitor className="w-3.5 h-3.5 text-sky-400" />
                      <span>Display</span>
                    </button>

                    <button
                      onClick={handleSelectWindow}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold border border-neutral-700/70 transition-all cursor-pointer"
                    >
                      <AppWindow className="w-3.5 h-3.5 text-sky-400" />
                      <span>Window</span>
                    </button>

                    <button
                      onClick={handleSelectArea}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold border border-neutral-700/70 transition-all cursor-pointer"
                    >
                      <Crop className="w-3.5 h-3.5 text-amber-400" />
                      <span>Select Area</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Status Footer */}
            <div className="z-20 text-[11px] text-neutral-500 font-mono flex items-center gap-4">
              <span>WongCapture v1.0.0</span>
              <span>•</span>
              <span>Windows x64 Native</span>
              <span>•</span>
              <button 
                onClick={() => changeCompactMode(false)} 
                className="hover:text-neutral-300 underline cursor-pointer"
              >
                Switch to Full Studio Mode
              </button>
            </div>

            {/* Interactive Area Selection Overlay (when isSelectingArea is true in Mini Bar mode) */}
            {isSelectingArea && (
              <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center">
                <div className="relative w-full h-full p-8 flex items-center justify-center">
                  <React.Suspense fallback={null}>
                  <SelectionToolOverlay
                    containerWidth={typeof window !== 'undefined' ? window.innerWidth - 64 : 1200}
                    containerHeight={typeof window !== 'undefined' ? window.innerHeight - 120 : 700}
                    sourceWidth={sourceSize.width}
                    sourceHeight={sourceSize.height}
                    cropRegion={cropRegion}
                    onChangeCropRegion={(newCrop) => {
                      setCropRegion(newCrop);
                      compositorRef.current.updateCropRegion(newCrop);
                    }}
                    isSelecting={isSelectingArea}
                    onToggleSelecting={() => setIsSelectingArea(false)}
                  />
                  </React.Suspense>
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
                    <button
                      onClick={() => setIsSelectingArea(false)}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs shadow-lg cursor-pointer"
                    >
                      Done Framing Area
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <React.Suspense fallback={<div className="flex-1" />}>
          <StudioPreview
            screenStream={screenStream}
            webcamStream={webcamStream}
            sourceName={selectedSourceName}
            isWindowSource={isWindowSource}
            preventMirrorLoop={settings.preventMirrorLoop}
            status={status}
            countdownNumber={countdownNumber}
            elapsedSeconds={elapsedSeconds}
            audioConfig={audioConfig}
            webcamConfig={webcamConfig}
            cropRegion={cropRegion}
            onChangeCropRegion={(newCrop) => {
              setCropRegion(newCrop);
              compositorRef.current.updateCropRegion(newCrop);
            }}
            isSelectingArea={isSelectingArea}
            onToggleSelectingArea={() => setIsSelectingArea(!isSelectingArea)}
            autoZoomConfig={autoZoomConfig}
            onUpdateAutoZoom={(updates) => {
              const next = { ...autoZoomConfig, ...updates };
              setAutoZoomConfig(next);
              compositorRef.current.updateAutoZoomConfig(next);
            }}
            onTriggerClickZoom={handleTriggerClickZoom}
            onResetZoom={handleResetZoom}
            isZoomed={isZoomed}
            resolution={settings.resolution}
            frameRate={settings.frameRate}
            format={settings.format}
            onRequestScreen={handleRequestScreen}
            onStopScreen={handleStopScreen}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onTogglePause={handleTogglePause}
            onToggleMic={() => setAudioConfig((prev) => ({ ...prev, microphone: !prev.microphone }))}
            onToggleWebcam={() => setWebcamConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
            onOpenWebcamSettings={() => setIsWebcamModalOpen(true)}
            onTakeSnapshot={handleTakeSnapshot}
            onOpenMixer={() => setIsMixerOpen(true)}
            onSwitchToCompact={() => changeCompactMode(true)}
          />
          </React.Suspense>
        )}
      </div>

      {/* Modals are fetched the first time they open and unmount when closed (keeps memory low) */}
      <React.Suspense fallback={null}>
        {isMixerOpen && (
          <AudioMixerPanel
            isOpen
            onClose={() => setIsMixerOpen(false)}
            audioConfig={audioConfig}
            onUpdateConfig={(updates: Partial<AudioConfig>) => setAudioConfig((prev) => ({ ...prev, ...updates }))}
          />
        )}

        {isWebcamModalOpen && (
          <WebcamSettingsModal
            isOpen
            onClose={() => setIsWebcamModalOpen(false)}
            config={webcamConfig}
            onUpdateConfig={(updates: Partial<WebcamConfig>) => setWebcamConfig((prev) => ({ ...prev, ...updates }))}
            webcamStream={webcamStream}
          />
        )}

        {isSettingsOpen && (
          <SettingsModal
            isOpen
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onUpdateSettings={(updates: Partial<RecordingSettings>) => setSettings((prev) => ({ ...prev, ...updates }))}
          />
        )}

        {isLibraryOpen && (
          <ClipLibrary
            isOpen
            onClose={() => setIsLibraryOpen(false)}
            clips={clips}
            onSelectClip={(clip: RecordedClip) => setSelectedClip(clip)}
            onDeleteClip={handleDeleteClip}
            onClearAll={handleClearAllClips}
          />
        )}

        {selectedClip && (
          <ClipPlayerModal
            isOpen
            clip={selectedClip}
            onClose={() => setSelectedClip(null)}
            onUpdateTitle={handleUpdateClipTitle}
            onSaveNewTrimmedClip={(newClip: RecordedClip) => {
              saveClipToDB(newClip);
              setClips((prev) => [newClip, ...prev]);
            }}
          />
        )}

        {isSourcePickerOpen && (
          <SourcePickerModal
            isOpen
            onClose={() => {
              setIsSourcePickerOpen(false);
              setAwaitingArea(false);
            }}
            initialTab={sourcePickerTab}
            onSelectSource={handleSelectDesktopSource}
            onSelectBrowserNative={async () => {
              setIsSourcePickerOpen(false);
              await acquireScreenStream();
            }}
            cropRegion={cropRegion}
            onChangeCropRegion={(newCrop: CropRegion) => {
              setCropRegion(newCrop);
              compositorRef.current.updateCropRegion(newCrop);
            }}
            onStartAreaSelection={beginAreaSelection}
            hasActiveScreen={screenStream !== null}
            awaitingAreaFraming={awaitingAreaFraming}
            sourceWidth={sourceSize.width}
            sourceHeight={sourceSize.height}
          />
        )}
      </React.Suspense>
    </div>
  );
}
