import React from 'react';
import { 
  RecordingSettings, 
  AudioConfig, 
  WebcamConfig, 
  RecordedClip, 
  RecordingStatus,
  AutoZoomConfig,
  CropRegion
} from './types';
import { WindowsTitleBar } from './components/WindowsTitleBar';
import { FloatingBar } from './components/FloatingBar';
import { StudioPreview } from './components/StudioPreview';
import { AudioMixerPanel } from './components/AudioMixerPanel';
import { WebcamSettingsModal } from './components/WebcamSettingsModal';
import { ClipPlayerModal } from './components/ClipPlayerModal';
import { ClipLibrary } from './components/ClipLibrary';
import { SettingsModal } from './components/SettingsModal';
import { AudioMixer, AudioLevels } from './utils/audioMixer';
import { VideoCompositor } from './utils/compositor';
import { createRecorder, generateThumbnail, getSupportedFormats } from './utils/mp4Converter';
import { 
  saveClipToDB, 
  getAllClipsFromDB, 
  deleteClipFromDB, 
  updateClipTitleInDB 
} from './utils/storage';

const DEFAULT_SETTINGS: RecordingSettings = {
  resolution: '1080p',
  frameRate: 60,
  format: 'mp4',
  countdown: 3,
  bitrateKbps: 8000,
  filenamePrefix: 'WongCapture',
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
  const [isCompact, setIsCompact] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState(false);
  const [isMixerOpen, setIsMixerOpen] = React.useState(false);
  const [isWebcamModalOpen, setIsWebcamModalOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);
  const [selectedClip, setSelectedClip] = React.useState<RecordedClip | null>(null);

  // Streams & Engine
  const [screenStream, setScreenStream] = React.useState<MediaStream | null>(null);
  const [webcamStream, setWebcamStream] = React.useState<MediaStream | null>(null);
  const [micStream, setMicStream] = React.useState<MediaStream | null>(null);

  // Recording State
  const [status, setStatus] = React.useState<RecordingStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [countdownNumber, setCountdownNumber] = React.useState(3);
  const [audioLevels, setAudioLevels] = React.useState<AudioLevels>({ micLevel: 0, systemLevel: 0 });

  // Clip Storage
  const [clips, setClips] = React.useState<RecordedClip[]>([]);

  // Engine Refs
  const audioMixerRef = React.useRef<AudioMixer>(new AudioMixer());
  const compositorRef = React.useRef<VideoCompositor>(new VideoCompositor());
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const timerIntervalRef = React.useRef<number | null>(null);
  const vuMeterIntervalRef = React.useRef<number | null>(null);
  const countdownIntervalRef = React.useRef<number | null>(null);

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
    getAllClipsFromDB().then(setClips).catch(console.warn);
  }, []);

  // VU Meter & Zoom State Loop
  React.useEffect(() => {
    vuMeterIntervalRef.current = window.setInterval(() => {
      setAudioLevels(audioMixerRef.current.getLevels());
      setIsZoomed(compositorRef.current.getZoomState().isZoomed);
    }, 100);

    return () => {
      if (vuMeterIntervalRef.current !== null) {
        clearInterval(vuMeterIntervalRef.current);
      }
    };
  }, []);

  // Webcam stream management
  React.useEffect(() => {
    if (webcamConfig.enabled) {
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
          setWebcamStream(stream);
        })
        .catch((err) => {
          console.warn('Failed to get webcam stream:', err);
          setWebcamConfig((prev) => ({ ...prev, enabled: false }));
        });
    } else {
      if (webcamStream) {
        webcamStream.getTracks().forEach((t) => t.stop());
        setWebcamStream(null);
      }
    }
  }, [webcamConfig.enabled, webcamConfig.deviceId]);

  // Mic stream management
  React.useEffect(() => {
    if (audioConfig.microphone) {
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
          setMicStream(stream);
          audioMixerRef.current.setMicStream(stream, audioConfig.micVolume);
        })
        .catch((err) => {
          console.warn('Failed to get microphone stream:', err);
          setAudioConfig((prev) => ({ ...prev, microphone: false }));
        });
    } else {
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
        setMicStream(null);
      }
      audioMixerRef.current.setMicStream(null);
    }
  }, [audioConfig.microphone, audioConfig.micDeviceId, audioConfig.echoCancellation, audioConfig.noiseSuppression]);

  // Update mixer volume adjustments
  React.useEffect(() => {
    audioMixerRef.current.setMicVolume(audioConfig.micVolume);
  }, [audioConfig.micVolume]);

  React.useEffect(() => {
    audioMixerRef.current.setSystemVolume(audioConfig.systemVolume);
  }, [audioConfig.systemVolume]);

  // Screen selection
  const handleRequestScreen = async () => {
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
      setScreenStream(stream);

      // Connect system audio if present
      if (stream.getAudioTracks().length > 0) {
        audioMixerRef.current.setSystemStream(stream, audioConfig.systemVolume);
      }

      // Handle user ending screen share from browser banner
      stream.getVideoTracks()[0].onended = () => {
        handleStopScreen();
      };
    } catch (err) {
      console.warn('Screen selection cancelled or failed:', err);
    }
  };

  const handleStopScreen = () => {
    if (status === 'recording' || status === 'paused') {
      handleStopRecording();
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
    audioMixerRef.current.setSystemStream(null);
    compositorRef.current.stop();
  };

  // Recording Execution
  const executeStartRecording = async (activeScreenStream: MediaStream) => {
    try {
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
        setStatus('processing');
        if (timerIntervalRef.current !== null) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

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

        const thumbnailUrl = await generateThumbnail(recordedBlob);

        const newClip: RecordedClip = {
          id: `clip_${Date.now()}`,
          title,
          timestamp: Date.now(),
          duration: elapsedSeconds || 1,
          blob: recordedBlob,
          url: URL.createObjectURL(recordedBlob),
          thumbnailUrl,
          format: actualFormat,
          sizeBytes: recordedBlob.size,
          width,
          height,
          fps: settings.frameRate,
        };

        await saveClipToDB(newClip);
        setClips((prev) => [newClip, ...prev]);
        setSelectedClip(newClip);
        setStatus('idle');
        setElapsedSeconds(0);
      };

      recorder.start(1000); // 1-second chunks
      mediaRecorderRef.current = recorder;
      setStatus('recording');
      setElapsedSeconds(0);

      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recorder:', err);
      setStatus('idle');
    }
  };

  const handleStartRecording = async () => {
    let activeStream = screenStream;
    if (!activeStream) {
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

        activeStream = await navigator.mediaDevices.getDisplayMedia(constraints);
        setScreenStream(activeStream);

        if (activeStream.getAudioTracks().length > 0) {
          audioMixerRef.current.setSystemStream(activeStream, audioConfig.systemVolume);
        }

        activeStream.getVideoTracks()[0].onended = () => {
          handleStopScreen();
        };
      } catch {
        return; // User cancelled screen selection
      }
    }

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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleTogglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (status === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
    } else if (status === 'paused') {
      mediaRecorderRef.current.resume();
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
  const handleTriggerClickZoom = (normX: number, normY: number) => {
    compositorRef.current.triggerClickZoom(normX, normY);
    setIsZoomed(true);
  };

  const handleResetZoom = () => {
    compositorRef.current.resetZoom();
    setIsZoomed(false);
  };

  // Clip library actions
  const handleDeleteClip = async (id: string) => {
    await deleteClipFromDB(id);
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (selectedClip?.id === id) {
      setSelectedClip(null);
    }
  };

  const handleClearAllClips = async () => {
    for (const c of clips) {
      await deleteClipFromDB(c.id);
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

  // Keyboard Shortcuts Listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes modals or exits selection
      if (e.key === 'Escape') {
        if (isSelectingArea) {
          setIsSelectingArea(false);
          return;
        }
        setIsMixerOpen(false);
        setIsWebcamModalOpen(false);
        setIsSettingsOpen(false);
        setIsLibraryOpen(false);
        setSelectedClip(null);
        return;
      }

      // Alt+M toggles mini bar
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setIsCompact((prev) => !prev);
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
        if (status === 'recording' || status === 'paused') {
          handleStopRecording();
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
        onToggleCompact={() => setIsCompact(!isCompact)}
        onTogglePin={() => setIsPinned(!isPinned)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        clipCount={clips.length}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Full Studio Preview Canvas */}
        <StudioPreview
          screenStream={screenStream}
          webcamStream={webcamStream}
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
          micLevel={audioLevels.micLevel}
          systemLevel={audioLevels.systemLevel}
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
        />

        {/* Floating Mini Bar (when in compact mode or recording) */}
        {isCompact && (
          <FloatingBar
            status={status}
            elapsedSeconds={elapsedSeconds}
            audioConfig={audioConfig}
            webcamConfig={webcamConfig}
            autoZoomConfig={autoZoomConfig}
            cropRegion={cropRegion}
            micLevel={audioLevels.micLevel}
            format={settings.format}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onTogglePause={handleTogglePause}
            onToggleMic={() => setAudioConfig((prev) => ({ ...prev, microphone: !prev.microphone }))}
            onToggleWebcam={() => setWebcamConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
            onToggleAutoZoom={() => {
              const next = { ...autoZoomConfig, enabled: !autoZoomConfig.enabled };
              setAutoZoomConfig(next);
              compositorRef.current.updateAutoZoomConfig(next);
            }}
            onToggleCrop={() => setIsSelectingArea(!isSelectingArea)}
            onTakeSnapshot={handleTakeSnapshot}
            onExpandStudio={() => setIsCompact(false)}
          />
        )}
      </div>

      {/* Audio Mixer Flyout Modal */}
      <AudioMixerPanel
        isOpen={isMixerOpen}
        onClose={() => setIsMixerOpen(false)}
        audioConfig={audioConfig}
        onUpdateConfig={(updates) => setAudioConfig((prev) => ({ ...prev, ...updates }))}
        micLevel={audioLevels.micLevel}
        systemLevel={audioLevels.systemLevel}
      />

      {/* Webcam Configuration Modal */}
      <WebcamSettingsModal
        isOpen={isWebcamModalOpen}
        onClose={() => setIsWebcamModalOpen(false)}
        config={webcamConfig}
        onUpdateConfig={(updates) => setWebcamConfig((prev) => ({ ...prev, ...updates }))}
        webcamStream={webcamStream}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(updates) => setSettings((prev) => ({ ...prev, ...updates }))}
      />

      {/* Recorded Clips Library Drawer / Modal */}
      <ClipLibrary
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        clips={clips}
        onSelectClip={(clip) => setSelectedClip(clip)}
        onDeleteClip={handleDeleteClip}
        onClearAll={handleClearAllClips}
      />

      {/* Built-in Video Player & Trimmer Modal */}
      <ClipPlayerModal
        isOpen={selectedClip !== null}
        clip={selectedClip}
        onClose={() => setSelectedClip(null)}
        onUpdateTitle={handleUpdateClipTitle}
        onSaveNewTrimmedClip={(newClip) => {
          saveClipToDB(newClip);
          setClips((prev) => [newClip, ...prev]);
        }}
      />
    </div>
  );
}
