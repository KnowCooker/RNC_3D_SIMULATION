import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createPanoramaSky } from './panorama-sky';
import { createScenicTerrain } from './scenic-terrain';
import { createGalleryPlatform } from './gallery-platform';
import { loadHDRTexture } from './hdr-texture';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type GalleryEnvironment = 'coast' | 'mountain' | 'desert' | 'snow';
export const galleryEnvironments = {
  coast: { url:new URL('./assets/qwantani_sunset_4k.hdr',import.meta.url).href, rotation:1.3, exposure:.98, intensity:.8, sun:'#ffe2af', strength:2.5, stone:'#d5c8b6' },
  mountain: { url:new URL('./assets/alps_field_4k.hdr',import.meta.url).href, rotation:.98, exposure:.87, intensity:.55, sun:'#fff1da', strength:2.5, stone:'#d5cec0' },
  desert: { url:new URL('./assets/goegap_2k.hdr',import.meta.url).href, rotation:.65, exposure:.95, intensity:.7, sun:'#fff0d5', strength:2.7, stone:'#deccb2' },
  snow: { url:new URL('./assets/lago_disola_4k.hdr',import.meta.url).href, rotation:.47, exposure:.84, intensity:.5, sun:'#fff8ef', strength:2.3, stone:'#d8d5ce' },
} as const;
const scenicBackdrops:Record<GalleryEnvironment,string>={
  coast:new URL('./assets/qwantani_sunset_8k.jpg',import.meta.url).href,
  mountain:new URL('./assets/alps_field_8k.jpg',import.meta.url).href,
  desert:new URL('./assets/goegap_8k.jpg',import.meta.url).href,
  snow:new URL('./assets/lago_disola_8k.jpg',import.meta.url).href,
};

/** One open pavilion shared by all pages. Landscape and light do not alter acoustic state. */
export function createChampagneGallery(anisotropy = 8) {
  let disposed=false, environment:GalleryEnvironment='coast';
  const panoramas=new Map<GalleryEnvironment,THREE.DataTexture>(), pending=new Set<GalleryEnvironment>();
  const backdrops=new Map<GalleryEnvironment,THREE.Texture>(),backdropPending=new Set<GalleryEnvironment>();
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  const group=new THREE.Group();group.name='champagne-lakeside-gallery';
  const landscape=createScenicTerrain();group.add(landscape.group);
  // Art-directed lake sky belongs only to the pavilion. Driving retains its photographic panorama.
  let lakeArt: THREE.Texture | null = null;
  const mat=(color:string,roughness=.7,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness});materials.add(m);return m;};
  const stone=mat('#d5c8b6',.3),bronze=mat('#b49a76',.24,.7),ivory=mat('#f1e6d3',.65),trunk=mat('#514234',.95);
  const foliage=mat('#576044',.9),bark=mat('#7b6b54',.9);
  function mesh(g:THREE.BufferGeometry,m:THREE.Material,xyz:[number,number,number],parent:THREE.Object3D=group){geometries.add(g);const o=new THREE.Mesh(g,m);o.position.set(...xyz);parent.add(o);o.receiveShadow=true;return o;}
  const box=(size:[number,number,number],xyz:[number,number,number],m:THREE.Material,parent:THREE.Object3D=group)=>mesh(new THREE.BoxGeometry(...size),m,xyz,parent);
  const rounded=(size:[number,number,number],xyz:[number,number,number],m:THREE.Material,r=.08,parent:THREE.Object3D=group)=>mesh(new RoundedBoxGeometry(...size,3,r),m,xyz,parent);
  function rod(a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,parent:THREE.Object3D=group){const d=b.clone().sub(a),o=mesh(new THREE.CylinderGeometry(r*.7,r,d.length(),9),m,a.clone().add(b).multiplyScalar(.5).toArray(),parent);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());o.castShadow=true;return o;}
  let seed=20931;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const floor=new THREE.Group();floor.name='gallery-stone-floor';group.add(floor);
  const platform=createGalleryPlatform();floor.add(platform.group);
  const reflectorGeometry=new THREE.CircleGeometry(26.68,192);geometries.add(reflectorGeometry);
  // Rough-polished stone: filtered real reflections, not a crisp upside-down duplicate.
  // three exposes this shader at runtime; its examples declaration omits the static member.
  const baseReflectorShader=(Reflector as typeof Reflector & {ReflectorShader:{uniforms:Record<string,THREE.IUniform>;vertexShader:string;fragmentShader:string}}).ReflectorShader;
  const reflectShader={...baseReflectorShader,
    uniforms:{...THREE.UniformsUtils.clone(baseReflectorShader.uniforms),texel:{value:new THREE.Vector2(1/1536,1/1024)}},
    fragmentShader:baseReflectorShader.fragmentShader.replace('varying vec4 vUv;','varying vec4 vUv; uniform vec2 texel;').replace('vec4 base = texture2DProj( tDiffuse, vUv );',`
      vec2 uv=vUv.xy/vUv.w; vec2 r=texel*4.0;
      vec4 base=texture2D(tDiffuse,uv)*.28;
      base+=(texture2D(tDiffuse,uv+vec2(r.x,0.))+texture2D(tDiffuse,uv-vec2(r.x,0.))+texture2D(tDiffuse,uv+vec2(0.,r.y))+texture2D(tDiffuse,uv-vec2(0.,r.y)))*.12;
      base+=(texture2D(tDiffuse,uv+r)+texture2D(tDiffuse,uv-r)+texture2D(tDiffuse,uv+vec2(r.x,-r.y))+texture2D(tDiffuse,uv+vec2(-r.x,r.y)))*.06;
    `).replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( blendOverlay( base.rgb, color ), .12 );')};
  const mirror=new Reflector(reflectorGeometry,{textureWidth:1536,textureHeight:1024,color:0x9c968d,clipBias:.003,shader:reflectShader});
  mirror.rotation.x=-Math.PI/2;mirror.position.y=-.022;mirror.name='gallery-reflection';
  const mirrorMaterial=mirror.material as THREE.ShaderMaterial;
  mirrorMaterial.transparent=true;mirrorMaterial.depthWrite=false;mirror.renderOrder=1;floor.add(mirror);
  // All azimuths share the same open-air architectural finish and planted perimeter.
  const canopyMat=mat('#e4d9c5',.72);canopyMat.side=THREE.DoubleSide;
  const roofG=new THREE.RingGeometry(24,28,192,3);roofG.rotateX(-Math.PI/2);
  mesh(roofG,canopyMat,[0,7.65,0]).name='continuous-pavilion-canopy';
  // A continuous fascia gives the roof a real section instead of a paper-thin ring.
  for(const r of [24,28]){const fascia=new THREE.CylinderGeometry(r,r,.22,192,1,true);mesh(fascia,canopyMat,[0,7.65,0]);}
  const soffit=roofG.clone();mesh(soffit,canopyMat,[0,7.54,0]);
  const glow=new THREE.MeshStandardMaterial({color:'#fff0d0',emissive:'#ffdfad',emissiveIntensity:1.4,roughness:.45});materials.add(glow);
  const edgeG=new THREE.TorusGeometry(24,.024,6,192);edgeG.rotateX(Math.PI/2);mesh(edgeG,glow,[0,7.515,0]);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,x=Math.sin(a)*26,z=Math.cos(a)*26;
    mesh(new THREE.CylinderGeometry(.095,.12,7.54,24),bronze,[x,3.75,z]);
    mesh(new THREE.CylinderGeometry(.23,.23,.055,24),bronze,[x,7.50,z]);
    mesh(new THREE.CylinderGeometry(.22,.25,.07,32),bronze,[x,.011,z]);
    if(i%3===1){
      const seat=new THREE.Group();seat.position.set(Math.sin(a)*21.5,0,Math.cos(a)*21.5);seat.rotation.y=a;group.add(seat);
      rounded([3,.16,1],[0,.47,0],ivory,.075,seat);rounded([3,.5,.22],[0,.79,.38],ivory,.08,seat);
      for(const dx of [-1.1,1.1])box([.075,.42,.7],[dx,.19,0],bronze,seat);
    }
  }
  const plants=new THREE.Group();plants.name='pavilion-olive-trees';plants.rotation.y=.65;group.add(plants);
  for(const [x,z,s] of Array.from({length:8},(_,i)=>[Math.sin(i*Math.PI/4+.2)*23,Math.cos(i*Math.PI/4+.2)*23,.9+(i%3)*.1])){
    const tree=new THREE.Group();tree.position.set(x,0,z);tree.scale.setScalar(s);plants.add(tree);
    mesh(new THREE.CylinderGeometry(.63,.52,.62,48),stone,[0,.24,0],tree);mesh(new THREE.CylinderGeometry(.58,.58,.025,32),bark,[0,.56,0],tree);
    rod(new THREE.Vector3(0,.55,0),new THREE.Vector3(.08,3.3,.06),.09,trunk,tree);
    for(let b=0;b<10;b++){const a=b*2.4,h=1.9+random()*.9;rod(new THREE.Vector3(.05,h,0),new THREE.Vector3(Math.cos(a)*(1+random()*.4),h+.4+random()*.7,Math.sin(a)*(1+random()*.4)),.025,trunk,tree);}
    const leafG=new THREE.SphereGeometry(1,5,3);geometries.add(leafG);const leaves=new THREE.InstancedMesh(leafG,foliage,1600),placement=new THREE.Object3D();
    for(let j=0;j<leaves.count;j++){const a=random()*Math.PI*2,r=Math.sqrt(random())*1.5,e=random()*Math.PI;placement.position.set(Math.cos(a)*r*Math.sin(e),3.15+Math.cos(e)*.95,Math.sin(a)*r*Math.sin(e));placement.rotation.set(random()*Math.PI,random()*Math.PI,random()*Math.PI);placement.scale.set(.06+random()*.05,.012,.027+random()*.025);placement.updateMatrix();leaves.setMatrixAt(j,placement.matrix);}
    leaves.castShadow=true;leaves.instanceMatrix.needsUpdate=true;tree.add(leaves);
  }
  const sky=createPanoramaSky('landscape-panorama-360');group.add(sky.mesh);
  // The generated landscape is a wide art plate, not a surveyed 360° photograph.
  // Project it across the front vista and feather into the full photographic sky.
  const artUniforms={image:{value:null as THREE.Texture|null},opacity:{value:0}};
  const artMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.BackSide,toneMapped:false,uniforms:artUniforms,
    vertexShader:`varying vec3 ray;
      void main(){ray=position;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,0.);gl_Position=p.xyww;}`,
    fragmentShader:`varying vec3 ray;uniform sampler2D image;uniform float opacity;
      void main(){vec3 d=normalize(ray);vec3 front=vec3(.62161,0.,-.78333),right=vec3(.78333,0.,.62161);
        vec2 uv=vec2(.5+atan(dot(d,right),dot(d,front))/1.7,.5+asin(clamp(d.y,-1.,1.))/.75);
        float edge=smoothstep(0.,.12,uv.x)*(1.-smoothstep(.88,1.,uv.x))*smoothstep(0.,.12,uv.y)*(1.-smoothstep(.88,1.,uv.y));
        gl_FragColor=vec4(texture2D(image,clamp(uv,0.,1.)).rgb,edge*opacity);
        #include <colorspace_fragment>
      }`});
  const artGeometry=new THREE.SphereGeometry(1,96,64);geometries.add(artGeometry);materials.add(artMaterial);
  const artSky=new THREE.Mesh(artGeometry,artMaterial);artSky.name='champagne-art-vista';artSky.frustumCulled=false;artSky.renderOrder=-99;artSky.visible=false;group.add(artSky);
  new THREE.TextureLoader().load(new URL('./assets/gallery-champagne-sunset-v2.png',import.meta.url).href,texture=>{
    if(disposed){texture.dispose();return;} texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;lakeArt=texture;artUniforms.image.value=texture;activate();
  });
  landscape.connectPanorama(sky.mesh.material);
  group.userData.panoramaCoverage=360;
  let activeLighting:THREE.DataTexture|null=null, backgroundGuard: (texture:THREE.Texture)=>boolean=()=>false;
  function activate(){
    const style=galleryEnvironments[environment],texture=panoramas.get(environment),backdrop=backdrops.get(environment);
    group.userData.environment=environment;group.userData.environmentReady=texture&&backdrop?environment:'';
    group.userData.panoramaResolution=backdrop?`${backdrop.image.width}x${backdrop.image.height}`:'';
    sky.set(backdrop??null,style.rotation);if(texture)activeLighting=texture;
    stone.color.set(style.stone);platform.setEnvironment(environment);
    plants.visible=environment!=='desert';foliage.color.set(environment==='snow'?'#89958c':'#576044');
  }
  function trimCache(){for(const cache of [panoramas,backdrops])for(const [id,texture] of cache){if(cache.size<=2)break;if(id!==environment&&texture!==activeLighting&&!sky.uses(texture)&&!backgroundGuard(texture)){cache.delete(id);texture.dispose();}}}
  function setEnvironment(value:GalleryEnvironment){
    environment=value;landscape.setEnvironment(value);group.userData.panoramaFailed=false;
    const cachedBackdrop=backdrops.get(value);if(cachedBackdrop){backdrops.delete(value);backdrops.set(value,cachedBackdrop);}
    if(scenicBackdrops[value]&&!backdrops.has(value)&&!backdropPending.has(value)){backdropPending.add(value);new THREE.TextureLoader().load(scenicBackdrops[value]!,texture=>{backdropPending.delete(value);if(disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=Math.min(16,anisotropy);texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;backdrops.set(value,texture);trimCache();if(value===environment)activate();},undefined,()=>{backdropPending.delete(value);if(!disposed&&value===environment)group.userData.panoramaFailed=true;});}
    const cached=panoramas.get(value);if(cached){panoramas.delete(value);panoramas.set(value,cached);}activate();if(cached||pending.size>0)return;pending.add(value);
    void loadHDRTexture(galleryEnvironments[value].url).then(texture=>{pending.delete(value);if(disposed){texture.dispose();return;}texture.mapping=THREE.EquirectangularReflectionMapping;panoramas.set(value,texture);trimCache();if(value===environment)activate();else setEnvironment(environment);},()=>{pending.delete(value);if(!disposed&&value===environment){group.userData.panoramaFailed=true;activate();}else if(!disposed)setEnvironment(environment);});
  }
  setEnvironment(environment);
  return {group,floor,get environmentTexture(){return activeLighting;},get backgroundTexture(){return backdrops.get(environment)??null;},get environment(){return environment;},get lighting(){return galleryEnvironments[environment];},setEnvironment,
    protectBackground(guard:(texture:THREE.Texture)=>boolean){backgroundGuard=guard;},
    update(dt:number){sky.update(dt);const target=environment==='coast'&&lakeArt?1:0;artUniforms.opacity.value+=Math.sign(target-artUniforms.opacity.value)*Math.min(Math.abs(target-artUniforms.opacity.value),Math.min(.05,dt)/1.2);artSky.visible=artUniforms.opacity.value>0;trimCache();},
    resize(width:number,height:number){const w=Math.min(2048,Math.max(768,Math.round(width))),h=Math.min(1440,Math.max(512,Math.round(height)));const target=mirror.getRenderTarget();if(target.width!==w||target.height!==h){target.setSize(w,h);(mirror.material as THREE.ShaderMaterial).uniforms.texel.value.set(1/w,1/h);}},
    dispose(){if(disposed)return;disposed=true;sky.dispose();lakeArt?.dispose();landscape.dispose();platform.dispose();group.removeFromParent();group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});mirror.dispose();panoramas.forEach(t=>t.dispose());panoramas.clear();backdrops.forEach(t=>t.dispose());backdrops.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());},
  };
}
