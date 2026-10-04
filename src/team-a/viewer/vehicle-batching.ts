import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Batch only anonymous, static meshes WITHIN one detachable assembly and material.
 * Named pick targets, acoustic hardware, child transforms and wheel calipers stay intact.
 */
export function batchVehicleParts(root:THREE.Group,shell:THREE.Mesh[],resources:Set<THREE.BufferGeometry>) {
  const exterior=new Set(shell);
  for(const part of root.children){
    const buckets=new Map<string,THREE.Mesh[]>();
    for(const object of part.children){
      if(!(object instanceof THREE.Mesh)||object.name||object.children.length||Array.isArray(object.material)||Object.keys(object.userData).length)continue;
      const key=[object.material.uuid,exterior.has(object),object.castShadow,object.receiveShadow,object.visible].join('/');
      const list=buckets.get(key)??[];list.push(object);buckets.set(key,list);
    }
    for(const list of buckets.values()){
      if(list.length<2)continue;
      const first=list[0],index=part.children.indexOf(first);
      const inputs=list.map(object=>{
        object.updateMatrix();
        const g=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
        g.clearGroups();g.applyMatrix4(object.matrix);
        if(!g.getAttribute('uv'))g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));
        return g;
      });
      const geometry=mergeGeometries(inputs,false);inputs.forEach(g=>g.dispose());
      if(!geometry)continue;
      resources.add(geometry);
      const merged=new THREE.Mesh(geometry,first.material);merged.castShadow=first.castShadow;merged.receiveShadow=first.receiveShadow;merged.visible=first.visible;
      merged.userData.batchedMeshes=list.length;
      if(exterior.has(first))exterior.add(merged);
      list.forEach(object=>{exterior.delete(object);part.remove(object);});
      part.add(merged);part.children.splice(part.children.indexOf(merged),1);part.children.splice(index,0,merged);
    }
  }
  shell.splice(0,shell.length,...exterior);
  const used=new Set<THREE.BufferGeometry>();root.traverse(o=>{if(o instanceof THREE.Mesh)used.add(o.geometry);});
  for(const g of resources)if(!used.has(g)){g.dispose();resources.delete(g);}
}
