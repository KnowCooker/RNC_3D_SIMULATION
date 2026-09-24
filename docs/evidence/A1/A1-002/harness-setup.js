// Playwright CLI run-code callback. Test-only AppPorts transport; never shipped by Vite.
// The fixture supplies real buffers, but computed envelopes below are injected ONLY to
// test UI request ordering and identity validation, not numerical correctness.
async (page) => {
  await page.route('**/a1-state-harness*', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="zh"><meta charset="UTF-8"><title>A1 request harness</title><div id="app"></div>
    <script type="module">
      import { mountApp } from '/src/team-a/app/index.ts';
      import { decodeFixture } from '/src/shared/fixture.ts';
      import { analyzeAt, syntheticSpl } from '/src/team-b/analysis/index.ts';
      const fixture = decodeFixture(await (await fetch('/fixtures/reference/golden_browser_fixture.json')).json());
      const query = new URLSearchParams(location.search);
      const test = window.__a1Test = { calls: [], loads: [], cancels: 0 };
      function deferred(queue, extra = {}) {
        return new Promise((resolve, reject) => queue.push({ ...extra, resolve, reject }));
      }
      test.settle = (kind, index, outcome, change = {}) => {
        const task = test[kind][index];
        if (outcome === 'reject') { task.reject(change.error); return; }
        const next = kind === 'calls'
          ? { ...fixture, runId: task.id, config: task.config, source: 'computed-browser', computeMilliseconds: 1 }
          : { ...fixture };
        task.resolve({ ...next, ...change, config: { ...next.config, ...change.config } });
      };
      let first = true;
      void mountApp(document.querySelector('#app'), {
        engine: {
          calculate: (config, id) => deferred(test.calls, { config, id }),
          analyzeAt,
          cancel: () => { test.cancels++; }
        }, syntheticSpl, referenceOnly: query.has('referenceOnly'),
        loadReference() {
          if (first && !query.has('delayedInitial')) { first = false; return Promise.resolve(fixture); }
          first = false; return deferred(test.loads);
        }
      });
    </script></html>`
  }));
  await page.goto('http://127.0.0.1:5173/a1-state-harness');
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('就绪'));
  return { url: page.url(), title: await page.title() };
}
