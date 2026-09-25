async(page)=>{
 await page.setViewportSize({width:1500,height:1100});
 await page.addInitScript(()=>{
  if(window.modQA)return;window.modQA={sent:[],received:[],errors:[]};
  addEventListener('error',e=>modQA.errors.push({kind:'error',message:e.message}));
  addEventListener('unhandledrejection',e=>modQA.errors.push({kind:'rejection',message:String(e.reason)}));
  const Native=window.Worker;
  window.Worker=class extends Native{
   constructor(...args){super(...args);this.addEventListener('message',({data})=>{modQA.received.push({type:data.type,runId:data.runId});if(data.type==='result')modQA.result=data.result;if(data.type==='error')modQA.errors.push({kind:'worker',message:data.message});});}
   postMessage(data,...rest){if(data.type==='calculate'||data.type==='live-start')modQA.sent.push(structuredClone(data));return super.postMessage(data,...rest);}
  };
 });
 await page.route('**/src/integration/main.ts*',async route=>{
  const response=await route.fetch();const body=await response.text();
  const prelude=`import * as QA_THREE from '/node_modules/.vite/deps/three.js';
window.modQA.THREE=QA_THREE;
Object.defineProperty(QA_THREE.WebGLRenderer.prototype,'render',{configurable:true,set(fn){const renderer=this;Object.defineProperty(this,'render',{configurable:true,writable:true,value:function(scene,camera){window.modQA.scene=scene;window.modQA.camera=camera;window.modQA.renderer=renderer;return fn.call(renderer,scene,camera);}});}});
`;
  await route.fulfill({response,body:prelude+body});
 });
 await page.reload();await page.waitForFunction(()=>window.modQA?.result&&window.modQA?.scene);
 return await page.evaluate(()=>({vehicle:modQA.result.config.vehicle,refs:modQA.result.config.references.length,workerMessages:modQA.received,scene:modQA.scene.children.map(o=>o.name),status:document.querySelector('#lab-status').textContent,errors:modQA.errors}));
}
