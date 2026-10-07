import { passengerHipOffset, type PassengerId } from '../../../src/team-a/viewer/passenger-model';
/** Offline production-car geometry/seat transforms, no browser involved. */
import { writeFile, mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createXPengModel } from '../../../src/team-a/viewer/xpeng-model';
import { passengerMounts, passengerFit } from '../../../src/team-a/viewer/passenger-cabin';
import { readFile } from 'node:fs/promises';
class BlobReader {
  result: ArrayBuffer | string | null = null; onloadend?: () => void;
  readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(b => { this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`; this.onloadend?.(); }); }
}
Object.defineProperty(globalThis, 'FileReader', { value: BlobReader });
const work = 'output/passenger-v3'; await mkdir(work, { recursive: true });
const car = createXPengModel('gx'); car.inspection.setBody('hidden');
const poses = JSON.parse(await readFile(`${work}/posed-audit.json`, 'utf8')) as {id: string; driver: boolean; min: number[]; max: number[]}[];
const mounts = passengerMounts(car).map(m => {
  const fits = poses.filter(p => p.driver === m.driver).map(p => {
    const bounds = new THREE.Box3(new THREE.Vector3(p.min[0],p.min[2],-p.max[1]),new THREE.Vector3(p.max[0],p.max[2],-p.min[1]));
    const fit = passengerFit(m, bounds, true, passengerHipOffset(p.id as PassengerId));
    return { id: p.id, scale: fit.scale, world: m.parent.localToWorld(fit.position).toArray() };
  });
  return { id: m.id, driver: m.driver, roof: m.roof, fits };
});
await writeFile(`${work}/cabin-mounts.json`, JSON.stringify(mounts, null, 2));
const copies = new Set<THREE.Material>();
car.group.traverse(o => { if (o instanceof THREE.Mesh) {
  const copy = (m: THREE.Material) => { const n = m.clone(); for (const key of Object.keys(n)) if (key === 'map' || key.endsWith('Map')) (n as unknown as Record<string, unknown>)[key] = null; copies.add(n); return n; };
  o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
} });
const glb = await new GLTFExporter().parseAsync(car.group, { binary: true, onlyVisible: true, trs: true });
await writeFile(`${work}/gx-cabin.glb`, Buffer.from(glb as ArrayBuffer));
car.dispose(); copies.forEach(m => m.dispose()); console.log('GX geometry and actual seat transforms exported.');
