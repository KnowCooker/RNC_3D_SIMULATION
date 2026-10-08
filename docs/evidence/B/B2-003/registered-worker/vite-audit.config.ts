import { resolve } from 'node:path';
import { defineConfig } from 'vite';
export default defineConfig({
  build: { outDir: 'test-results/B2-003-registered-worker', emptyOutDir: false,
    rollupOptions: { input: resolve('docs/evidence/B/B2-003/registered-worker/browser.html') } },
  server: { host: '127.0.0.1' }, preview: { host: '127.0.0.1' },
});
