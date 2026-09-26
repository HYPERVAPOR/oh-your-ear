import path from 'node:path'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    // Production-shaped hostnames for the cross-site preference path: see the
    // note in packages/shared/src/prefs.ts for the --host-resolver-rules line.
    allowedHosts: ['localhost', '.oye.test'],
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Full-page navigations to the API have to reach the network. The
        // service worker's navigation fallback would otherwise answer them
        // with index.html, which turns the Google sign-in start (and the
        // callback Google sends people back to) into the app's own 404 page.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Oh Your Ear',
        short_name: 'OYE',
        description: 'Responsive web-based ear training',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
})
