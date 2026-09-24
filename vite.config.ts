import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { APP_NAME } from './src/config.ts';

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    plugins: [
      react(),
      { name: 'app-name', transformIndexHtml: (html: string) => html.replace(/%APP_NAME%/g, APP_NAME) },
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: APP_NAME,
              short_name: APP_NAME,
              description: 'Registro de entrenamiento de fuerza: series, progreso e historial.',
              lang: 'es',
              start_url: '/',
              scope: '/',
              display: 'standalone',
              orientation: 'portrait',
              background_color: '#EDEFEB',
              theme_color: '#EDEFEB',
              icons: [
                { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
              ]
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
              navigateFallback: '/index.html',
              cleanupOutdatedCaches: true,
              // Nunca se cachean respuestas de Supabase (auth ni datos): siempre van a la red.
              runtimeCaching: [
                { urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/auth/'), handler: 'NetworkOnly' }
              ]
            }
          })
    ],
    build: single ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000 } : { outDir: 'dist' },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['tests/unit/setup.ts'],
      include: ['tests/unit/**/*.test.{ts,tsx}'],
      css: false
    }
  };
});
