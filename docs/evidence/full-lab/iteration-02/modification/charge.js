async(page)=>{
 const records=[];
 async function mountPoint(partName){
  await page.locator('#lab-viewer canvas').scrollIntoViewIfNeeded();
  return page.evaluate(partName=>{
   const q=modQA,T=q.THREE,model=q.scene.children.find(o=>o.name.startsWith('teaching-suv-')),part=model.getObjectByName(partName),canvas=document.querySelector('#lab-viewer canvas'),rect=canvas.getBoundingClientRect();
   q.scene.updateMatrixWorld(true);const box=new T.Box3().setFromObject(part),projected=[];
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])projected.push(new T.Vector3(x,y,z).project(q.camera));
   const minX=Math.max(0,Math.min(...projected.map(p=>(p.x+1)*rect.width/2))),maxX=Math.min(rect.width,Math.max(...projected.map(p=>(p.x+1)*rect.width/2)));
   const minY=Math.max(0,Math.min(...projected.map(p=>(1-p.y)*rect.height/2))),maxY=Math.min(rect.height,Math.max(...projected.map(p=>(1-p.y)*rect.height/2)));
   const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
   const markers=[];q.scene.traverse(o=>{if(o.userData.selection)markers.push(o)});
   const ray=new T.Raycaster(),axis=document.querySelector('#lab-section').value,value=Number(document.querySelector('#lab-section-position').value);
   for(const level of [9,19,29])for(let ix=0;ix<level;ix++)for(let iy=0;iy<level;iy++){
    const x=minX+(maxX-minX)*(ix+.5)/level,y=minY+(maxY-minY)*(iy+.5)/level,sx=rect.left+x,sy=rect.top+y;
    if(document.elementFromPoint(sx,sy)!==canvas)continue;
    ray.setFromCamera(new T.Vector2(x/rect.width*2-1,1-y/rect.height*2),q.camera);
    if(ray.intersectObjects(markers).some(h=>visible(h.object)&&(axis==='none'||h.point[axis]>=value)))continue;
    const hit=ray.intersectObject(model,true).find(h=>visible(h.object)&&(axis==='none'||h.point[axis]>=value));
    if(!hit||!(hit.object===part||part.getObjectById(hit.object.id)))continue;
    return {x:sx,y:sy,world:hit.point.toArray(),part:partName,offset:part.position.toArray(),vehicle:model.userData.vehicleKind};
   }
   throw Error('no visible clickable surface on '+partName);
  },partName);
 }
 await page.locator('#lab-vehicle').selectOption('bev');await page.locator('#lab-body').selectOption('hidden');await page.locator('#lab-paths').selectOption('none');await page.locator('#lab-waves').uncheck();await page.locator('#lab-section').selectOption('none');
 const point=await mountPoint('charge-system');await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>document.querySelectorAll('#lab-references .lab-reference-row').length===5);
 const old=await page.evaluate(()=>modQA.sent.length);await page.locator('#lab-calculate').click();await page.waitForFunction(n=>modQA.sent.length>n&&modQA.result.runId===modQA.sent.at(-1).runId,old);
 const mounted=await page.evaluate(()=>modQA.result.config.references.at(-1));if(mounted.mountPart!=='charge-system')throw Error('wrong charge mount');
 await page.locator('#lab-vehicle').selectOption('hev');await page.waitForFunction(()=>!document.querySelector('#lab-mount-warning').hidden);
 const before=await page.evaluate(()=>modQA.sent.length);await page.locator('#lab-calculate').click();
 const blocked=await page.evaluate(before=>({sentBefore:before,sentAfter:modQA.sent.length,warning:document.querySelector('#lab-mount-warning').textContent,status:document.querySelector('#lab-status').textContent,rows:[...document.querySelectorAll('#lab-references .lab-reference-row')].map(o=>o.textContent)}),before);
 if(blocked.sentAfter!==blocked.sentBefore||!blocked.status.includes('修正缺失'))throw Error('invalid mount experiment not blocked');
 await page.screenshot({path:'output/playwright/modification-full/missing-mount-blocked.png',fullPage:true});
 await page.locator('#lab-viewer button[data-signal="x"][data-channel="4"]').click({button:'right'});await page.locator('#lab-context button').filter({hasText:'移除此参考传感器'}).click();
 const repairedPoint=await mountPoint('cockpit');await page.mouse.click(repairedPoint.x,repairedPoint.y);await page.waitForFunction(()=>document.querySelectorAll('#lab-references .lab-reference-row').length===5);
 const last=await page.evaluate(()=>modQA.sent.length);await page.locator('#lab-calculate').click();await page.waitForFunction(n=>modQA.sent.length>n&&modQA.result.runId===modQA.sent.at(-1).runId,last);
 const repaired=await page.evaluate(()=>({config:modQA.result.config,runId:modQA.result.runId,warningHidden:document.querySelector('#lab-mount-warning').hidden,status:document.querySelector('#lab-status').textContent}));
 if(!repaired.warningHidden||repaired.config.references.at(-1).mountPart!=='cockpit')throw Error('repaired mount not usable');
 await page.screenshot({path:'output/playwright/modification-full/mount-repaired.png',fullPage:true});
 await page.evaluate(value=>modQA.charge=value,{point,mounted,blocked,repaired});return {point,mounted,blocked,repaired};
}

