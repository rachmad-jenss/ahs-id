import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const lightVite = process.env.AHS_ID_LIGHT_VITE === '1';

export default defineConfig({
  site: 'https://ahs-id.jenss.me',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    ...(lightVite
      ? {
          optimizeDeps: {
            noDiscovery: true,
            include: [],
          },
        }
      : {}),
  },
});
