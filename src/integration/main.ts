import { createBrowserEngine } from './engine';
import { syntheticSpl } from '../team-b/analysis';
import { decodeFixture } from '../shared/fixture';
import referenceUrl from '../../fixtures/reference/golden_browser_fixture.json?url';

if (!new URLSearchParams(location.search).has('legacy') && import.meta.env.VITE_ENGINE !== 'reference') {
  const [{ mountLab }, { createLabEngine }, { analyzeLab }] = await Promise.all([
    import('../team-a/lab'), import('./lab-engine'), import('../team-b/lab'),
  ]);
  mountLab(document.querySelector<HTMLElement>('#app')!, { ...createLabEngine(), analyze: analyzeLab });
} else {
const { mountApp } = await import('../team-a/app');
void mountApp(document.querySelector<HTMLElement>('#app')!, {
  engine: createBrowserEngine(), syntheticSpl,
  referenceOnly: import.meta.env.VITE_ENGINE === 'reference',
  async loadReference() {
    const response = await fetch(referenceUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return decodeFixture(await response.json());
  },
});
}
