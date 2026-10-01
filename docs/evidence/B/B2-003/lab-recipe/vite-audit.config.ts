import { resolve } from 'node:path';
import { defineConfig } from 'vite';
/** Isolated evidence artifact; no product/root build change. */
export default defineConfig({
  build: { outDir: 'test-results/B2-003-lab-browser', emptyOutDir: false,
    rollupOptions: { input: resolve('docs/evidence/B/B2-003/lab-recipe/browser.html') } },
  server: { host: '127.0.0.1' }, preview: { host: '127.0.0.1' },
});
