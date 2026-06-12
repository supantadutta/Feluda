/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** Vite config for the Feluda PWA front end (Layer I). */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // No bundled icon assets yet (Phase 0); the dashboard polish in Phase 7
      // ships proper icons. Manifest is valid without them for dev.
      manifest: {
        name: 'Feluda — Investigative Reasoning Assistant',
        short_name: 'Feluda',
        description: 'A calm, rigorous investigator that shows its work.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
