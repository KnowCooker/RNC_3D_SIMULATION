import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** Isolated production verification artifact; no product build/config changes. */
export default defineConfig({
  build: { outDir: 'test-results/B2-003-async-browser', emptyOutDir: false,
    rollupOptions: { input: resolve('docs/evidence/B/B2-003/async-api/browser.html') } },
  server: { host: '127.0.0.1' }, preview: { host: '127.0.0.1' },
});
