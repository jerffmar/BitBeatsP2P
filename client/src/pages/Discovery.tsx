// client/src/pages/Discovery.tsx

import React from 'react';

// Componente de Carrossel Simples (Placeholder)
const Carousel: React.FC<{ title: string, items: string[] }> = ({ title, items }) => (
  <div className="mb-10">
    <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
    <div className="flex space-x-4 overflow-x-auto pb-4">
      {items.map((item, index) => (
        <div key={index} className="flex-shrink-0 w-40 h-40 bg-gray-700 rounded-lg shadow-md flex items-center justify-center text-center p-3 text-sm text-gray-300 hover:bg-gray-600 transition duration-200 cursor-pointer">
          {item}
        </div>
      ))}
    </div>
  </div>
);

const Discovery: React.FC = () => {
  // Dados simulados
  const recentPlays = ["Faixa 1", "Faixa 2", "Faixa 3", "Faixa 4", "Faixa 5", "Faixa 6"];
  const recommendations = ["Álbum A (Genre: Rock)", "Álbum B (Genre: Jazz)", "Álbum C (Genre: Eletrônica)"];

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-white mb-8">Descubra</h1>

      <Carousel title="Reproduções Recentes" items={recentPlays} />
      
      <Carousel title="Recomendações (Afinidade de Gênero)" items={recommendations} />

      {/* TODO: Implementar a lógica de reprodução de faixas e download para o Vault */}
    </div>
  );
};

export default Discovery;
