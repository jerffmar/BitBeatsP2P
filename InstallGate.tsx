// client/src/components/InstallGate.tsx

import React, { useState, useEffect } from 'react';

interface InstallGateProps {
  children: React.ReactNode;
}

/**
 * Componente que bloqueia o acesso ao player se o app não estiver instalado (display-mode: standalone).
 * Mostra o conteúdo completo (children) apenas se estiver instalado.
 */
const InstallGate: React.FC<InstallGateProps> = ({ children }) => {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verifica se o display-mode é 'standalone' (PWA instalada)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    
    const checkInstallation = () => {
      setIsInstalled(mediaQuery.matches);
    };

    checkInstallation();
    mediaQuery.addEventListener('change', checkInstallation);

    return () => {
      mediaQuery.removeEventListener('change', checkInstallation);
    };
  }, []);

  if (isInstalled) {
    return <>{children}</>;
  }

  // Conteúdo a ser mostrado quando não estiver instalado (apenas Landing/Login)
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-4">Bem-vindo ao BitBeats</h1>
      <p className="text-xl mb-8 text-center">
        Para acessar o player de música descentralizado, você precisa instalar o aplicativo.
      </p>
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
        <p className="mb-4">
          **No Chrome/Edge:** Clique no ícone de **instalação** (geralmente um sinal de `+` ou uma seta para baixo) na barra de endereço.
        </p>
        <p>
          **No Safari (iOS):** Use o botão **Compartilhar** e selecione **Adicionar à Tela de Início**.
        </p>
      </div>
      <p className="mt-8 text-sm text-gray-400">
        *Apenas a tela de Login/Landing Page é acessível no modo de navegador.*
      </p>
    </div>
  );
};

export default InstallGate;
