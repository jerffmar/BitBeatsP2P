// client/src/pages/Upload.tsx

import React, { useState } from 'react';
import { uploadTrack } from '../services/api';

const Upload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Por favor, selecione um arquivo.');
      return;
    }

    setUploading(true);
    setMessage('Iniciando upload...');
    setProgress(0);

    try {
      // Nota: A função uploadTrack precisa ser modificada para aceitar um callback de progresso
      // Por enquanto, vamos simular o progresso ou usar a versão atual que loga no console.
      const response = await uploadTrack(file); 
      
      setMessage(`Sucesso! ${response.message}. Magnet URI: ${response.track.magnetURI}`);
      setFile(null);
    } catch (error: any) {
      console.error('Erro no upload:', error);
      setMessage(`Erro no upload: ${error.response?.data?.error || error.message}`);
    } finally {
      setUploading(false);
      setProgress(100); // Finaliza a barra de progresso
    }
  };

  return (
    <div className="p-8 bg-gray-800 rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-white mb-6">Enviar Faixa</h2>
      
      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="file-upload">
          Selecione o Arquivo de Música
        </label>
        <input
          id="file-upload"
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-violet-50 file:text-violet-700
            hover:file:bg-violet-100"
        />
      </div>

      {file && (
        <p className="text-gray-400 mb-4">Arquivo selecionado: <span className="font-semibold">{file.name}</span> ({Math.round(file.size / 1024 / 1024)} MB)</p>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className={`w-full py-2 px-4 rounded-lg font-semibold transition duration-300 ${
          !file || uploading
            ? 'bg-gray-500 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
      >
        {uploading ? 'Enviando...' : 'Iniciar Upload e Seeding'}
      </button>

      {uploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-indigo-600 h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-400 mt-1">{progress}% Completo</p>
        </div>
      )}

      {message && (
        <p className={`mt-4 p-3 rounded ${message.includes('Sucesso') ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default Upload;
