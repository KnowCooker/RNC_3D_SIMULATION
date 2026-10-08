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

test('lab callouts stay beside the projected hardware instead of the full viewport edges', () => {
  const width = 940, height = 510;
  const anchors = Array.from({ length: 16 }, (_, i) => ({ x: 430 + (i % 4) * 16, y: 130 + (i % 8) * 28 }));
  const positions = placeLabLabels(anchors, width, height);
  assert.equal(positions.length, anchors.length);
  positions.forEach((label, i) => positions.slice(i + 1).forEach(other => assert.ok(
    label.x + 64 <= other.x || other.x + 64 <= label.x || label.y + 24 <= other.y || other.y + 24 <= label.y)));
  positions.forEach(position => {
    assert.ok(!position.hidden);
    assert.ok(position.x + 64 < 430 || position.x > 478, 'callouts stay outside the projected cabin');
    assert.ok(position.x > 200 && position.x < 650, 'leaders must not span the full screen');
  });
  assert.deepEqual(placeLabLabels(anchors, width, height), positions);
});

test('near-car labels remain separate and clickable in a narrow 360 px viewer', () => {
  const anchors = Array.from({ length: 16 }, () => ({ x: 180, y: 190 }));
  const positions = placeLabLabels(anchors, 360, 380);
  assert.equal(positions.length, 16);
  positions.forEach((label, i) => {
    assert.ok(!label.hidden && label.x >= 4 && label.x + 64 <= 360);
    assert.ok(label.y >= 4 && label.y + 24 <= 380);
    positions.slice(i + 1).forEach(other => assert.ok(
      label.x + 64 <= other.x || other.x + 64 <= label.x || label.y + 24 <= other.y || other.y + 24 <= label.y));
  });
});

test('720p structure panels and transport never cover the 16 hardware callouts', () => {
  const obstacles = [{ x:24, y:20, width:210, height:435 }, { x:936, y:20, width:320, height:400 },
    { x:24, y:556, width:1232, height:66 }, {x:480,y:18,width:245,height:40}];
  const anchors = Array.from({ length:16 }, (_,i) => ({ x:390+(i%4)*82, y:245+Math.floor(i/4)*35 }));
  const positions = placeLabLabels(anchors,1280,648,obstacles);
  positions.forEach((p,i) => {
    assert.ok(!p.hidden);
    assert.ok(Math.hypot(p.x+32-anchors[i].x,p.y+12-anchors[i].y)<255, 'short, local correspondence');
    obstacles.forEach(q => assert.ok(p.x+64<=q.x || q.x+q.width<=p.x || p.y+24<=q.y || q.y+q.height<=p.y));
    positions.slice(i+1).forEach(q => assert.ok(p.x+64<=q.x || q.x+64<=p.x || p.y+24<=q.y || q.y+24<=p.y));
  });
});

test('a completely obstructed viewport does not put an invisible clickable label behind its panel', () => {
  const [position] = placeLabLabels([{x:180,y:190}],360,380,[{x:0,y:0,width:360,height:380}]);
  assert.equal(position.hidden,true);
});
