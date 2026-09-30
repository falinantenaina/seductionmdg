/// <reference types="vitest/config" />
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    // Le build est servi directement par l'API : backend/public
    outDir: path.resolve(import.meta.dirname, '../backend/public'),
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)/, priority: 20 },
            { name: 'vendor-radix', test: /node_modules[\\/]@radix-ui[\\/]/, priority: 10 },
            { name: 'vendor-data', test: /node_modules[\\/](@tanstack|axios|zod|react-hook-form|@hookform)/, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
