async page => {
  await page.waitForFunction(() => window.ready === true);
  const result=await page.evaluate(()=>{
    qa.show('bev','solid');
    const model=qa.scene.getObjectByName('teaching-suv-bev');
    const measure=()=>{
      qa.draw();model.updateWorldMatrix(true,true);
      const box=new qa.THREE.Box3().setFromObject(model),p=[];
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])p.push(new qa.THREE.Vector3(x,y,z).project(qa.camera));
      const minX=Math.min(...p.map(v=>v.x)),maxX=Math.max(...p.map(v=>v.x));
      const minY=Math.min(...p.map(v=>v.y)),maxY=Math.max(...p.map(v=>v.y));
      return {width:(maxX-minX)/2,height:(maxY-minY)/2,minX,maxX,minY,maxY,inside:minX>-1&&maxX<1&&minY>-1&&maxY<1,camera:qa.camera.position.toArray()};
    };
    qa.camera.position.set(6.3,3.9,7.2);const previous=measure();
    qa.viewer.reset();const updated=measure();
    return {previous,updated};
  });
  await page.screenshot({path:'output/playwright/a2-full-003/bev-default-framing.png'});
  return {...result,improved:result.updated.width>result.previous.width*1.1&&result.updated.inside};
}
