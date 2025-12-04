// client/src/services/api.ts

import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000', // O Vite proxy irá redirecionar para http://localhost:3000
  headers: {
    'Content-Type': 'application/json',
  },
});

const upload = async (file: File, _metadata: any) => {
  const formData = new FormData();
  formData.append('trackFile', file);

  const response = await apiClient.post('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
      console.log(`Upload progress: ${percentCompleted}%`);
    },
  });
  return response.data;
};

const getTracks = async (): Promise<TrackDTO[]> => {
  const response = await apiClient.get('/api/tracks');
  return response.data;
};

const toggleLike = async (_trackId: string) => {
  // Stub
};

export default { upload, getTracks, toggleLike };

export interface TrackDTO {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  magnetURI?: string;
  sizeBytes?: number;
}
