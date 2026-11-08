import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages のサブパスでも動くよう相対パスで出力する
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        // アプリの識別子を明示する（start_url から推測させない）。
        // 一度アンインストールした後に Chrome が古いインストール記録と取り違えるのを避ける
        id: 'math-dojo',
        name: '数理道場',
        short_name: '数理道場',
        description: '確率・統計・線形代数・代数・最適化と C++/Rust を毎日5分で',
        lang: 'ja',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'node',
  },
});
