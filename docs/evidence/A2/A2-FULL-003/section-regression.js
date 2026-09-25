async page => {
  await page.waitForFunction(() => window.ready === true);
  const results=[];
  for(const kind of ['ice','bev','hev','erev']) for(const [axis,cut] of (kind==='hev'?[['x',0],['y',1.06],['z',0.1]]:[['x',0]])) {
    const result=await page.evaluate(({kind,axis,cut})=>{
      qa.show(kind,'solid',axis,cut);
      const group=qa.scene.getObjectByName('vehicle-sections');
      const caps=group.children.filter(o=>o.name==='section-cap'&&o.visible);
      const axisIndex={x:0,y:1,z:2}[axis];
      let maxPlaneError=0,triangles=0;
      for(const cap of caps){
        cap.updateWorldMatrix(true,false);
        const p=cap.geometry.getAttribute('position');triangles+=(cap.geometry.index?.count??p.count)/3;
        for(let i=0;i<p.count;i++){const v=new qa.THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(cap.matrixWorld);maxPlaneError=Math.max(maxPlaneError,Math.abs(v.getComponent(axisIndex)-cut));}
      }
      return {kind,axis,cut,caps:caps.length,triangles,maxPlaneError};
    },{kind,axis,cut});
    if(result.caps<1||result.maxPlaneError>1e-5)throw Error(`bad section ${JSON.stringify(result)}`);
    results.push(result);
    if(kind==='hev'&&axis==='x')await page.screenshot({path:'output/playwright/a2-full-003/hev-section-x.png'});
  }
  await page.evaluate(()=>{qa.show('bev','solid');qa.viewer.setExploded(true);qa.draw();});
  for(let i=0;i<68;i++){await page.waitForTimeout(16);await page.evaluate(()=>qa.draw());}
  const exploded=await page.evaluate(()=>{qa.draw();return {issues:qa.viewer.getMountIssues(),cabin:qa.scene.getObjectByName('seat-1').position.y,roof:qa.scene.getObjectByName('roof').position.y};});
  if(exploded.issues.length||exploded.cabin<0.4||exploded.roof<0.7)throw Error(`bad explosion ${JSON.stringify(exploded)}`);
  await page.evaluate(()=>{qa.viewer.setExploded(false);qa.show('bev','solid');});
  return {results,exploded};
}
