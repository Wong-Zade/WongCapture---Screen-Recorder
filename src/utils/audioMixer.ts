export interface AudioLevels {
  micLevel: number; // 0 to 1
  systemLevel: number; // 0 to 1
}

export class AudioMixer {
  private ctx: AudioContext | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private systemSource: MediaStreamAudioSourceNode | null = null;
  private micGain: GainNode | null = null;
  private systemGain: GainNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  
  private micAnalyser: AnalyserNode | null = null;
  private systemAnalyser: AnalyserNode | null = null;
  private micDataArray: Uint8Array<ArrayBuffer> | null = null;
  private systemDataArray: Uint8Array<ArrayBuffer> | null = null;

  init() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.destination = this.ctx.createMediaStreamDestination();
  }

  setMicStream(stream: MediaStream | null, volume: number = 1.0) {
    if (!this.ctx || !this.destination) this.init();
    if (!this.ctx || !this.destination) return;

    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // ignore
      }
      this.micSource = null;
    }

    if (!stream || stream.getAudioTracks().length === 0) {
      this.micAnalyser = null;
      return;
    }

    try {
      this.micSource = this.ctx.createMediaStreamSource(stream);
      this.micGain = this.ctx.createGain();
      this.micGain.gain.value = volume;

      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 64;
      this.micAnalyser.smoothingTimeConstant = 0.5;
      this.micDataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);

      this.micSource.connect(this.micGain);
      this.micGain.connect(this.micAnalyser);
      this.micGain.connect(this.destination);
    } catch (err) {
      console.warn('Failed to connect mic stream to mixer:', err);
    }
  }

  setSystemStream(stream: MediaStream | null, volume: number = 1.0) {
    if (!this.ctx || !this.destination) this.init();
    if (!this.ctx || !this.destination) return;

    if (this.systemSource) {
      try {
        this.systemSource.disconnect();
      } catch {
        // ignore
      }
      this.systemSource = null;
    }

    if (!stream || stream.getAudioTracks().length === 0) {
      this.systemAnalyser = null;
      return;
    }

    try {
      this.systemSource = this.ctx.createMediaStreamSource(stream);
      this.systemGain = this.ctx.createGain();
      this.systemGain.gain.value = volume;

      this.systemAnalyser = this.ctx.createAnalyser();
      this.systemAnalyser.fftSize = 64;
      this.systemAnalyser.smoothingTimeConstant = 0.5;
      this.systemDataArray = new Uint8Array(this.systemAnalyser.frequencyBinCount);

      this.systemSource.connect(this.systemGain);
      this.systemGain.connect(this.systemAnalyser);
      this.systemGain.connect(this.destination);
    } catch (err) {
      console.warn('Failed to connect system stream to mixer:', err);
    }
  }

  setMicVolume(volume: number) {
    if (this.micGain && this.ctx) {
      this.micGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  setSystemVolume(volume: number) {
    if (this.systemGain && this.ctx) {
      this.systemGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  getMixedAudioTrack(): MediaStreamTrack | null {
    if (!this.destination) return null;
    const tracks = this.destination.stream.getAudioTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  getLevels(): AudioLevels {
    let micLevel = 0;
    let systemLevel = 0;

    if (this.micAnalyser && this.micDataArray) {
      this.micAnalyser.getByteFrequencyData(this.micDataArray);
      let sum = 0;
      for (let i = 0; i < this.micDataArray.length; i++) {
        sum += this.micDataArray[i];
      }
      micLevel = Math.min(1, (sum / this.micDataArray.length) / 128);
    }

    if (this.systemAnalyser && this.systemDataArray) {
      this.systemAnalyser.getByteFrequencyData(this.systemDataArray);
      let sum = 0;
      for (let i = 0; i < this.systemDataArray.length; i++) {
        sum += this.systemDataArray[i];
      }
      systemLevel = Math.min(1, (sum / this.systemDataArray.length) / 128);
    }

    return { micLevel, systemLevel };
  }

  destroy() {
    try {
      if (this.micSource) this.micSource.disconnect();
      if (this.systemSource) this.systemSource.disconnect();
      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close();
      }
    } catch {
      // ignore
    }
    this.ctx = null;
    this.destination = null;
    this.micSource = null;
    this.systemSource = null;
  }
}
