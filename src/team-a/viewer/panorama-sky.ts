import * as THREE from 'three';

/** Rotation-only sky at clip-space infinity: no sphere wall, parallax or far-plane cut. */
export function createPanoramaSky(name: string) {
  const uniforms = {
    previous: { value: null as THREE.Texture | null }, next: { value: null as THREE.Texture | null },
    hasPrevious: { value: 0 }, hasNext: { value: 0 }, blend: { value: 1 },
    previousYaw: { value: 0 }, nextYaw: { value: 0 },
    worldRotation: { value: new THREE.Matrix3() }, haze: { value: 0 },
    horizon: { value: new THREE.Color('#c6d1cf') }, zenith: { value: new THREE.Color('#9dbbd0') },
  };
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false, uniforms,
    vertexShader: `varying vec3 ray; uniform mat3 worldRotation;
      void main(){ray=position; vec3 direction=worldRotation*position;
        vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*direction,0.);
        gl_Position=clip.xyww;}`,
    fragmentShader: `varying vec3 ray; uniform sampler2D previous,next;
      uniform float hasPrevious,hasNext,blend,previousYaw,nextYaw,haze;
      uniform vec3 horizon,zenith;
      vec2 panoUV(vec3 d,float yaw){float c=cos(yaw),s=sin(yaw);
        d=vec3(c*d.x-s*d.z,d.y,s*d.x+c*d.z);
        return vec2(fract(atan(d.z,-d.x)/6.28318530718),asin(clamp(d.y,-1.,1.))/3.14159265359+.5);}
      vec3 samplePano(sampler2D image,vec2 uv){
        vec2 dx=dFdx(uv),dy=dFdy(uv);
        dx.x-=floor(dx.x+.5);dy.x-=floor(dy.x+.5);
        return texture2DGradEXT(image,uv,dx,dy).rgb;
      }
      void main(){vec3 d=normalize(ray);vec3 fallback=mix(horizon,zenith,smoothstep(0.,.8,d.y));
        vec3 a=hasPrevious>.5?samplePano(previous,panoUV(d,previousYaw)):fallback;
        vec3 b=hasNext>.5?samplePano(next,panoUV(d,nextYaw)):fallback;
        vec3 color=mix(a,b,blend);
        color=mix(color,horizon,haze*(1.-smoothstep(-.12,.16,d.y)));
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.SphereGeometry(1, 96, 64), mesh = new THREE.Mesh(geometry, material);
  mesh.name = name; mesh.frustumCulled = false; mesh.renderOrder = -100;
  type Frame = { texture: THREE.Texture; yaw: number };
  let active: Frame | null = null;
  let queued: Frame | null = null, elapsed = 1.2;
  function begin(value: Frame) {
    uniforms.previous.value = active?.texture ?? null; uniforms.hasPrevious.value = active ? 1 : 0;
    uniforms.previousYaw.value = active?.yaw ?? value.yaw;
    active = value; uniforms.next.value = value.texture; uniforms.hasNext.value = 1;
    uniforms.nextYaw.value = value.yaw; elapsed = 0; uniforms.blend.value = 0;
  }
  return {
    mesh,
    set(texture: THREE.Texture | null, yaw: number) {
      // Keep the last complete sky while another image loads or fails.
      if (!texture) return;
      if (active?.texture === texture && active.yaw === yaw) { queued = null; return; }
      if (elapsed < 1.2) queued = { texture, yaw }; else begin({ texture, yaw });
    },
    update(dt: number, rotation?: THREE.Quaternion) {
      if (rotation) uniforms.worldRotation.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(rotation));
      else uniforms.worldRotation.value.identity();
      elapsed = Math.min(1.2, elapsed + Math.min(.05, Math.max(0, dt)));
      const t = elapsed / 1.2; uniforms.blend.value = t * t * (3 - 2 * t);
      if (elapsed === 1.2) {
        uniforms.previous.value = active?.texture ?? null; uniforms.previousYaw.value = active?.yaw ?? 0;
        uniforms.hasPrevious.value = active ? 1 : 0;
        if (queued) { const value = queued; queued = null; begin(value); }
      }
      mesh.userData.transition = uniforms.blend.value;
    },
    setHaze(amount: number) { uniforms.haze.value = amount; },
    uses(texture: THREE.Texture) { return texture === uniforms.previous.value || texture === active?.texture || texture === queued?.texture; },
    dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
