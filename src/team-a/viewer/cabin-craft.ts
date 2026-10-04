import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { coachworkSurface } from './coachwork-surface';
import type { refineVehicleMaterials } from './vehicle-materials';
type V=[number,number,number];

/** Continuous padded dash crown with swept-back ends and analytic normal transport. */
export function sculptDashboard(width:number,height:number,depth:number){
  const g=new RoundedBoxGeometry(width,height,depth,5,Math.min(height,depth)*.42),p=g.getAttribute('position'),n=g.getAttribute('normal');
  const transform=new THREE.Matrix3(),normal=new THREE.Vector3(),half=width/2;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),u=x/half;
    p.setXYZ(i,x,y+.014*(1-u*u)-.025*(z/depth+.5),z-.12*u*u);
    transform.set(1,0,0,-.028*x/(half*half),1,-.025/depth,-.24*x/(half*half),0,1).invert().transpose();
    normal.fromBufferAttribute(n,i).applyMatrix3(transform).normalize();n.setXYZ(i,...normal.toArray());
  }
  g.computeBoundingBox();g.computeBoundingSphere();g.userData.sectionClosed=true;return g;
}

/** Visible trim stays attached to its actual detachable parent; no acoustic anchors move. */
export function createCabinCraft(geometries:Set<THREE.BufferGeometry>,finish:ReturnType<typeof refineVehicleMaterials>) {
  function mesh(parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,pos:V=[0,0,0]){
    geometries.add(g);const o=new THREE.Mesh(g,m);o.position.set(...pos);o.castShadow=o.receiveShadow=true;parent.add(o);return o;
  }
  function box(parent:THREE.Object3D,size:V,pos:V,m:THREE.Material,r=.012){return mesh(parent,new RoundedBoxGeometry(...size,3,Math.min(r,...size.map(x=>x/2))),m,pos);}
  function line(parent:THREE.Object3D,points:V[],r:number,m:THREE.Material){const o=mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),40,r,6,false),m);o.castShadow=r>.004;return o;}
  return {
    seat(back:THREE.Mesh,cushion:THREE.Mesh,width:number,height=.53,depth=.145){
      const backPoint=(u:number,v:number):V=>{
        const y=(-.34+.73*v)*height,vv=y/height+.5,x=(u-.5)*width*.62,uu=x/(width/2);
        return [x*(.84+.16*Math.sin(vv*Math.PI*.84)),y-.018*uu**4*vv,depth/2+.026*(1-uu*uu)*Math.sin(vv*Math.PI)+.0015];
      };
      mesh(back,coachworkSurface(backPoint,24,24),finish.perforated).name='perforated-back-insert';
      // Piping follows the very same deformed surface; no hovering stitched rectangle.
      for(const u of [0,1])line(back,Array.from({length:20},(_,i)=>backPoint(u,i/19)),.0018,finish.satin);
      mesh(cushion,coachworkSurface((u,v)=>{const x=(u-.5)*width*.63,z=(v-.5)*.36,uu=x/(width/2),ww=z/.245;return [x*(.94+.06*(1-ww)/2),.0665+.018*(1-uu*uu)*(1-ww*ww),z];},24,20),finish.perforated).name='perforated-cushion-insert';
      box(back,[width*.76,height*.78,.015],[0,-.018,-depth/2-.004],finish.backShell,.006).name='tailored-seat-rear';
      line(back,[[-width*.25,-height*.15,-depth/2-.014],[0,-height*.17,-depth/2-.022],[width*.25,-height*.15,-depth/2-.014]],.003,finish.satin);
    },
    floor(parent:THREE.Object3D,x:number,y:number,z:number,width=.42){
      box(parent,[width,.012,.55],[x,y,z],finish.carpet,.005).name='woven-floor-mat';
    },
    door(parent:THREE.Object3D,side:number,half:number,belt:number,z:number,length:number){
      const span=Math.max(.28,Math.min(1.05,length)),x=side*(half-.10);
      box(parent,[.024,.062,span],[x,belt-.10,z],finish.wood,.011);
      box(parent,[.017,.009,span*.98],[x-side*.014,belt-.065,z],finish.ambient,.004);
      box(parent,[.028,.026,.15],[x-side*.028,belt-.14,z+span*.23],finish.satin,.011);
      box(parent,[.085,.055,span*.64],[x-side*.035,belt-.32,z],finish.perforated,.024);
      for(let i=0;i<3;i++)box(parent,[.023,.004,.023],[x-side*.057,belt-.290,z+.04+i*.04],finish.satin,.002);
    },
    dashboard(parent:THREE.Object3D,width:number,y:number,z:number){
      box(parent,[width,.042,.034],[0,y-.043,z],finish.wood,.016);
      line(parent,[[-width*.49,y-.016,z-.02],[0,y-.006,z-.042],[width*.49,y-.016,z-.02]],.0025,finish.ambient);
      for(const side of [-1,1])for(let i=0;i<7;i++)box(parent,[.018,.028,.015],[side*width*.36+(i-3)*.025,y-.094,z-.014],finish.satin,.004);
    },
  };
}
