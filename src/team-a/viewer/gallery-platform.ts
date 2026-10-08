import * as THREE from 'three';
import type { GalleryEnvironment } from './champagne-gallery';

/** Metres in the same frame as the vehicle. The whole group belongs to gallery.floor,
 * so underfloor inspection also hides its foundations and access steps. */
export const galleryPlatformDimensions = {
  radius: 27.2,
  pavingRadius: 26.7,
  top: -.024,
  base: -.64,
  tile: 2.4,
  reflectionRadius: 26.68,
  reflectionHeight: -.0225,
} as const;

/** Original architectural geometry and procedural limestone; no external texture or
 * survey claims. Reflector, if used, sits at reflectionHeight with low alpha. */
export function createGalleryPlatform() {
  const group = new THREE.Group(); group.name = 'gallery-built-platform';
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  let disposed = false;
  const stone = (color: string, roughness = .74, metalness = 0) => {
    const material = new THREE.MeshPhysicalMaterial({ color, roughness, metalness });
    materials.add(material); return material;
  };
  const finishMaterial = stone('#d5c8b6', .68, .015);
  finishMaterial.name = 'honed-limestone-paving';
  finishMaterial.envMapIntensity = .42;
  const edging = stone('#bfb49f', .76), foundation = stone('#a89e8c', .93);
  const recessed = stone('#797567', .98), drain = stone('#363f3a', .91, .2), grate = stone('#6c7167', .65, .45);
  const stepStone = stone('#c7baa3', .78), expansion = stone('#736e61', .96);

  // World-space, 2.4 m slabs. Joint filtering follows the pixel footprint, rather
  // than shimmering geometry lines or a large repeated marble photograph.
  finishMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPaving;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaving=(modelMatrix*vec4(transformed,1.)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vPaving;
        float pavingHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float pavingNoise(vec2 p) {
          vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(pavingHash(i),pavingHash(i+vec2(1.,0.)),f.x),
            mix(pavingHash(i+vec2(0.,1.)),pavingHash(i+vec2(1.,1.)),f.x),f.y);
        }
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 slab=vPaving/2.4+vec2(.31,.17), local=fract(slab);
        vec2 edge=min(local,1.-local)*2.4;
        float footprint=max(length(fwidth(vPaving))*.7,.0005);
        float joint=1.-smoothstep(.002,.005+footprint,min(edge.x,edge.y));
        float slabTone=pavingHash(floor(slab));
        float cloud=pavingNoise(vPaving*1.7)*.65+pavingNoise(vPaving*6.9)*.35;
        float grain=(pavingNoise(vPaving*85.)-.5)/(1.+footprint*220.);
        diffuseColor.rgb*=.92+.09*cloud+.055*slabTone+.025*grain;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.69,joint*.75);
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor+joint*.13+(cloud-.5)*.07,.60,.96);
      `);
  };
  finishMaterial.customProgramCacheKey = () => 'gallery-limestone-world-grid-v1';

  function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position?: [number, number, number]) {
    geometries.add(geometry); const object = new THREE.Mesh(geometry, material);
    object.name = name; if (position) object.position.set(...position);
    object.receiveShadow = object.castShadow = true; group.add(object); return object;
  }
  function ring(name: string, inner: number, outer: number, y: number, material: THREE.Material) {
    const geometry = new THREE.RingGeometry(inner, outer, 256); geometry.rotateX(-Math.PI / 2);
    return mesh(name, geometry, material, [0, y, 0]);
  }
  function profile(name: string, points: [number, number][], material: THREE.Material) {
    return mesh(name, new THREE.LatheGeometry(points.map(point => new THREE.Vector2(...point)).reverse(), 256), material);
  }
  const d = galleryPlatformDimensions;
  const floorGeometry = new THREE.CircleGeometry(d.pavingRadius, 256); floorGeometry.rotateX(-Math.PI / 2);
  const top = mesh('limestone-paving', floorGeometry, finishMaterial, [0, d.top, 0]);
  top.castShadow = false;
  // A closed slab remains below the cosmetic finish; neither mirror visibility nor
  // a grazing camera can expose an empty paper-thin disk.
  mesh('reinforced-platform-foundation', new THREE.CylinderGeometry(27.13, 27.04, .40, 192), foundation, [0, -.34, 0]);
  mesh('platform-compacted-base', new THREE.CylinderGeometry(27.04, 27.17, .12, 192), recessed, [0, -.58, 0]);
  mesh('paving-bedding-slab', new THREE.CylinderGeometry(26.70, 26.70, .117, 192), edging, [0, -.0835, 0]);

  profile('bevelled-perimeter-coping', [
    [26.80, -.024], [27.14, -.024], [27.17, -.030], [27.193, -.047],
    [27.20, -.073], [27.20, -.136], [27.189, -.160], [27.16, -.174],
    [26.80, -.174], [26.80, -.024],
  ], edging);
  profile('recessed-foundation-reveal', [
    [27.10, -.181], [27.137, -.181], [27.137, -.215], [27.10, -.215], [27.10, -.181],
  ], recessed);

  ring('perimeter-drain-trough', 26.70, 26.80, -.053, drain);
  ring('drain-inner-frame', 26.70, 26.709, -.0255, grate);
  ring('drain-outer-frame', 26.791, 26.80, -.0255, grate);
  const slatGeometry = new THREE.BoxGeometry(.078, .016, .012); geometries.add(slatGeometry);
  const slats = new THREE.InstancedMesh(slatGeometry, grate, 1800); slats.name = 'drain-grate-slats';
  const placement = new THREE.Object3D();
  for (let i = 0; i < slats.count; i++) {
    const angle = i / slats.count * Math.PI * 2;
    placement.position.set(Math.cos(angle) * 26.75, -.034, Math.sin(angle) * 26.75);
    placement.rotation.set(0, -angle, 0); placement.updateMatrix(); slats.setMatrixAt(i, placement.matrix);
  }
  slats.receiveShadow = true; slats.instanceMatrix.needsUpdate = true; slats.computeBoundingSphere(); group.add(slats);

  // Radial coping joints are narrow, shallow slots, consolidated into one draw call.
  const jointGeometry = new THREE.BoxGeometry(.365, .0006, .005); geometries.add(jointGeometry);
  const joints = new THREE.InstancedMesh(jointGeometry, expansion, 120); joints.name = 'coping-expansion-joints';
  for (let i = 0; i < joints.count; i++) {
    const angle = i / joints.count * Math.PI * 2;
    placement.position.set(Math.cos(angle) * 26.981, -.0239, Math.sin(angle) * 26.981);
    placement.rotation.set(0, -angle, 0); placement.updateMatrix(); joints.setMatrixAt(i, placement.matrix);
  }
  joints.receiveShadow = true; joints.instanceMatrix.needsUpdate = true; joints.computeBoundingSphere(); group.add(joints);

  // Two access routes connect to landscape earth at y ~= -.40; their solid bases
  // extend into that earth. Deliberate 130 mm rises descend away from the car bay.
  for (const side of [-1, 1]) {
    const route = new THREE.Group(); route.name = `platform-access-${side}`; group.add(route);
    for (const [start, end, level] of [[27.04, 28.10, -.154], [28.10, 29.16, -.284], [29.16, 31.0, -.360]]) {
      const geometry = new THREE.BoxGeometry(end - start, level + .62, 4.2); geometries.add(geometry);
      const block = new THREE.Mesh(geometry, stepStone); block.name = 'solid-access-step';
      block.position.set(side * (start + end) / 2, (level - .62) / 2, 0);
      block.receiveShadow = block.castShadow = true; route.add(block);
      // Stone nosing belongs to the step and stays below its top walking surface.
      const noseGeometry = new THREE.BoxGeometry(.032, .025, 4.16); geometries.add(noseGeometry);
      const nose = new THREE.Mesh(noseGeometry, edging); nose.name = 'step-nosing';
      nose.position.set(side * (end - .020), level - .016, 0); nose.receiveShadow = nose.castShadow = true; route.add(nose);
    }
  }

  function setEnvironment(environment: GalleryEnvironment) {
    if (disposed) return;
    const tones = {
      coast: ['#d5c8b6', '#bfb49f'], mountain: ['#d4cdbd', '#bab6a7'],
      desert: ['#dbc7a8', '#c2ad8c'], snow: ['#d8d4ca', '#bcbdb7'],
    } as const;
    finishMaterial.color.set(tones[environment][0]); edging.color.set(tones[environment][1]);
    stepStone.color.set(tones[environment][0]).multiplyScalar(.91);
    group.userData.environment = environment;
  }
  setEnvironment('coast');
  return {
    group, finishMaterial, setEnvironment,
    dispose() {
      if (disposed) return; disposed = true;
      group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      group.removeFromParent(); group.clear(); geometries.clear(); materials.clear();
    },
  };
}
