import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // Enables Jest-like global test functions (test, expect)
    environment: 'node', // jsdom@27 has ESM/CSS issues with vitest 1.x — opt in per-file with `// @vitest-environment jsdom` for component tests
    setupFiles: './src/setupTests.ts', // Equivalent to Jest's setup file
  },
  build: {
    chunkSizeWarningLimit: 1600,
    outDir: "./build",
  },
  base: '',
});
