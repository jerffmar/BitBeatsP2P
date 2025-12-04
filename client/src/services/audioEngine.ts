export type AnalysisResult = {
  buffer: ArrayBuffer | null;
  duration: number;
  fingerprint: string | null;
};

export const analyzeAudio = async (file: File): Promise<AnalysisResult> => {
  const arrayBuffer = await file.arrayBuffer();
  return {
    buffer: arrayBuffer,
    duration: Math.max(30, Math.floor(arrayBuffer.byteLength / 44100)), // mock duration
    fingerprint: `fp-${file.name}-${arrayBuffer.byteLength}`,
  };
};

export const normalizeAndTranscode = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  // TODO: replace with real DSP + encoding pipeline
  return buffer;
};
