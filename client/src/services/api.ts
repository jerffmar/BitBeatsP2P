import axios, { AxiosProgressEvent } from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

export type TrackDTO = {
  id: number;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  magnetURI: string;
  sizeBytes: string;
  uploadedAt: string;
};

const upload = (formData: FormData, onProgress?: (pct: number) => void) =>
  apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    onUploadProgress: (evt: AxiosProgressEvent) => {
      if (evt.total && onProgress) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });

const getTracks = () => apiClient.get<TrackDTO[]>('/tracks').then((res) => res.data);

const toggleLike = (id: number) => apiClient.post(`/likes/${id}`).then((res) => res.data);

export const api = { upload, getTracks, toggleLike };
