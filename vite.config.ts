import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Ayuda Terremoto Colombia — Puntos de acopio',
        short_name: 'Ayuda Colombia',
        description:
          'Dónde llevar donaciones y qué se necesita en cada punto de acopio tras el terremoto del 10 de agosto de 2026.',
        lang: 'es-CO',
        theme_color: '#0E1A2B',
        background_color: '#EDEFEA',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Los puntos de acopio quedan consultables sin señal: se sirve lo
            // cacheado y se revalida en segundo plano.
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-datos',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapa-teselas',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fuentes',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          // El mapa es el bulto más grande y solo lo necesita quien lo abre.
          mapa: ['leaflet', 'react-leaflet', 'leaflet.markercluster'],
          // Los vendors se separan para que un cambio en el código de la app no
          // invalide el caché de las librerías. Importa: mucha gente entra desde
          // datos móviles y vuelve varias veces al día.
          react: ['react', 'react-dom', 'react-router-dom'],
          datos: ['@supabase/supabase-js', '@tanstack/react-query'],
          animacion: ['motion'],
        },
      },
    },
  },
})
