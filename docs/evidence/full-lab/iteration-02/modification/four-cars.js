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
 await page.locator('#lab-edit').check();
 for(const [index,kind] of ['ice','bev','hev','erev'].entries()){
  await page.locator('#lab-vehicle').selectOption(kind);await page.locator('#lab-section').selectOption('none');
  await page.locator('#lab-body').selectOption(index===0?'solid':'hidden');
  if(index===0){await page.locator('#lab-explode').click();await page.waitForFunction(()=>modQA.scene.getObjectByName('roof')?.position.y===1);}
  const point=await mountPoint(index===0?'roof':'cockpit');await page.mouse.click(point.x,point.y);
  await page.waitForFunction(()=>document.querySelectorAll('#lab-references .lab-reference-row').length===5);
  const before=await page.evaluate(()=>modQA.sent.length);await page.locator('#lab-calculate').click();
  await page.waitForFunction(before=>modQA.sent.length>before&&modQA.result?.runId===modQA.sent.at(-1).runId,before);
  const record=await page.evaluate(({kind,point})=>{
   const q=modQA,r=q.result,added=r.config.references.at(-1),sent=q.sent.at(-1),model=q.scene.getObjectByName('teaching-suv-'+kind),marker=[];q.scene.traverse(o=>{if(o.userData.selection?.signal==='x'&&o.userData.selection.channel===4)marker.push(o)});
   if(r.config.vehicle!==kind||r.signals.x.length!==5||sent.config.references.length!==5)throw Error('real config/dimension mismatch');
   if(added.mountPart!==point.part)throw Error('wrong mounted part '+added.mountPart);
   const expected=point.world.map((v,i)=>v-point.offset[i]);const error=Math.max(...expected.map((v,i)=>Math.abs(v-added.position[i])));
   if(error>1e-5)throw Error('expanded coordinate leaked '+error);
   if(document.querySelectorAll('.sf-channel-x button').length!==5)throw Error('flow reference count mismatch');
   return {kind,clicked:point,reference:added,sentReference:sent.config.references.at(-1),runId:r.runId,realXChannels:r.signals.x.length,referencePeak:Math.max(...r.signals.x[4].map(Math.abs)),physicalError:error,marker:marker[0]?.position.toArray()};
  },{kind,point});
  await page.locator('#lab-viewer button[data-signal="x"][data-channel="4"]').click();
  record.selection=await page.evaluate(()=>({title:document.querySelector('#lab-signal-title').textContent,flow:document.querySelector('.sf-channel-x button[data-sf-channel="4"]').getAttribute('aria-pressed')}));
  if(!record.selection.title.includes(record.reference.name)||record.selection.flow!=='true')throw Error('model→signal flow selection mismatch');
  await page.locator('.sf-channel-q button[data-sf-channel="2"]').click();
  await page.waitForFunction(()=>document.querySelector('#lab-viewer button[data-signal="q"][data-channel="2"]').getAttribute('aria-pressed')==='true');
  record.diagramSelection=await page.locator('#lab-signal-title').textContent();
  await page.locator('#lab-viewer button[data-signal="x"][data-channel="4"]').click({button:'right'});
  await page.locator('#lab-context button').filter({hasText:'移除此参考传感器'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#lab-references .lab-reference-row').length===4);
  record.removed=await page.locator('#lab-status').textContent();
  await page.locator('#lab-viewer button[data-signal="e"][data-channel="0"]').click({button:'right'});
  record.errorMenu=await page.locator('#lab-context').textContent();
  if(record.errorMenu.includes('移除'))throw Error('error sensor removable');
  await page.locator('#lab-context button').click();
  await page.locator('#lab-viewer').scrollIntoViewIfNeeded();await page.screenshot({path:`output/playwright/modification-full/${kind}-modified.png`,fullPage:true});
  records.push(record);await page.evaluate(records=>modQA.fourCars=records,records);
 }
 return {records,errors:await page.evaluate(()=>modQA.errors)};
}
