// client/src/services/api.ts

import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // O Vite proxy irá redirecionar para http://localhost:3000
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadTrack = async (file: File) => {
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

// TODO: Adicionar outras chamadas de API (e.g., getTracks, getRecommendations, etc.)

export default api;
