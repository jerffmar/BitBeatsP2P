const getAudioContext = (() => {
  let ctx: AudioContext | null = null;
  return () => {
    if (typeof window === 'undefined') {
      throw new Error('Audio features are only available in the browser.');
    }
    if (!ctx) {
      const AnyAudioContext = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      ctx = new AnyAudioContext();
    }
    return ctx;
  };
})();

const sha256Hex = async (payload: ArrayBuffer) => {
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const cloneBuffer = (buffer: ArrayBuffer) => buffer.slice(0);

const decodeToAudioBuffer = async (buffer: ArrayBuffer) => {
  const ctx = getAudioContext();
  return ctx.decodeAudioData(cloneBuffer(buffer));
};

const resampleBuffer = async (audioBuffer: AudioBuffer, targetSampleRate: number) => {
  if (audioBuffer.sampleRate === targetSampleRate) return audioBuffer;
  const offline = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate,
  );
  const source = offline.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offline.destination);
  source.start(0);
  return offline.startRendering();
};

const normalizeBuffer = (audioBuffer: AudioBuffer, targetPeak = 0.95) => {
  let peak = 0;
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  if (!peak) return audioBuffer;

  const gain = targetPeak / peak;
  const ctx = getAudioContext();
  const normalized = ctx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const input = audioBuffer.getChannelData(channel);
    const output = normalized.getChannelData(channel);
    for (let i = 0; i < input.length; i++) {
      output[i] = Math.max(-1, Math.min(1, input[i] * gain));
    }
  }
  return normalized;
};

const audioBufferToWav = (audioBuffer: AudioBuffer) => {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const samples = audioBuffer.length * numChannels;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);

  let offset = 0;
  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++, offset++) {
      view.setUint8(offset, str.charCodeAt(i));
    }
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + samples * 2, true);
  offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, format, true);
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * numChannels * (bitDepth / 8), true);
  offset += 4;
  view.setUint16(offset, numChannels * (bitDepth / 8), true);
  offset += 2;
  view.setUint16(offset, bitDepth, true);
  offset += 2;
  writeString('data');
  view.setUint32(offset, samples * 2, true);
  offset += 4;

  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return buffer;
};

// Helper: mix channels into a mono Float32Array
const mixToMono = (audioBuffer: AudioBuffer): Float32Array => {
  const { numberOfChannels, length } = audioBuffer;
  const out = new Float32Array(length);
  if (numberOfChannels === 1) {
    out.set(audioBuffer.getChannelData(0));
    return out;
  }
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      out[i] += data[i] / numberOfChannels;
    }
  }
  return out;
};

// Naive small-size DFT magnitude computation for a frame (kBins bins)
const dftMagnitudes = (frame: Float32Array, kBins = 16) => {
  const N = frame.length;
  const mags = new Float32Array(kBins);
  for (let k = 0; k < kBins; k++) {
    let re = 0;
    let im = 0;
    const freq = (2 * Math.PI * k) / N;
    for (let n = 0; n < N; n++) {
      const angle = freq * n;
      re += frame[n] * Math.cos(angle);
      im -= frame[n] * Math.sin(angle);
    }
    mags[k] = Math.hypot(re, im) / N;
  }
  return mags;
};

// Build fingerprint payload: windowed RMS + small DFT magnitudes, downsampled to (time x freq)
const buildFingerprintMatrix = (mono: Float32Array, sampleRate: number, options = { windowMs: 300, hopMs: 150, dftSize: 512, freqBins: 24, maxFrames: 128 }) => {
  const w = Math.floor((options.windowMs / 1000) * sampleRate);
  const hop = Math.floor((options.hopMs / 1000) * sampleRate);
  const frames: number[] = [];
  const freqBins = options.freqBins;
  const matrix: number[] = [];
  let frameCount = 0;
  for (let start = 0; start + w <= mono.length && frameCount < options.maxFrames; start += hop) {
    const slice = mono.subarray(start, start + w);
    // compute RMS
    let sumSq = 0;
    for (let i = 0; i < slice.length; i++) sumSq += slice[i] * slice[i];
    const rms = Math.sqrt(sumSq / slice.length) || 0;
    // simple DFT on a downsampled version of the slice (resize to dftSize)
    let frame: Float32Array;
    if (slice.length === options.dftSize) frame = slice;
    else {
      frame = new Float32Array(options.dftSize);
      // simple resample by picking samples at ratio
      const ratio = slice.length / options.dftSize;
      for (let i = 0; i < options.dftSize; i++) {
        const idx = Math.floor(i * ratio);
        frame[i] = slice[idx] ?? 0;
      }
    }
    const mags = dftMagnitudes(frame, freqBins);
    // normalize mags relative to max of this frame to reduce level sensitivity
    let maxMag = 0;
    for (let i = 0; i < mags.length; i++) maxMag = Math.max(maxMag, mags[i]);
    if (maxMag > 0) {
      for (let i = 0; i < mags.length; i++) mags[i] = mags[i] / maxMag;
    }
    // push rms and mags into matrix row-wise
    matrix.push(rms);
    for (let i = 0; i < freqBins; i++) matrix.push(mags[i]);
    frameCount++;
  }
  // if not enough frames, pad with zeros
  const rowSize = 1 + freqBins;
  const totalExpected = options.maxFrames * rowSize;
  if (matrix.length < totalExpected) {
    matrix.push(...new Array(totalExpected - matrix.length).fill(0));
  } else if (matrix.length > totalExpected) {
    matrix.length = totalExpected;
  }
  return new Float32Array(matrix);
};

export interface AnalysisResult {
  duration: number;
  format: string;
  fingerprint: string;
  buffer: ArrayBuffer;
}

export const analyzeAudio = async (file: File): Promise<AnalysisResult> => {
  // Decode, build a perceptual fingerprint, and return WAV buffer + meta
  const fileBuffer = await file.arrayBuffer();
  const decoded = await decodeToAudioBuffer(fileBuffer);
  // Mix to mono
  const mono = mixToMono(decoded);
  // Build fingerprint matrix (time x freq)
  const matrix = buildFingerprintMatrix(mono, decoded.sampleRate, { windowMs: 300, hopMs: 150, dftSize: 512, freqBins: 24, maxFrames: 128 });
  // Hash the matrix bytes
  const fingerprint = await sha256Hex(matrix.buffer);
  // convert decoded (possibly normalized) to WAV for seeding/playback
  const wavBuffer = audioBufferToWav(decoded);
  return {
    buffer: wavBuffer,
    duration: decoded.duration,
    fingerprint,
    format: 'audio/wav',
  };
};

export const normalizeAndTranscode = async (buffer: ArrayBuffer, targetSampleRate = 44100): Promise<ArrayBuffer> => {
  const decoded = await decodeToAudioBuffer(buffer);
  const resampled = await resampleBuffer(decoded, targetSampleRate);
  const normalized = normalizeBuffer(resampled);
  return audioBufferToWav(normalized);
};
