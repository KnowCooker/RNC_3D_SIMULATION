import * as THREE from 'three';

export type SurfacePoint = [number, number, number];

/** Normals come from the continuous sheet, not the triangulation diagonal.
 * Independent panels retain their semantic ownership and narrow physical gaps. */
export function coachworkSurface(point: (u: number, v: number) => SurfacePoint, nu: number, nv: number) {
  const positions: number[] = [], uv: number[] = [], normals: number[] = [], indices: number[] = [];
  const epsilon = .0001;
  const du = new THREE.Vector3(), dv = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const u = i / nu, v = j / nv;
    positions.push(...point(u, v)); uv.push(u, v);
    const a = point(Math.max(0, u - epsilon), v), b = point(Math.min(1, u + epsilon), v);
    const c = point(u, Math.max(0, v - epsilon)), d = point(u, Math.min(1, v + epsilon));
    du.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]); dv.set(d[0]-c[0],d[1]-c[1],d[2]-c[2]);
    normal.crossVectors(du,dv).normalize(); normals.push(...normal.toArray());
  }
  for (let i=0;i<nu;i++) for(let j=0;j<nv;j++) {
    const a=i*(nv+1)+j,b=a+nv+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const fallback=g.getAttribute('normal');
  for(let i=0;i<normals.length;i+=3)if(Math.hypot(normals[i],normals[i+1],normals[i+2])<.5){
    normals[i]=fallback.getX(i/3);normals[i+1]=fallback.getY(i/3);normals[i+2]=fallback.getZ(i/3);
  }
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return g;
}

/** Small corner radii for moulded lamp surrounds and intake apertures. */
export function roundedTrim(points: number[][], radius=.018): number[][] {
  return points.flatMap((p,i)=>{
    const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
    const a=new THREE.Vector2(...prev as [number,number]).sub(new THREE.Vector2(...p as [number,number]));
    const b=new THREE.Vector2(...next as [number,number]).sub(new THREE.Vector2(...p as [number,number]));
    const r=Math.min(radius,a.length()*.2,b.length()*.2);a.setLength(r);b.setLength(r);
    return Array.from({length:5},(_,j)=>{const t=j/4;return [p[0]+(1-t)**2*a.x+t*t*b.x,p[1]+(1-t)**2*a.y+t*t*b.y];});
  });
}
