import { mountApp } from '../team-a/app';
import { createBrowserEngine } from './engine';
import { syntheticSpl } from '../team-b/analysis';
import { decodeFixture } from '../shared/fixture';
import referenceUrl from '../../fixtures/reference/golden_browser_fixture.json?url';

void mountApp(document.querySelector<HTMLElement>('#app')!, {
  engine: createBrowserEngine(), syntheticSpl,
  referenceOnly: import.meta.env.VITE_ENGINE === 'reference',
  async loadReference() {
    const response = await fetch(referenceUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return decodeFixture(await response.json());
  },
});
