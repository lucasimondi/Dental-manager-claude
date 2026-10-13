import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// POL-VITA-001 — Poliedron Personal, solo per lo sviluppo locale (npm run dev:personal).
// In produzione è un'entry della build principale, servita su /personal/ (vite.config.js).
export default defineConfig({
  root: resolve('personal'),
  base: '/personal/',
  publicDir: resolve('public'),
  plugins: [react()],
  build: { outDir: resolve('dist-personal'), emptyOutDir: true },
  server: { port: 5174 },
});
