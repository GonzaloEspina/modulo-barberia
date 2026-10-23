import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: { enabled: false },
      workbox: {
        // Keep prompt flow: do not skipWaiting/clientsClaim here — reload happens
        // only after the user confirms via useRegisterSW → updateServiceWorker(true).
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      includeAssets: [
        'pwa-192.png',
        'pwa-512.png',
        'pwa-512-maskable.png',
        'apple-touch-icon.png',
        'favicon-32.png',
        'lomiva-icon.png',
      ],
      manifest: {
        name: 'Barbería',
        short_name: 'Barbería',
        description: 'Gestión de turnos para barberías',
        theme_color: '#141820',
        background_color: '#eef1f6',
        display: 'standalone',
        lang: 'es-AR',
        start_url: '/',
        // ?v= cache-busts aggressive OS/PWA icon caches when assets change.
        icons: [
          { src: '/pwa-192.png?v=20261023b', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png?v=20261023b', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/pwa-512-maskable.png?v=20261023b',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
