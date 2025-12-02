// client/src/App.tsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import InstallGate from './components/InstallGate';
import LibraryDashboard from './pages/LibraryDashboard';
import Discovery from './pages/Discovery';
import Upload from './pages/Upload';

// Componente de Navegação Simples
const NavBar: React.FC = () => (
  <nav className="bg-gray-900 p-4 shadow-lg">
    <div className="container mx-auto flex justify-between items-center">
      <Link to="/" className="text-2xl font-bold text-purple-400">BitBeats</Link>
      <div className="space-x-4">
        <Link to="/library" className="text-gray-300 hover:text-white transition duration-200">Biblioteca</Link>
        <Link to="/discover" className="text-gray-300 hover:text-white transition duration-200">Descobrir</Link>
        <Link to="/upload" className="text-gray-300 hover:text-white transition duration-200">Upload</Link>
        {/* TODO: Adicionar Login/Logout */}
      </div>
    </div>
  </nav>
);

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <NavBar />
        <main className="container mx-auto p-4">
          {/* O InstallGate envolve as rotas que precisam de PWA instalada */}
          <InstallGate>
            <Routes>
              <Route path="/" element={<LibraryDashboard />} />
              <Route path="/library" element={<LibraryDashboard />} />
              <Route path="/discover" element={<Discovery />} />
              <Route path="/upload" element={<Upload />} />
              {/* TODO: Adicionar rotas de Login/Landing Page que são acessíveis sem o InstallGate */}
            </Routes>
          </InstallGate>
        </main>
        {/* TODO: Adicionar o Player Bar Fixo */}
      </div>
    </Router>
  );
};

export default App;