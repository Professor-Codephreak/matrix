import { defineConfig } from 'vite';

// Standalone build for the matrix-fx demo. The library itself is plain
// TypeScript with no build step required — consumers import `src/index.ts`
// directly (or via a path alias). This config only powers the demo page.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 5180,
    strictPort: false,
    // The CMC keyless feed sends no CORS header, so the browser can't hit it
    // directly. Proxy '/cmc' → the keyless base server-side (no CORS in play).
    proxy: {
      '/cmc': {
        target: 'https://pro-api.coinmarketcap.com/trial-pro-api',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/cmc/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/cmc': {
        target: 'https://pro-api.coinmarketcap.com/trial-pro-api',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/cmc/, ''),
      },
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
