// client/src/services/api.ts

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000', // O Vite proxy irá redirecionar para http://localhost:3000
  headers: {
    'Content-Type': 'application/json',
  },
});

export type TrackDTO = {
  id: number;
  title: string;
  artist: string;
  album: string;
  magnetURI: string;
  sizeBytes: number;
  duration: number;
};

const upload = async (file: File, metadata: any) => {
  const formData = new FormData();
  formData.append('trackFile', file);

  // Simulação de autenticação de usuário (substituir por lógica real)
  // O backend está hardcoded para userId=1, mas em um app real o token estaria aqui.

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
      console.log(`Upload progress: ${percentCompleted}%`);
      // TODO: Adicionar lógica para atualizar o estado do progresso na UI
    },
  });
  return response.data;
};

const getTracks = async (): Promise<TrackDTO[]> => {
  const response = await api.get('/tracks');
  return response.data;
};

const toggleLike = async (trackId: string) => {
  // Stub
};

export default { upload, getTracks, toggleLike };
