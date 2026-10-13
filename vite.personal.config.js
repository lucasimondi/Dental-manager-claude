import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// POL-VITA-001 — Poliedron Personal: app separata (progetto Vercel a sé) collegata solo
// all'archivio personale. Non include codice, chiavi o service worker dell'app dello studio.
export default defineConfig({
  root: resolve('personal'),
  publicDir: resolve('personal/public'),
  plugins: [react()],
  build: { outDir: resolve('dist-personal'), emptyOutDir: true },
  server: { port: 5174 },
});
