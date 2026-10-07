import * as THREE from 'three';
import { registeredVehicleLayout } from '../../shared/lab-contracts';
import type { ShowroomModel } from './showroom-model';
import { createPassengerModel, isPassenger, type PassengerId } from './passenger-model';
import type { AssetSectionAxis } from './asset-inspection';

export interface PassengerSeat { id: string; label: string; row: number; column: number; driver?: boolean }
export type PassengerAssignments = Readonly<Record<string, PassengerId | null>>;
type Mount = PassengerSeat & { parent: THREE.Object3D; origin: THREE.Vector3; roof: number; maxWidth: number };

/** Detailed meshes are hip-centered: allow pelvis thickness above the cushion.
 * Use the actual row spacing and retain head/floor clearance during fitting. */
export function passengerFit(mount: Pick<Mount, 'origin' | 'roof' | 'maxWidth'>, bounds: THREE.Box3, detailed: boolean, hipOffset = 0) {
  const position = mount.origin.clone();
  if (detailed) { position.y += hipOffset; position.z -= .10; }
  const scale = Math.min(1, (mount.roof - .035 - position.y) / (bounds.max.y + .003), detailed ? mount.maxWidth / (bounds.max.x - bounds.min.x) : 1, detailed && bounds.min.y < 0 ? (position.y - .22) / -bounds.min.y : 1);
  return { position, scale };
}

/** Mount to authored cushion geometry, not microphone coordinates or guessed seat counts. */
export function passengerMounts(model: ShowroomModel): Mount[] {
  const layout = registeredVehicleLayout(model.assetId); if (!layout) return [];
  const seats = model.parts.filter(p => /^seat-\d-\d$/.test(p.id));
  return seats.flatMap(p => {
    const parent = model.group.getObjectByName(p.id), cushion = parent?.getObjectByName('contoured-seat-cushion');
    if (!parent || !(cushion instanceof THREE.Mesh)) return [];
    const [, r, c] = p.id.split('-'), row = Number(r), column = Number(c);
    const count = seats.filter(s => s.id.startsWith(`seat-${row}-`)).length;
    cushion.geometry.computeBoundingBox(); const top = cushion.geometry.boundingBox!.max.y;
    cushion.updateWorldMatrix(true, false); parent.updateWorldMatrix(true, false);
    const origin = parent.worldToLocal(cushion.localToWorld(new THREE.Vector3(0, top + .015, .0)));
    return [{ id: p.id, label: row === 1 ? column === 1 ? '主驾' : '副驾' : `${row === 2 ? '二' : '三'}排${column === 1 ? '左座' : column === count ? '右座' : '中座'}`, driver: p.id === 'seat-1-1', row, column, parent, origin, roof: layout.layout.roof, maxWidth: count >= 3 ? .50 : .64 }];
  });
}

export function createPassengerCabin(options: { loadDetailed?: (id: PassengerId, driver: boolean) => Promise<ReturnType<typeof createPassengerModel>>; onChange?: () => void } = {}) {
  let model: ShowroomModel | null = null, mounts: Mount[] = [], visible = true;
  const occupants = new Map<string, ReturnType<typeof createPassengerModel>>();
  let axis: AssetSectionAxis = 'none', coordinate = 0;
  const clear = () => { occupants.forEach(o => o.dispose()); occupants.clear(); };
  function mountCharacter(mount: Mount, o: ReturnType<typeof createPassengerModel>) {
    const bounds = new THREE.Box3().setFromObject(o.group);
    const detailed = o.group.userData.assetStatus === 'detailed';
    const { position, scale } = passengerFit(mount, bounds, detailed, Number(o.group.userData.seatedHipOffset) || 0);
    o.group.scale.setScalar(scale); o.group.position.copy(position); o.group.visible = visible;
    o.group.userData.seatId = mount.id; mount.parent.add(o.group); o.setSection(axis, coordinate); occupants.set(mount.id, o);
  }
  return {
    get assetId() { return model?.assetId ?? ''; },
    get seats(): PassengerSeat[] { return mounts.map(({ id, label, row, column, driver }) => ({ id, label, row, column, driver })); },
    get quality() { return Array.from(occupants, ([seat, o]) => ({ seat, status: o.group.userData.assetStatus as 'basic' | 'loading' | 'detailed' })); },
    attach(next: ShowroomModel | null) {
      if (model === next) return; clear(); model = next; mounts = next ? passengerMounts(next) : [];
    },
    setAssignments(value: PassengerAssignments) {
      // Validate before mutating so a stale/invalid call cannot partially change the cabin.
      for (const [seat, id] of Object.entries(value)) if (!mounts.some(m => m.id === seat) || id !== null && !isPassenger(id)) throw new Error('Invalid passenger seat or character');
      for (const mount of mounts) {
        const id = value[mount.id] ?? null, old = occupants.get(mount.id);
        if (old?.group.userData.passengerId === id) continue;
        old?.dispose(); occupants.delete(mount.id); if (!id) continue;
        const o = createPassengerModel(id, mount.driver); mountCharacter(mount, o);
        if (options.loadDetailed) {
          o.group.userData.assetStatus = 'loading';
          void options.loadDetailed(id, !!mount.driver).then(detailed => {
            if (occupants.get(mount.id) !== o) { detailed.dispose(); return; }
            o.dispose(); mountCharacter(mount, detailed); options.onChange?.();
          }, () => { if (occupants.get(mount.id) === o) { o.group.userData.assetStatus = 'basic'; options.onChange?.(); } });
        }
      }
    },
    setVisible(value: boolean) { visible = value; occupants.forEach(o => o.group.visible = value); },
    setSection(next: AssetSectionAxis, value: number) { axis = next; coordinate = value; occupants.forEach(o => o.setSection(next, value)); },
    position(id: string) { const mount = mounts.find(m => m.id === id); return mount ? mount.parent.localToWorld(mount.origin.clone()) : null; },
    animate(time: number, reduced: boolean) { if (visible) occupants.forEach(o => o.animate(time, reduced)); },
    dispose() { clear(); model = null; mounts = []; },
  };
}
