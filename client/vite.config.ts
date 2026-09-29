import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Tạp hóa',
        short_name: 'Tạp hóa',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: { navigateFallbackDenylist: [/^\/api/, /^\/print/] },
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: { host: true, port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
