import path from 'node:path'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

/** The landing site. It shares the design system and the preference store with the app
 *  but nothing else: no API client, no router, no audio engine, no service worker.
 *  Port 5174 keeps the two sites apart in development the way two hostnames keep them
 *  apart in production (PRD 7.1.2). */
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
    port: 5174,
  },
  plugins: [react(), tailwindcss()],
})
