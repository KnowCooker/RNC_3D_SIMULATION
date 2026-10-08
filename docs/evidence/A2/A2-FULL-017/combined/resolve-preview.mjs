// Temporary composition only: run after merging origin/pr-27 into detached A2 10ae34b.
// Does not modify either published role branch.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const path = process.argv[2];
const source = readFileSync(path, 'utf8');
let count = 0;
const resolved = source.replace(/<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> origin\/pr-27\r?\n/g, (_, ours, theirs) => {
  count++;
  if (ours.includes('lab-disclosure')) {
    const aside = theirs.split(/\r?\n/).find(line => line.includes('<main class='));
    assert.ok(aside);
    return ours.replace('    <main class="lab-main"><aside class="lab-controls">', aside);
  }
  assert.ok(ours.includes('Record<AcousticWeighting, SplFrame[]>'));
  return ours + theirs.split(/\r?\n/).filter(line => line.includes('visualRoad') || line.includes('roadNames')).join('\n') + '\n';
});
assert.equal(count, 2);
assert.ok(!resolved.includes('<<<<<<<'));
writeFileSync(path, resolved);
