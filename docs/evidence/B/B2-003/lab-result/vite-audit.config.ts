import { resolve } from 'node:path';
import { defineConfig } from 'vite';
export default defineConfig({
  build: { outDir: 'test-results/B2-003-lab-result-browser', emptyOutDir: false,
    rollupOptions: { input: resolve('docs/evidence/B/B2-003/lab-result/browser.html') } },
  server: { host: '127.0.0.1' }, preview: { host: '127.0.0.1' },
});
