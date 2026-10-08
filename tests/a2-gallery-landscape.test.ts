import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGalleryTerrainGeometry, galleryLandscapePlacements, galleryTerrainRadii, GALLERY_SHORE_INNER_RADIUS, GALLERY_WATER_LEVEL } from '../src/team-a/viewer/gallery-landscape';
import { galleryHeight } from '../src/team-a/viewer/landscape-height';

const environments = ['coast', 'mountain', 'desert', 'snow'] as const;

test('A2 gallery shore is one upward-facing indexed surface with an identical 360-degree seam', () => {
  for (const env of environments) {
    const mesh = createGalleryTerrainGeometry(env), p = mesh.getAttribute('position'), n = mesh.getAttribute('normal'), index = mesh.getIndex()!;
    const rings = galleryTerrainRadii(), stride = 385;
    assert.equal(p.count, rings.length * stride);
    assert.ok(GALLERY_SHORE_INNER_RADIUS < 27.2, 'shore overlaps beneath the platform fascia');
    assert.ok(index.count > 0);
    for (let r = 0; r < rings.length; r++) {
      const first = r * stride, last = first + stride - 1;
      assert.deepEqual([p.getX(first), p.getY(first), p.getZ(first)], [p.getX(last), p.getY(last), p.getZ(last)]);
      assert.deepEqual([n.getX(first), n.getY(first), n.getZ(first)], [n.getX(last), n.getY(last), n.getZ(last)]);
    }
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); c.fromBufferAttribute(p, index.getX(i + 2));
      assert.ok(b.sub(a).cross(c.sub(a)).y > 0, `${env} triangle ${i / 3} faces downward or degenerates`);
    }
    for (let i = 0; i < p.count; i++) {
      assert.ok(Number.isFinite(p.getY(i))); assert.ok(n.getY(i) > .8);
    }
    mesh.dispose();
  }
});

test('A2 platform perimeter is supported continuously and both stair landings finish above soil and water', () => {
  for (const env of environments) {
    for (let degree = 0; degree < 360; degree++) {
      const angle = degree * Math.PI / 180, y = galleryHeight(27.2 * Math.sin(angle), 27.2 * Math.cos(angle), env);
      assert.ok(y >= -.406 && y <= -.129, `${env} unsupported perimeter at ${degree}`);
      assert.ok(y > -.64, 'soil enters the platform foundation');
    }
    for (const side of [-1, 1]) for (const x of [27.2, 28.5, 30, 31]) for (const z of [-2.1, 0, 2.1]) {
      const y = galleryHeight(side * x, z, env);
      assert.ok(y <= -.4 && y > GALLERY_WATER_LEVEL, `${env} landing soil ${x}/${z} is not a dry foundation`);
      assert.ok(-.36 > y, 'walkway surface remains visible above the soil');
    }
  }
});

test('A2 lake has an irregular continuous shore and low distant relief preserving the photographic skyline', () => {
  for (const env of ['coast', 'mountain'] as const) {
    const crossings: number[] = [];
    for (let degree = 0; degree < 360; degree += 5) {
      const a = degree * Math.PI / 180;
      let crossing = 0;
      for (let r = 28; r < 52; r += .1) {
        const y = galleryHeight(Math.sin(a) * r, Math.cos(a) * r, env);
        if (!crossing && y < GALLERY_WATER_LEVEL) crossing = r;
      }
      assert.ok(crossing > 32 && crossing < 42); crossings.push(crossing);
      for (let r = 150; r <= 640; r += 7) {
        const y = galleryHeight(Math.sin(a) * r, Math.cos(a) * r, env);
        assert.ok(Math.atan2(y, r) < 4 * Math.PI / 180, `${env} near ridge obscures photo at ${degree}/${r}`);
      }
    }
    assert.ok(Math.max(...crossings) - Math.min(...crossings) > 5, 'shore must not appear as a perfect retaining ring');
  }
});

test('A2 deterministic landscape footprints clear the platform and stairs; plants only root on dry land', () => {
  for (const env of environments) for (const kind of ['rock', 'tree', 'grass'] as const) {
    const rows = galleryLandscapePlacements(env, kind, 80);
    assert.deepEqual(rows, galleryLandscapePlacements(env, kind, 80));
    assert.equal(rows.length, (env === 'desert' && kind !== 'rock') || (env === 'coast' && kind === 'tree') ? 0 : 80);
    for (const row of rows) {
      const radius = Math.hypot(row.x, row.z), fullExtent = row.scale * (kind === 'rock' ? 1.17 : 1);
      assert.ok(radius - fullExtent > 27.2);
      assert.ok(Math.abs(row.z) - fullExtent > 2.1 || Math.abs(row.x) - fullExtent > 31);
      assert.equal(row.y, galleryHeight(row.x, row.z, env));
      if ((env === 'coast' || env === 'mountain') && kind !== 'rock') assert.ok(row.y > GALLERY_WATER_LEVEL);
    }
  }
});

test('A2 photographed grassland stays open while alpine trees form varied dry foothill groves', () => {
  assert.equal(galleryLandscapePlacements('coast', 'tree', 240).length, 0);
  assert.equal(galleryLandscapePlacements('coast', 'grass', 80).length, 80);
  assert.equal(galleryLandscapePlacements('coast', 'rock', 80).length, 80);
  for (const env of ['mountain', 'snow'] as const) {
    const trees = galleryLandscapePlacements(env, 'tree', 240);
    assert.equal(trees.length, 240);
    let grouped = 0;
    for (const tree of trees) {
      assert.ok(Math.hypot(tree.x, tree.z) >= 140 && Math.hypot(tree.x, tree.z) <= 235);
      assert.ok(tree.y > .35, 'roots remain on dry raised ground');
      const nearest = Math.min(...trees.filter(other => other !== tree).map(other => Math.hypot(other.x - tree.x, other.z - tree.z)));
      assert.ok(nearest >= 1.4, 'trunks retain distinct planting positions');
      if (nearest < 8) grouped++;
    }
    assert.ok(grouped / trees.length > .9, 'trees should read as groves rather than evenly spaced isolated silhouettes');
    assert.ok(Math.max(...trees.map(tree => tree.scale)) / Math.min(...trees.map(tree => tree.scale)) > 3, 'young and mature trees have different heights');
  }
});
