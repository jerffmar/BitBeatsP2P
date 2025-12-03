const getAudioContext = () => {
  const Context =
    (window as any).AudioContext ||
    (window as any).webkitAudioContext;
  if (!Context) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  return new Context();
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export type AudioAnalysis = {
  buffer: AudioBuffer;
  duration: number;
  fingerprint: string;
};

export async function analyzeAudio(file: File): Promise<AudioAnalysis> {
  const fileBuffer = await file.arrayBuffer();
  const ctx = getAudioContext();
  try {
    const decoded = await ctx.decodeAudioData(fileBuffer.slice(0));
    const duration = decoded.duration;
    const fingerprintBuf = await crypto.subtle.digest('SHA-256', fileBuffer);
    return {
      buffer: decoded,
      duration,
      fingerprint: toHex(fingerprintBuf),
    };
  } finally {
    ctx.close().catch(() => undefined);
  }
}

export async function normalizeAndTranscode(buffer: AudioBuffer): Promise<ArrayBuffer> {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;

  const peak = Array.from({ length: channels })
    .map((_, idx) => buffer.getChannelData(idx))
    .reduce((maxAmplitude, channelData) => {
      for (let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i]);
        if (abs > maxAmplitude) maxAmplitude = abs;
      }
      return maxAmplitude;
    }, 0);

  const gainValue = peak > 0 ? Math.min(0.99 / peak, 4) : 1;

  const OfflineContext =
    (window as any).OfflineAudioContext ||
    (window as any).webkitOfflineAudioContext;
  if (!OfflineContext) {
    throw new Error('OfflineAudioContext is not supported in this browser.');
  }

  const offlineCtx = new OfflineContext(channels, length, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  const gain = offlineCtx.createGain();
  gain.gain.value = gainValue;
  source.connect(gain).connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();
  return audioBufferToWav(rendered);
}

function audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const { numberOfChannels, length, sampleRate } = audioBuffer;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length * blockAlign, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length * blockAlign, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return buffer;
}

function writeString(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
