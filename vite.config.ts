import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
  },
  build: {
    outDir: 'dist',
    minify: 'terser',
    assetsInlineLimit: 0, // Don't inline assets as base64
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});