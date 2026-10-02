import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Vec3 } from '../../shared/lab-contracts';
import type { ShowroomModel } from './showroom-model';
import { cabinViews, drivingLook, isCabinView, travelDistance, type DrivingView } from './driving-state';

export function createDrivingView(host: HTMLElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls, hooks: {
  focus(position: Vec3, target: Vec3, fov?: number): void;
  model(): ShowroomModel | null;
  body(solid: boolean): void;
  road(): void;
  gallery(): void;
  assemble(): void;
}) {
  let view: DrivingView = 'orbit', enabled = false, overlay = false, yaw = 0, pitch = -.025, mapDirty = true, baseDirty = true;
  const panel = document.createElement('section'); panel.className = 'lab-driving-controls'; panel.setAttribute('aria-label', '行驶观察');
  panel.innerHTML = `<div class="lab-driving-heading"><strong>行驶观察</strong><small>随实验播放 / 暂停</small></div><div class="lab-driving-views"><button data-view="orbit" aria-pressed="true">车外跟随</button><button data-view="overhead" aria-pressed="false">上帝视角</button>${Object.entries(cabinViews).map(([id,row])=>`<button data-view="${id}" aria-pressed="false">${row.label}</button>`).join('')}</div><div class="lab-driving-actions"><button data-drive-overlay aria-pressed="false">声场透视</button><button data-drive-analysis>静态声场检视</button></div><p class="lab-driving-status"></p>`;
  host.append(panel);
  const card = document.createElement('aside'); card.className = 'lab-driving-location'; card.hidden = true;
  card.innerHTML = '<strong>观察位置</strong><canvas aria-label="同一车辆的观察位置与朝向"></canvas><span></span><small>拖动画面环顾 · 位置固定</small>';
  host.append(card);
  const canvas = card.querySelector('canvas')!, ctx = canvas.getContext('2d')!;
  canvas.width = 280; canvas.height = 420;
  const base = document.createElement('canvas'); base.width = 280; base.height = 420;
  const miniCamera = new THREE.OrthographicCamera(-1.85,1.85,2.775,-2.775,.05,30); miniCamera.position.set(0,8,0); miniCamera.up.set(0,0,1); miniCamera.lookAt(0,0,0); miniCamera.updateMatrixWorld();
  const buttons = [...panel.querySelectorAll<HTMLButtonElement>('[data-view]')];
  function cabinGlass(inside:boolean){hooks.model()?.group.traverse(o=>{const material=(o as THREE.Mesh).material;if(!material)return;for(const m of Array.isArray(material)?material:[material])if(m.name==='p7-window-glass'){m.opacity=inside?.12:.97;}});}
  function focusView() {
    const inside = isCabinView(view); controls.enabled = !inside; controls.enablePan = !inside;
    controls.minDistance = inside ? .05 : 3; controls.maxDistance = 50; controls.maxPolarAngle = inside ? Math.PI : Math.PI * .49;
    camera.near = inside ? .025 : .08;
    if (isCabinView(view)) hooks.focus(cabinViews[view].eye, drivingLook(cabinViews[view].eye, yaw, pitch), 76);
    else if (view === 'overhead') hooks.focus(host.clientWidth<1000?[.01,13,-3]:[-2,13,-3],host.clientWidth<1000?[0,.4,0]:[-2,.4,0],48);
    else hooks.focus(host.clientWidth<1000?[-5,3.2,-7.2]:[-5.3,3.2,-7.5],host.clientWidth<1000?[0,.7,.5]:[-1.5,.7,.5],48);
    hooks.body(inside || !overlay);if(inside)cabinGlass(true);
    card.hidden = !inside;
    if (isCabinView(view)) card.querySelector('span')!.textContent = `${cabinViews[view].label} · (${cabinViews[view].eye.map(n=>n.toFixed(2)).join(', ')}) m`;
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    panel.querySelector<HTMLButtonElement>('[data-drive-overlay]')!.disabled = inside;
    host.dataset.drivingView = view;host.dispatchEvent(new CustomEvent('driving-view-change',{bubbles:true,detail:{view,channel:isCabinView(view)?['fl','fr','rl','rr'].indexOf(view):null}})); host.dataset.drivingEye = isCabinView(view) ? cabinViews[view].eye.join(',') : ''; mapDirty = true; baseDirty = true;
  }
  buttons.forEach(b=>b.onclick=()=>{ hooks.road(); view=b.dataset.view as DrivingView; yaw=0; pitch=-.025; hooks.assemble(); focusView(); });
  panel.querySelector<HTMLButtonElement>('[data-drive-analysis]')!.onclick=()=>hooks.gallery();
  panel.querySelector<HTMLButtonElement>('[data-drive-overlay]')!.onclick=()=>{overlay=!overlay;panel.querySelector('[data-drive-overlay]')!.setAttribute('aria-pressed',String(overlay));hooks.body(!overlay);};
  let pointer: { id: number; x: number; y: number } | null = null;
  const down=(e:PointerEvent)=>{if(enabled&&isCabinView(view)&&e.button===0){pointer={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);}};
  const move=(e:PointerEvent)=>{if(!pointer||!enabled||!isCabinView(view)||pointer.id!==e.pointerId)return;yaw=THREE.MathUtils.clamp(yaw-(e.clientX-pointer.x)*.004,-Math.PI*.85,Math.PI*.85);pitch=THREE.MathUtils.clamp(pitch+(e.clientY-pointer.y)*.003,-.55,.55);pointer.x=e.clientX;pointer.y=e.clientY;camera.position.set(...cabinViews[view].eye);controls.target.set(...drivingLook(cabinViews[view].eye,yaw,pitch));hooks.focus(cabinViews[view].eye,drivingLook(cabinViews[view].eye,yaw,pitch),76);mapDirty=true;};
  const up=()=>{pointer=null;};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
  function drawMap() {
    const model=hooks.model();if(!model||!isCabinView(view))return;
    if(baseDirty){
    const saved=scene.children.map(o=>[o,o.visible] as const), background=scene.background, fog=scene.fog;
    const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
    try {
      scene.children.forEach(o=>{if(!(o instanceof THREE.Light)&&o!==model.group)o.visible=false;});
      scene.background=null;scene.fog=null;renderer.setClearColor(0,0);model.inspection.setBody('hidden');
      renderer.setPixelRatio(1);renderer.setSize(280,420,false);renderer.render(scene,miniCamera);
      base.getContext('2d')!.clearRect(0,0,280,420);base.getContext('2d')!.drawImage(renderer.domElement,0,0);
    } finally {model.inspection.setBody('solid');scene.background=background;scene.fog=fog;saved.forEach(([o,v])=>o.visible=v);renderer.setClearColor(clear,alpha);renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);}
    baseDirty=false;}
    ctx.clearRect(0,0,280,420);ctx.drawImage(base,0,0);
    for(const [id,row] of Object.entries(cabinViews)){
      const p=new THREE.Vector3(...row.eye).project(miniCamera),x=(p.x+1)*140,y=(1-p.y)*210;
      ctx.beginPath();ctx.arc(x,y,id===view?11:5,0,Math.PI*2);ctx.fillStyle=id===view?'#f4b552':'#fff8ea';ctx.fill();ctx.strokeStyle='#68461c';ctx.lineWidth=2;ctx.stroke();
      if(id===view){ctx.save();ctx.translate(x,y);ctx.rotate(-yaw);ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(-19,-48);ctx.quadraticCurveTo(0,-61,19,-48);ctx.closePath();ctx.fillStyle='#f4b55266';ctx.fill();ctx.restore();}
    }
    card.dataset.seat=cabinViews[view].seat;card.dataset.eye=cabinViews[view].eye.join(',');card.dataset.yaw=String(yaw);mapDirty=false;
  }
  return {panel,
    get cabin(){return enabled&&isCabinView(view);},get fieldVisible(){return !enabled||(!isCabinView(view)&&overlay);},
    enable(value:boolean){const changed=enabled!==value;enabled=value;panel.hidden=!value;if(value){hooks.assemble();if(changed)focusView();}else{if(changed)cabinGlass(false);card.hidden=true;controls.enabled=true;controls.enablePan=true;controls.minDistance=3;controls.maxDistance=24;controls.maxPolarAngle=Math.PI*.84;camera.near=.08;host.dataset.drivingView='';host.dataset.drivingEye='';}},
    focus:focusView,
    update(time:number,speed:number,ready:boolean,failed:boolean){if(!enabled)return;host.dataset.travelDistance=travelDistance(time,speed).toFixed(3);host.dataset.roadReady=String(ready);panel.querySelector('.lab-driving-status')!.textContent=`${speed.toFixed(0)} km/h · ${(travelDistance(time,speed)/1000).toFixed(2)} km · ${time.toFixed(2)} s${failed?' · 实景纹理加载失败，使用基础材质':ready?'':' · 正在加载高清环境'}`;if(mapDirty&&isCabinView(view))drawMap();if(isCabinView(view))cabinGlass(true);},
    dispose(){panel.remove();card.remove();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',up);},
  };
}
