import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Necessário para webtorrent no navegador
    nodePolyfills({
      // Inclui apenas os módulos necessários para webtorrent
      include: ['stream', 'buffer', 'events', 'path', 'util', 'crypto'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Habilita o suporte a módulos do Node.js no navegador
      protocolImports: true,
    }),
  ],
  server: {
    port: 5173,
    // Proxy para rotear chamadas /api para o backend Express
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
