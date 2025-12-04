// client/src/services/api.ts

import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000', // O Vite proxy irá redirecionar para http://localhost:3000
  headers: {
    'Content-Type': 'application/json',
  },
});

// modify upload to accept an optional progress callback
export const upload = async (file: File, _metadata: any, onProgress?: (percent: number) => void) => {
  const formData = new FormData();
  formData.append('trackFile', file);
  // attach minimal metadata if provided
  if (_metadata?.title) formData.append('title', _metadata.title);
  if (_metadata?.artist) formData.append('artist', _metadata.artist);
  if (_metadata?.album) formData.append('album', _metadata.album);

  const response = await apiClient.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent: import('axios').AxiosProgressEvent) => {
      const total = progressEvent.total || 1;
      const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
      if (typeof onProgress === 'function') onProgress(percentCompleted);
      // graceful log fallback
      console.log(`Upload progress: ${percentCompleted}%`);
    },
  });
  return response.data;
};

const getTracks = async (): Promise<TrackDTO[]> => {
  const response = await apiClient.get('/api/tracks');
  return response.data;
};

const deleteTrack = async (id: string) => {
  const response = await apiClient.delete(`/api/tracks/${id}`);
  return response.data;
};

const toggleLike = async (_trackId: string) => {
  // Stub
};

export default { upload, getTracks, toggleLike, deleteTrack };

export interface TrackDTO {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  magnetURI?: string;
  sizeBytes?: number;
}
