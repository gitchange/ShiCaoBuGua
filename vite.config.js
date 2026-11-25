import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { recordsPlugin } from './server/recordsPlugin.js';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    recordsPlugin(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
