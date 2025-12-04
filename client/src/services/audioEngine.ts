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

const buildFingerprintPayload = (audioBuffer: AudioBuffer) => {
  const channelData = audioBuffer.getChannelData(0);
  const stride = Math.max(1, Math.floor(channelData.length / 2048));
  const samples: number[] = [];
  for (let i = 0; i < channelData.length && samples.length < 2048; i += stride) {
    samples.push(channelData[i]);
  }
  return new Float32Array(samples).buffer;
};

export interface AnalysisResult {
  duration: number;
  format: string;
  fingerprint: string;
  buffer: ArrayBuffer;
}

export const analyzeAudio = async (file: File): Promise<AnalysisResult> => {
  const fileBuffer = await file.arrayBuffer();
  const decoded = await decodeToAudioBuffer(fileBuffer);
  const fingerprintPayload = buildFingerprintPayload(decoded);
  const fingerprint = await sha256Hex(fingerprintPayload);
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
