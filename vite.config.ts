import { defineConfig } from 'vite';

// Standalone build for the matrix-fx demo. The library itself is plain
// TypeScript with no build step required — consumers import `src/index.ts`
// directly (or via a path alias). This config only powers the demo page.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 5180,
    strictPort: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
