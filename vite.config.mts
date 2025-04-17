import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // Enables Jest-like global test functions (test, expect)
    environment: 'jsdom', // Simulates a browser for component tests
    setupFiles: './src/setupTests.ts', // Equivalent to Jest's setup file
  },
  build: {
    chunkSizeWarningLimit: 1600,
    outDir: "./build",
  },
  base: '',
});
