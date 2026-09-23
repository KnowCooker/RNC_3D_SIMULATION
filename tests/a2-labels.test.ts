import assert from 'node:assert/strict';
import test from 'node:test';
import { placeLabels, placeLabLabels } from '../src/team-a/viewer/labels';

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

test('four source illustrations can share a narrow view with all 12 hardware labels', () => {
  check(Array.from({ length: 16 }, () => ({ x: 180, y: 190 })), 360, 380);
});

test('labels at viewport edges and densely grouped hardware remain clickable', () => {
  for (const x of [0, 180, 360]) for (const y of [0, 190, 380]) {
    check(Array.from({ length: 12 }, (_, i) => ({ x: x + (i % 3), y: y + (i % 4) })), 360, 380);
  }
});

test('lab labels stay on the side rails at full-page size, leaving the vehicle clear', () => {
  const width = 940, height = 510;
  const anchors = Array.from({ length: 16 }, (_, i) => ({ x: 430 + (i % 4) * 16, y: 130 + (i % 8) * 28 }));
  const positions = placeLabLabels(anchors, width, height);
  assert.equal(positions.length, anchors.length);
  positions.forEach((label, i) => positions.slice(i + 1).forEach(other => assert.ok(
    label.x + 64 <= other.x || other.x + 64 <= label.x || label.y + 24 <= other.y || other.y + 24 <= label.y)));
  positions.forEach(position => assert.ok(position.x === 4 || position.x === width - 68));
  assert.deepEqual(placeLabLabels(anchors, width, height), positions);
});

test('lab side rails remain separate and clickable in a narrow 360 px viewer', () => {
  const anchors = Array.from({ length: 16 }, () => ({ x: 180, y: 190 }));
  const positions = placeLabLabels(anchors, 360, 380);
  assert.equal(positions.length, 16);
  positions.forEach((label, i) => {
    assert.ok(label.x === 4 || label.x === 292);
    assert.ok(label.y >= 4 && label.y + 24 <= 380);
    positions.slice(i + 1).forEach(other => assert.ok(
      label.x + 64 <= other.x || other.x + 64 <= label.x || label.y + 24 <= other.y || other.y + 24 <= label.y));
  });
});
