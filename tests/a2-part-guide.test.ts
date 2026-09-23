import assert from 'node:assert/strict';
import test from 'node:test';
import { describeVehiclePart, featuredVehicleParts } from '../src/team-a/viewer/part-guide';
import { createVehicleModel, type VehicleKind } from '../src/team-a/viewer/vehicle-model';

test('featured structures exist in each generated architecture and explain its actual drive path', () => {
  const expected: Record<VehicleKind, string[]> = {
    ice: ['combustion-engine', 'transmission', 'fuel-tank', 'exhaust'],
    bev: ['traction-battery', 'inverter', 'traction-motor-rear', 'charge-system'],
    hev: ['combustion-engine', 'power-split', 'traction-motor-front', 'traction-battery'],
    erev: ['combustion-engine', 'range-generator', 'traction-battery', 'traction-motor-rear'],
  };
  for (const kind of Object.keys(expected) as VehicleKind[]) {
    const model = createVehicleModel(kind);
    const featured = featuredVehicleParts(kind, model.parts);
    const ids = featured.map(part => part.object.name);
    for (const id of expected[kind]) assert.ok(ids.includes(id), `${kind} exposes ${id}`);
    assert.ok(featured.every(part => model.parts.includes(part)), `${kind} offers only actual parts`);
    assert.ok(featured.every(part => {
      const guide = describeVehiclePart(kind, part);
      return guide.title === part.name && !!guide.role && !!guide.path && guide.sourceUrl.startsWith('https://');
    }));
    if (kind === 'bev') assert.ok(!ids.some(id => ['combustion-engine', 'fuel-tank', 'exhaust'].includes(id)));
    if (kind === 'erev') {
      const guide = describeVehiclePart(kind, featured.find(part => part.object.name === 'combustion-engine')!);
      assert.match(guide.role, /仅与发电机机械连接/);
      assert.match(guide.path, /不机械驱动车轮/);
    }
    if (kind === 'hev') assert.match(describeVehiclePart(kind, featured.find(part => part.object.name === 'power-split')!).role, /机械功率分流/);
    model.dispose();
  }
});
