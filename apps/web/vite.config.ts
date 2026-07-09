import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const certDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'certs');
const httpsOptions = {
  key: fs.readFileSync(path.join(certDir, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'localhost-cert.pem')),
};

export default defineConfig({
  plugins: [react()],
  server: {
    https: httpsOptions,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
      '/spotify': 'http://localhost:3001',
      '/quiz': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
});
