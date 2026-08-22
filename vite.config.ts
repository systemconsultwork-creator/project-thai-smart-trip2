import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },

  server: {
    port: 5173,

    // Proxy API requests to Express backend
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },

    // Hot Module Replacement
    hmr: process.env.DISABLE_HMR !== 'true',

    // File watching
    watch: process.env.DISABLE_HMR === 'true'
      ? null
      : {},
  },
});