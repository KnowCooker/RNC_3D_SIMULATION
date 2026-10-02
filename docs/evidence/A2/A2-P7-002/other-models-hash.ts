import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createXPengModel } from '../../../../src/team-a/viewer/xpeng-model';
import * as THREE from 'three';
const result: Record<string, string> = {};
for (const id of ['x9', 'l03', 'm03', 'gx'] as const) {
  const model = createXPengModel(id), hash = createHash('sha256');
  model.group.traverse(object => {
    hash.update(object.name + JSON.stringify(object.position.toArray()));
    if (object instanceof THREE.Mesh) {
      hash.update(Buffer.from(object.geometry.getAttribute('position').array.buffer));
      hash.update(JSON.stringify((object.material as THREE.Material).toJSON(), (key, value) => key === 'uuid' ? undefined : value));
    }
  });
  result[id] = hash.digest('hex'); model.dispose();
}
writeFileSync(process.argv[2] ?? 'test-results/p7-other-models-current.json', JSON.stringify(result, null, 2));
