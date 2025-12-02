import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
    VitePWA()
  ],
  resolve: {
    alias: {
      'bittorrent-dht': path.resolve(__dirname, 'src/shims/bittorrent-dht.ts'),
    },
  },
});