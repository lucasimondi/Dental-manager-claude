import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // POL-UI-029: registered explicitly in src/App.jsx (via
      // `virtual:pwa-register`) instead of the default auto-injected
      // script, so an update installing in the background can surface a
      // "tocca per aggiornare" banner — the default left new deploys
      // invisible to an already-open PWA (backgrounded/resumed, never a
      // real reload) until the next full relaunch.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Poliedra',
        short_name: 'Poliedra',
        description: 'Gestionale per studi professionali e sanitari',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F0F4F8',
        theme_color: '#185FA5',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365, maxEntries: 20 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist', // cache bust 155200,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          recharts: ['recharts'],
          pdf: ['jspdf', 'pdfjs-dist'],
        },
      },
    },
  },
});
