import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const THEME = '#111318';

export default defineConfig(({ mode }) => {
  // Hosting under a sub-path (e.g. GitHub Pages project sites) sets DIAL_IN_BASE=/repo-name/.
  const base = loadEnv(mode, '.', '').DIAL_IN_BASE || '/';
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        // Ask before switching to a new version, so an update never interrupts a round.
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Dial In',
          short_name: 'Dial In',
          description: 'Learn synthesis by ear: hear a sound, then recreate it on the synth.',
          theme_color: THEME,
          background_color: THEME,
          display: 'standalone',
          orientation: 'any',
          categories: ['music', 'education', 'games'],
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Everything the app needs is precached, so it works offline after the first visit.
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
