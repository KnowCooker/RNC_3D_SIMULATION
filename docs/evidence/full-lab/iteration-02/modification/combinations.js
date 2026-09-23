async(page)=>{
 const records=[];await page.locator('#lab-edit').uncheck();await page.locator('#lab-paths').selectOption('both');await page.locator('#lab-waves').check();await page.locator('#lab-field').selectOption('residual');
 for(const kind of ['ice','bev','hev','erev']){
  await page.locator('#lab-vehicle').selectOption(kind);const before=await page.evaluate(()=>modQA.sent.length);await page.locator('#lab-calculate').click();await page.waitForFunction(n=>modQA.sent.length>n&&modQA.result.runId===modQA.sent.at(-1).runId,before);
  const seek=await page.locator('#lab-seek').boundingBox();await page.mouse.click(seek.x+seek.width*.55,seek.y+seek.height/2);await page.waitForFunction(()=>document.querySelector('#lab-field-status').textContent.includes('空间窗口'));
  for(const [body,axis,fraction] of [['solid','x',.5],['transparent','y',.71],['hidden','z',.49]]){
   await page.locator('#lab-body').selectOption(body);await page.locator('#lab-section').selectOption(axis);const slider=await page.locator('#lab-section-position').boundingBox();await page.mouse.click(slider.x+slider.width*fraction,slider.y+slider.height/2);await page.locator('#lab-explode').click();
   await page.evaluate(async()=>{for(let i=0;i<20;i++)await new Promise(requestAnimationFrame)});
   const state=await page.evaluate(({kind,body,axis})=>{
    const q=modQA,T=q.THREE,group=q.scene.getObjectByName('vehicle-sections'),value=Number(document.querySelector('#lab-section-position').value),objects=[];q.scene.traverse(o=>objects.push(o));
    let caps=0,maxError=0,leaks=0;group.updateMatrixWorld(true);
    for(const cap of group.children.filter(o=>o.visible&&o.name==='section-cap')){
     caps++;const source=q.scene.getObjectById(cap.userData.sourceMeshId);for(let p=source;p;p=p.parent)if(!p.visible)leaks++;
     const positions=cap.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){const v=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(cap.matrixWorld);maxError=Math.max(maxError,Math.abs(v[axis]-value));}
    }
    if(leaks||maxError>2e-5)throw Error('section attachment/hierarchy mismatch');
    const field=objects.find(o=>o.isInstancedMesh);if(!field.parent.visible)throw Error('real field missing');
    const lift=q.scene.getObjectByName('cockpit').position.y;if(Math.abs(field.parent.position.y-lift)>1e-7)throw Error('field not following cabin');
    return {kind,body,axis,value,exploded:document.querySelector('#lab-explode').getAttribute('aria-pressed'),cabinLift:lift,caps,maxPlaneError:maxError,hiddenLeaks:leaks,realFieldStatus:document.querySelector('#lab-field-status').textContent,realWorkerFields:q.received.filter(r=>r.type==='field').length,errors:q.errors.length};
   },{kind,body,axis});records.push(state);await page.evaluate(r=>modQA.combinations=r,records);
   await page.locator('#lab-viewer').scrollIntoViewIfNeeded();await page.screenshot({path:`output/playwright/modification-full/${kind}-${body}-${axis}.png`});
  }
 }
 return {records,errors:await page.evaluate(()=>modQA.errors)};
}
