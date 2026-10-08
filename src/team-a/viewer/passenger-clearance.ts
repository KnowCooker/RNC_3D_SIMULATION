import * as THREE from 'three';

export interface CabinObstacle { min: THREE.Vector3; max: THREE.Vector3; name: string; part: string; torus?: {radius:number;tube:number;inverse:THREE.Matrix4;scale:number} }
export interface SeatClearance {
  origin: THREE.Vector3; roof: number; maxWidth: number;
  floor: number; obstacles: readonly CabinObstacle[];
}
export interface SeatedPlacement { position: THREE.Vector3; scale: number; legScale: number; collisions: number; maxPenetration: number; contacts?: readonly CabinObstacle[] }
const GAP = .006;
const CONTACT_LIMIT = .035;

/** Small static clothing/hand corrections only; never remove geometry or hide a large collision. */
function relaxContact(p:THREE.Vector3,obstacles:readonly CabinObstacle[]) {
  const local=new THREE.Vector3(), original=p.clone();
  for(let pass=0;pass<3;pass++)for(const b of obstacles){
    if(p.x<=b.min.x-GAP||p.x>=b.max.x+GAP||p.y<=b.min.y-GAP||p.y>=b.max.y+GAP||p.z<=b.min.z-GAP||p.z>=b.max.z+GAP)continue;
    if(b.torus){
      local.copy(p).applyMatrix4(b.torus.inverse);const radius=Math.hypot(local.x,local.y),center=new THREE.Vector3(local.x*b.torus.radius/radius,local.y*b.torus.radius/radius,0);
      const normal=local.clone().sub(center),length=normal.length(),limit=b.torus.tube+GAP/b.torus.scale;
      if(length>=limit||!radius)continue;
      if(length<1e-8)normal.set(0,0,1);else normal.divideScalar(length);
      p.copy(center.addScaledVector(normal,limit+.0001)).applyMatrix4(b.torus.inverse.clone().invert());
    }else{
      const distances=[p.x-b.min.x+GAP,b.max.x-p.x+GAP,p.y-b.min.y+GAP,b.max.y-p.y+GAP,p.z-b.min.z+GAP,b.max.z-p.z+GAP];
      const d=Math.min(...distances);if(d>CONTACT_LIMIT)continue;
      const face=distances.indexOf(d),axis=Math.floor(face/2);p.setComponent(axis,p.getComponent(axis)+(face%2?1:-1)*(d+.0001));
    }
  }
  // Several neighboring envelopes must not accumulate an unbounded deformation.
  return p.distanceToSquared(original)>CONTACT_LIMIT*CONTACT_LIMIT?p.copy(original):p;
}

/** Fold the lower seated silhouette into the actual footwell, preserving pelvis/torso/head.
 * A bounded, smooth retarget of the baked pose; it is not a physical clothing simulation. */
export function seatedPoint(point: THREE.Vector3, fit: SeatedPlacement, target = new THREE.Vector3()) {
  target.copy(point).multiplyScalar(fit.scale);
  const knee = -.12 * fit.scale;
  if (target.y < knee) target.y = knee + (target.y - knee) * fit.legScale;
  target.add(fit.position);
  return fit.contacts?relaxContact(target,fit.contacts):target;
}

export function clearanceViolations(points: readonly THREE.Vector3[], fit: SeatedPlacement, seat: SeatClearance, limit=Infinity) {
  let count = 0, maxPenetration = 0, cost = 0;
  const p = new THREE.Vector3(),local=new THREE.Vector3();
  for (const point of points) {
    seatedPoint(point,fit,p);
    let depth = Math.max(0, seat.floor + GAP - p.y, p.y - (seat.roof - .035));
    for (const b of seat.obstacles) {
      if (p.x > b.min.x-GAP && p.x < b.max.x+GAP && p.y > b.min.y-GAP && p.y < b.max.y+GAP && p.z > b.min.z-GAP && p.z < b.max.z+GAP) {
        if(b.torus){local.copy(p).applyMatrix4(b.torus.inverse);const d=Math.hypot(Math.hypot(local.x,local.y)-b.torus.radius,local.z);depth=Math.max(depth,(b.torus.tube-d)*b.torus.scale+GAP);continue;}
        depth = Math.max(depth, Math.min(p.x-b.min.x+GAP,b.max.x-p.x+GAP,p.y-b.min.y+GAP,b.max.y-p.y+GAP,p.z-b.min.z+GAP,b.max.z-p.z+GAP));
      }
    }
    if (depth > .00001) { count++; maxPenetration=Math.max(maxPenetration,depth); cost+=depth*depth;if(count>=limit)return {count,maxPenetration,cost}; }
  }
  return { count, maxPenetration, cost };
}

/** Search only once on seat/character changes, never on the playback clock. */
export function solveSeatedPlacement(points: readonly THREE.Vector3[], bounds: THREE.Box3, seat: SeatClearance, hipOffset: number, verify:readonly THREE.Vector3[]=points): SeatedPlacement {
  // Source hip origins differ; measure the actual pelvis/clothing underside, not a fixed lift.
  const pelvis=points.filter(p=>Math.abs(p.x)<.15&&p.z>-.13&&p.z<.16&&p.y<.10);
  hipOffset=Math.max(hipOffset,-Math.min(...pelvis.map(p=>p.y))+.042);
  const roofScale=(seat.roof-.04-seat.origin.y)/(bounds.max.y+hipOffset);
  const widthScale=seat.maxWidth/(bounds.max.x-bounds.min.x);
  const initial=Math.min(1,roofScale,widthScale);
  let best: SeatedPlacement | undefined, bestScore=Infinity;
  for(let step=0;step<=12;step++) {
    const scale=initial*(1-step*.025);
    let bestAtScale: SeatedPlacement | undefined, scaleScore=Infinity;
    for(const dy of [0,.018,-.018,.036,-.036]){
    const y=seat.origin.y+hipOffset*scale+dy;
    if(y+bounds.max.y*scale>seat.roof-.035)continue;
    const knee=-.12*scale, drop=Math.min(0,bounds.min.y*scale-knee);
    const legScale=drop<0?Math.min(1,Math.max(.2,(seat.floor+.01-y-knee)/drop)):1;
    for(const dz of [0,.02,-.02,.04,-.04,.06,-.06,.08,.10,.12,.14,.16,.18,.20]) {
      const candidate:SeatedPlacement={position:new THREE.Vector3(seat.origin.x,y,seat.origin.z+dz),scale,legScale,collisions:0,maxPenetration:0};
      let hit=clearanceViolations(points,candidate,seat,32);
      if(hit.count===0)hit=clearanceViolations(verify,candidate,seat,32);
      candidate.collisions=hit.count;candidate.maxPenetration=hit.maxPenetration;
      const score=hit.cost*10000+hit.count*.025+(1-scale)*.08+Math.abs(dz-.05)*.01;
      if(score<bestScore){best=candidate;bestScore=score;}
      if(score<scaleScore){bestAtScale=candidate;scaleScore=score;}
      if(hit.count===0) return candidate;
    }
    }
    // A shallow skirt/finger contact should not shrink an adult into a child-sized silhouette.
    // Prefer the current proportion when bounded contact correction clears every vertex.
    if(bestAtScale){
      const relaxed={...bestAtScale,contacts:seat.obstacles};
      const remaining=clearanceViolations(verify,relaxed,seat);
      if(remaining.count===0)return {...relaxed,collisions:0,maxPenetration:0};
    }
  }
  // Fine adjustment around the safest coarse pose. All vertices verify the winning pose.
  const anchor=best!;
  for(const ratio of [1,.98,.96])for(const dy of [0,.012,-.012,.024,-.024,.036,-.036])for(const dz of [0,-.01,.01,-.02,.02,-.04,.04,-.06,.06])for(const dx of [0,-.018,.018,-.035,.035]){
    const candidate={...anchor,position:anchor.position.clone().add(new THREE.Vector3(dx,dy,dz)),scale:anchor.scale*ratio};
    if(candidate.position.y+bounds.max.y*candidate.scale>seat.roof-.035)continue;
    const knee=-.12*candidate.scale,drop=Math.min(0,bounds.min.y*candidate.scale-knee);
    candidate.legScale=drop<0?Math.min(1,Math.max(.2,(seat.floor+.01-candidate.position.y-knee)/drop)):1;
    let hit=clearanceViolations(points,candidate,seat,32);
    if(hit.count===0)hit=clearanceViolations(verify,candidate,seat,32);
    if(hit.count===0)return {...candidate,collisions:0,maxPenetration:0};
  }
  const relaxed={...best!,contacts:seat.obstacles};
  const remaining=clearanceViolations(verify,relaxed,seat);
  return {...relaxed,collisions:remaining.count,maxPenetration:remaining.maxPenetration};
}

/** Sample the actual mesh surfaces and retarget only each seat's private geometry. */
export function fitPassengerGeometry(group: THREE.Group, seat: SeatClearance, hipOffset: number) {
  group.updateMatrixWorld(true);
  const entries: { mesh: THREE.Mesh; matrix: THREE.Matrix4; inverse: THREE.Matrix4 }[]=[];
  const samples=new Map<string,THREE.Vector3>(), all:THREE.Vector3[]=[], bounds=new THREE.Box3(), p=new THREE.Vector3();
  const rootInverse=group.matrixWorld.clone().invert();
  group.traverse(o=>{if(o instanceof THREE.Mesh){
    const matrix=rootInverse.clone().multiply(o.matrixWorld), inverse=matrix.clone().invert(); entries.push({mesh:o,matrix,inverse});
    const pos=o.geometry.getAttribute('position');
    for(let i=0;i<pos.count;i++){
      p.fromBufferAttribute(pos,i).applyMatrix4(matrix);bounds.expandByPoint(p);
      all.push(p.clone());
      const key=[p.x,p.y,p.z].map(v=>Math.round(v/.022)).join('/');if(!samples.has(key))samples.set(key,p.clone());
    }
  }});
  const fit=solveSeatedPlacement([...samples.values()],bounds,seat,hipOffset,all);
  // Scale/translation stay on the group. Lower-leg retargeting and any small contact corrections are baked into private meshes.
  const changed=new Set<THREE.BufferGeometry>();
  for(const {mesh,matrix,inverse} of entries){
    if(fit.legScale>=1&&!fit.contacts)continue;
    mesh.geometry=mesh.geometry.clone();changed.add(mesh.geometry);
    const pos=mesh.geometry.getAttribute('position');
    for(let i=0;i<pos.count;i++){
      p.fromBufferAttribute(pos,i).applyMatrix4(matrix);
      seatedPoint(p,fit,p).sub(fit.position).divideScalar(fit.scale);
      p.applyMatrix4(inverse);pos.setXYZ(i,p.x,p.y,p.z);
    }
    pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  }
  group.scale.setScalar(fit.scale);group.position.copy(fit.position);
  group.userData.clearance={scale:fit.scale,legScale:fit.legScale,collisions:fit.collisions,maxPenetration:fit.maxPenetration};
  return {...fit,disposeGeometry(){changed.forEach(g=>g.dispose());changed.clear();}};
}
