async(page)=>{
 await page.waitForFunction(()=>window.ready);
 return await page.evaluate(async()=>{
  const results=[];
  for(const section of ['none','x','y']){
   qa.show('hev','solid',section,section==='y'?1.06:0);qa.viewer.setExploded(false);
   for(let n=0;n<140;n++){await new Promise(requestAnimationFrame);qa.draw();}
   qa.viewer.setExploded(true);const times=[],intervals=[];let last=performance.now();
   for(let n=0;n<200;n++){
    await new Promise(requestAnimationFrame);const t=performance.now();intervals.push(t-last);last=t;
    qa.viewer.render(n/60,qa.selection,[.1,.1,.1,.1],[.1,.1,.1,.1]);times.push(performance.now()-t);
   }
   const summarize=a=>{const s=[...a].sort((a,b)=>a-b);return {median:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1)};};
   let maxPlaneError=0,caps=0,hiddenSourceCaps=0;
   const group=qa.scene.getObjectByName('vehicle-sections');group.updateMatrixWorld(true);
   if(section!=='none')for(const cap of group.children.filter(o=>o.name==='section-cap'&&o.visible)){
    caps++;const p=cap.geometry.getAttribute('position');for(let n=0;n<p.count;n++){
     const v=new qa.THREE.Vector3().fromBufferAttribute(p,n).applyMatrix4(cap.matrixWorld);maxPlaneError=Math.max(maxPlaneError,Math.abs(v[section]-(section==='y'?1.06:0)));
    }
   }
   const pose=qa.scene.getObjectByName('cockpit').position.y;
   if(maxPlaneError>2e-5)throw Error('section left plane '+maxPlaneError);
   results.push({section,renderMs:summarize(times),rafIntervalMs:summarize(intervals),caps,maxPlaneError,settledCabinY:pose});
  }
  qa.show('hev','hidden','x',0);qa.draw();
  const section=qa.scene.getObjectByName('vehicle-sections');const invalid=section.children.filter(o=>o.visible&&!qa.scene.getObjectById(o.userData.sourceMeshId)?.visible);
  if(invalid.length)throw Error('hidden body retains section');
  const gl=qa.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',viewport:[qa.host.clientWidth,qa.host.clientHeight],pixelRatio:qa.renderer.getPixelRatio(),results,hiddenBodySectionLeaks:invalid.length};
 });
}
