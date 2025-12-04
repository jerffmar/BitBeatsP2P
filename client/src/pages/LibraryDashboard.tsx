// client/src/pages/LibraryDashboard.tsx

import React from 'react';
import { User, LibraryEntry, Track } from '../types';

interface Props {
  user: User;
  library: Record<string, LibraryEntry>;
  tracks: Track[];
  usageMB: number;
  onImport: (file: File, metadata: { title: string; artist: string; album?: string }) => Promise<void>;
}

const LibraryDashboard: React.FC<Props> = () => {
  // Dados simulados
  const storageUsed = 3.5; // GB
  const maxQuota = 10; // GB
  const usagePercent = (storageUsed / maxQuota) * 100;

  const quadPreviewData = [
    { title: "Álbuns Curtidos", count: 12, color: "bg-red-500" },
    { title: "Artistas Seguidos", count: 5, color: "bg-blue-500" },
    { title: "Faixas no Vault", count: 45, color: "bg-green-500" },
    { title: "Faixas Enviadas", count: 8, color: "bg-yellow-500" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-white mb-8">Sua Biblioteca BitBeats</h1>

      {/* Storage Usage Bar */}
      <div className="mb-10 bg-gray-800 p-6 rounded-lg shadow-xl">
        <h2 className="text-xl font-semibold text-gray-300 mb-3">Uso de Armazenamento (Seeding)</h2>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">
            {storageUsed} GB de {maxQuota} GB usados
          </span>
          <span className="text-sm font-bold text-white">{usagePercent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-purple-600 transition-all duration-500"
            style={{ width: `${usagePercent}%` }}
          ></div>
        </div>
      </div>

      {/* Quad-Preview Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quadPreviewData.map((item, index) => (
          <div key={index} className={`p-6 rounded-lg shadow-xl ${item.color} bg-opacity-20 border-l-4 border-${item.color.split('-')[1]}-500`}>
            <p className="text-sm font-medium text-gray-400">{item.title}</p>
            <p className="text-4xl font-extrabold text-white mt-1">{item.count}</p>
          </div>
        ))}
      </div>

      {/* TODO: Lista de faixas e outras informações da biblioteca */}
    </div>
  );
};

export default LibraryDashboard;
