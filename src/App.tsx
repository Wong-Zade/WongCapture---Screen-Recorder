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

  const [isSelectingArea, setIsSelectingArea] = React.useState(false); // the on-screen area overlay is open

  // Modals / panels
  const [sourcePickerTab, setSourcePickerTab] = React.useState<'windows' | 'screens' | 'area'>('screens');
  const [isPinned, setIsPinned] = React.useState(true); // the bar floats above other windows by default
  const [isMixerOpen, setIsMixerOpen] = React.useState(false);
  const [isWebcamModalOpen, setIsWebcamModalOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);
  const [isSourcePickerOpen, setIsSourcePickerOpen] = React.useState(false);
  const [sourceSize, setSourceSize] = React.useState({ width: 1920, height: 1080 });
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

  // The bar has no live preview, so while nothing is recording the capture only needs to trickle along
  React.useEffect(() => {
    if (!screenStream) return;
    applyCaptureFps(screenStream, status === 'idle' ? 5 : settings.frameRate);
  }, [screenStream, status, settings.frameRate]);

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

  // Record just part of the screen: a full-screen overlay (like a snipping tool) lets you drag the area directly on
  // your desktop. The bar itself is too small to frame anything inside.
  const beginAreaSelection = async () => {
    if (statusRef.current !== 'idle' || isSelectingArea) return;
    if (!window.wongCapture?.selectAreaOnScreen) {
      // Plain browser: only the ratio presets are available
      setSourcePickerTab('area');
      setIsSourcePickerOpen(true);
      return;
    }
    setIsSelectingArea(true);
    try {
      const result = await window.wongCapture.selectAreaOnScreen();
      if (!result) return; // cancelled
      const crop: CropRegion = { enabled: true, preset: 'custom', ...result.region };
      setCropRegion(crop);
      compositorRef.current.updateCropRegion(crop);
      // The area belongs to the screen the bar is on: (re)connect that screen if it isn't the one we have
      if (result.changedSource || !screenStreamRef.current) {
        await acquireScreenStream({ name: result.sourceName || 'Entire screen', isWindow: false });
      }
    } catch (err) {
      console.warn('Area selection failed:', err);
    } finally {
      setIsSelectingArea(false);
    }
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

      return stream;
    } catch (err) {
      console.warn('Screen selection cancelled or failed:', err);
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
          return;
        }
      }
      await acquireScreenStream({ name: source.name, isWindow: !source.isScreen });
    } catch (err) {
      console.error('Failed to select desktop source:', err);
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
        setIsSourcePickerOpen(false);
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

  // ---------------------------------------------------------------------------
  // Floating-bar shell: the desktop window is exactly as big as what is on screen
  // ---------------------------------------------------------------------------
  const isDesktop = typeof window !== 'undefined' && !!window.wongWindow?.setLayout;
  const shellRef = React.useRef<HTMLDivElement>(null);
  const barBlockRef = React.useRef<HTMLDivElement>(null);
  const panelOpen = isSettingsOpen || isLibraryOpen || selectedClip !== null || isMixerOpen || isWebcamModalOpen || isSourcePickerOpen;
  const panelOpenRef = React.useRef(panelOpen);
  panelOpenRef.current = panelOpen;
  const reportLayoutRef = React.useRef<() => void>(() => {});

  React.useLayoutEffect(() => {
    if (!isDesktop || !shellRef.current) return;
    document.documentElement.dataset.shell = 'bar';
    let frame = 0;
    let lastKey = '';

    const report = () => {
      const root = shellRef.current;
      const bar = barBlockRef.current;
      if (!root || !bar) return;
      const rect = root.getBoundingClientRect();
      // Panels (settings, clips, picker...) open directly under the bar: tell the CSS where the bar ends
      document.documentElement.style.setProperty('--shell-bar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);

      const menu = root.querySelector('[data-menu-open="true"]') as HTMLElement | null;
      let width = Math.ceil(rect.width);
      let height = Math.ceil(rect.height);
      let expanded = menu !== null;
      let anchor: 'top' | 'bottom' = menu?.dataset.menuUp === 'true' ? 'bottom' : 'top';
      if (panelOpenRef.current) {
        width = Math.max(width, 980);
        height += 664; // panel + a little room so its shadow is not clipped
        expanded = true;
        anchor = 'top';
      }
      const key = `${width}x${height}x${expanded}x${anchor}`;
      if (key === lastKey) return;
      lastKey = key;
      window.wongWindow!.setLayout!({ width, height, expanded, anchor });
    };
    reportLayoutRef.current = report;

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(report);
    });
    observer.observe(shellRef.current);
    report();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [isDesktop]);

  // Modals do not change the bar's own size, so announce them explicitly
  React.useEffect(() => {
    reportLayoutRef.current();
  }, [panelOpen]);

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    window.wongWindow?.setAlwaysOnTop(next);
  };

  return (
    <div
      ref={shellRef}
      className={`${isDesktop ? 'inline-flex flex-col items-start' : 'flex flex-col items-center pt-8'} font-sans select-none text-neutral-100`}
    >
      {/* The bar is the whole app. The padding leaves room for its soft shadow inside the transparent window. */}
      <div ref={barBlockRef} className="p-3">
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
          onStopScreen={handleStopScreen}
          windowControls={
            isDesktop
              ? {
                  isPinned,
                  onTogglePin: togglePin,
                  onMinimize: () => window.wongWindow?.minimize(),
                  onClose: () => window.wongWindow?.close(),
                }
              : undefined
          }
        />
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
            onClose={() => setIsSourcePickerOpen(false)}
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
            sourceWidth={sourceSize.width}
            sourceHeight={sourceSize.height}
          />
        )}
      </React.Suspense>
    </div>
  );
}
