/** Reproduce: pnpm exec tsx docs/design/passengers-3d-v1/export-models.mts
 * Exports the same runtime meshes. Node needs only the asynchronous Blob reader;
 * no browser, DOM, remote assets or renderer is used here. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createPassengerModel, PASSENGERS } from '../../../src/team-a/viewer/passenger-model';
import { createXPengModel } from '../../../src/team-a/viewer/xpeng-model';
import { createPassengerCabin } from '../../../src/team-a/viewer/passenger-cabin';

class BlobReader {
  result: ArrayBuffer | string | null = null;
  onloadend?: () => void;
  readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(b => { this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`; this.onloadend?.(); }); }
}
Object.defineProperty(globalThis, 'FileReader', { value: BlobReader });
const output = resolve('docs/design/passengers-3d-v1/models'); await mkdir(output, { recursive: true });
const audit: unknown[] = [];
async function save(name: string, group: THREE.Group, target = output) {
  // Material micrograin is a runtime procedural effect. The portable exchange
  // files preserve material colours/roughness and geometry, omit texture maps.
  const clones = new Map<THREE.Material, THREE.Material>(); let triangles = 0, draws = 0;
  group.traverse(o => { if (o instanceof THREE.Mesh) {
    const portable = (m: THREE.Material) => { let copy = clones.get(m); if (!copy) { copy = m.clone(); for (const key of Object.keys(copy)) if (key.endsWith('Map') || key === 'map' || key === 'envMap') (copy as unknown as Record<string, unknown>)[key] = null; clones.set(m, copy); } return copy; };
    o.material = Array.isArray(o.material) ? o.material.map(portable) : portable(o.material); draws++; triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
  } });
  const file = await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: true, trs: true });
  await mkdir(target, { recursive: true }); await writeFile(resolve(target, `${name}.glb`), Buffer.from(file as ArrayBuffer));
  audit.push({ name, bytes: (file as ArrayBuffer).byteLength, meshes: draws, triangles, bounds: new THREE.Box3().setFromObject(group), textureMaps: 'omitted in portable GLB only', pose: 'seated static rig' });
  clones.forEach(m => m.dispose());
}
for (const { id } of PASSENGERS) { const model = createPassengerModel(id); await save(id, model.group); model.dispose(); }
const car = createXPengModel('gx'), cabin = createPassengerCabin(); cabin.attach(car);
cabin.setAssignments({ 'seat-1-2': 'niulai', 'seat-2-1': 'ayaka', 'seat-2-2': 'luffy' }); car.inspection.setBody('hidden');
await save('gx-cabin', car.group, resolve('output/passenger-render')); cabin.dispose(); car.dispose();
await writeFile(resolve(output, 'geometry-audit.json'), JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit.map((x: any) => ({ name: x.name, bytes: x.bytes, meshes: x.meshes, triangles: x.triangles })), null, 2));
