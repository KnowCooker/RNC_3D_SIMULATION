import assert from 'node:assert/strict';
import test from 'node:test';
import { placeLabels } from '../src/team-a/viewer/labels';

function check(anchors: { x: number; y: number }[], width: number, height: number) {
  const labels = placeLabels(anchors, width, height);
  assert.equal(labels.length, anchors.length);
  labels.forEach((label, i) => {
    assert.ok(label.x >= 0 && label.x + 64 <= width && label.y >= 0 && label.y + 24 <= height);
    labels.slice(i + 1).forEach(other => assert.ok(
      label.x + 64 <= other.x || other.x + 64 <= label.x || label.y + 24 <= other.y || other.y + 24 <= label.y,
      'hardware labels must not cover one another'));
  });
  assert.deepEqual(placeLabels(anchors, width, height), labels, 'stable camera must yield stable labels');
}

test('12 coincident projections remain separate and inside the narrow supported viewer', () => {
  check(Array.from({ length: 12 }, () => ({ x: 180, y: 190 })), 360, 380);
});

test('labels at viewport edges and densely grouped hardware remain clickable', () => {
  for (const x of [0, 180, 360]) for (const y of [0, 190, 380]) {
    check(Array.from({ length: 12 }, (_, i) => ({ x: x + (i % 3), y: y + (i % 4) })), 360, 380);
  }
});
