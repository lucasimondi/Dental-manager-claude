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
        // POL-UI-035 — Product Owner: "ogni volta prima di recepire
        // aggiornamenti impiega tanto e qualche volta non li aggiorna".
        // Root cause: vite-plugin-pwa only auto-sets skipWaiting/clientsClaim
        // for registerType:'autoUpdate' when injectRegister is 'auto' or
        // unset (see its source, generateSW branch) — but POL-UI-029 set
        // injectRegister:false (to register the SW ourselves and show an
        // update banner), which silently opted back OUT of skipWaiting/
        // clientsClaim too. Verified live: the deployed sw.js only listened
        // for a SKIP_WAITING postMessage instead of calling it unconditionally
        // at install — so a new service worker sat in "waiting" and never
        // activated until literally every open tab/PWA instance of the app
        // was closed at once, which a single reload (POL-UI-032) or
        // logout/login essentially never achieves. Setting these explicitly
        // restores the behavior registerType:'autoUpdate' is supposed to
        // have: the new SW takes over as soon as it finishes installing.
        skipWaiting: true,
        clientsClaim: true,
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
