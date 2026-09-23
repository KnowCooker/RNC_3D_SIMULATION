async(page)=>{
 await page.waitForFunction(()=>window.ready); const results=[];
 for(const kind of ['ice','bev','hev','erev']){await page.evaluate(k=>{qa.show(k,'solid');qa.camera.position.set(6.3,3.9,7.2);qa.draw();},kind);await page.screenshot({path:`output/playwright/visual-v4/${kind}-solid-front.png`});}
 for(const [axis,value] of [['x',0],['y',1.06],['z',.1]]){
  const state=await page.evaluate(([axis,value])=>{qa.show('hev','solid',axis,value);qa.camera.position.set(axis==='x'?-5.4:5.4,axis==='y'?1.3:3.7,6.1);qa.draw();const group=qa.scene.getObjectByName('vehicle-sections');return {axis,value,caps:group.children.filter(o=>o.name==='section-cap'&&o.visible).length,contours:group.children.filter(o=>o.name==='section-contour'&&o.visible).length};},[axis,value]);results.push(state);await page.screenshot({path:`output/playwright/visual-v4/hev-section-${axis}-visible.png`});
 }
 await page.evaluate(()=>{qa.show('hev','hidden');qa.camera.position.set(3.7,5,4.4);qa.draw();});await page.screenshot({path:'output/playwright/visual-v4/hev-cabin.png'});
 const invalid=await page.evaluate(()=>{qa.config.references.push({id:'mount-port',name:'充电口安装验证',position:[-.99,1.08,-1.88],mountPart:'charge-system'});qa.show('bev');const before=qa.viewer.getMountIssues();qa.show('hev');const missing=qa.viewer.getMountIssues();if(before.length||missing.length!==1||missing[0].sensorId!=='mount-port')throw Error('missing attachment not reported');const names=[...qa.host.querySelectorAll('button')].map(b=>b.textContent);if(!names.some(n=>n.includes('安装件缺失')))throw Error('missing label');const physical=[...qa.config.references.at(-1).position];qa.show('erev');if(qa.viewer.getMountIssues().length)throw Error('valid attachment not restored');qa.config.references.pop();qa.show('hev');return {before,missing,physical};});
 return {sections:results,invalid};
}
