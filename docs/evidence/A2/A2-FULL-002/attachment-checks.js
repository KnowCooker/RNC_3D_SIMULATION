async (page) => {
  const checks=[];
  for(let i=0;i<4;i++)await page.locator('#attachment-test button[data-signal="q"][data-channel="'+i+'"]').click();
  const selections=await page.evaluate(()=>window.__attachmentQA.selections);
  if(JSON.stringify(selections.slice(-4))!==JSON.stringify([0,1,2,3].map(channel=>({signal:'q',channel}))))throw Error('Q selection must refer to actual source');checks.push('Q1–4 select q0–3');
  const geometry=await page.evaluate(async()=>{
    const q=window.__attachmentQA,{THREE,viewer}=q;
    q.config.speakerEnabled[1]=false;viewer.setConfig(q.config);viewer.setExploded(true);
    viewer.setField('residual','volume');viewer.updateField({time:1,valid:true,points:viewer.fieldPoints,primarySpl:new Float32Array(280).fill(60),residualSpl:new Float32Array(280).fill(50),reductionDb:new Float32Array(280).fill(10)});
    for(let i=0;i<100;i++){await new Promise(requestAnimationFrame);viewer.render(1,{signal:'q',channel:3},[1,1,1,1],[.1,.2,.3,.4]);}
    const model=q.scene.getObjectByName('teaching-suv-bev'),all=[];q.scene.traverse(o=>all.push(o));
    const progress=model.getObjectByName('roof').position.y;
    const near=(a,b,msg)=>{if(a.distanceTo(b)>1e-5)throw Error(msg+': '+a.toArray()+' vs '+b.toArray());};
    const marker=(s,i)=>all.find(o=>o.userData.selection?.signal===s&&o.userData.selection?.channel===i);
    let attached=0,lines=0,dots=0,waves=0,disabledLines=0,disabledWaves=0;
    for(let i=0;i<4;i++){
      const actual=model.getObjectByName('speaker-'+['fl','fr','rl','rr'][i]).getWorldPosition(new THREE.Vector3());
      near(marker('u',i).position,actual,'OUT attached');attached++;
      near(marker('q',i).position,new THREE.Vector3(i%2? -1:1,.1,i<2?1.45:-1.45).add(new THREE.Vector3((i%2?-1:1)*.55*progress,0,0)),'source wheel offset');attached++;
      near(marker('e',i).position,new THREE.Vector3(i%2?-.48:.48,1.65+.45*progress,i<2?.4:-1.01),'MIC cabin offset');attached++;
      for(const wave of all.filter(o=>o.userData.speaker===i)) {near(wave.position,actual,'wave attached');waves++;if(i===1){if(wave.visible)throw Error('disabled wave visible');disabledWaves++;}}
    }
    near(marker('x',4).position,new THREE.Vector3(0,1.985+progress,-.5),'roof-mounted REF follows roof');attached++;
    const instance=all.find(o=>o.isInstancedMesh);if(Math.abs(instance.parent.position.y-.45*progress)>1e-7)throw Error('field cabin mismatch');
    for(const line of all.filter(o=>o.isLine&&Object.hasOwn(o.userData,'primary'))){
      const start=marker(line.userData.primary?'q':'u',line.userData.channel).position,end=marker('e',line.userData.mic).position;
      near(new THREE.Vector3().fromBufferAttribute(line.geometry.attributes.position,0),start,'path start');near(new THREE.Vector3().fromBufferAttribute(line.geometry.attributes.position,1),end,'path end');lines++;
      const siblings=line.parent.children,dot=siblings[siblings.indexOf(line)+1],direction=end.clone().sub(start),relative=dot.position.clone().sub(start),t=relative.dot(direction)/direction.lengthSq();
      near(relative,direction.multiplyScalar(t),'moving dot lies on moved line');if(t<0||t>1)throw Error('dot outside segment');dots++;
      if(!line.userData.primary&&line.userData.channel===1){if(line.visible||dot.visible)throw Error('disabled secondary path visible');disabledLines++;}
    }
    const glass=[];model.traverse(o=>{if(o.isMesh&&o.material.color?.getHexString()==='88c6d8')glass.push(o.material.opacity);});if(!glass.every(a=>a===.28))throw Error('solid mode must retain glass');
    return {progress,attached,lines,dots,waves,disabledLines,disabledWaves,glassCount:glass.length};
  });checks.push(geometry);
  await page.screenshot({path:'output/playwright/attachment-full/exploded-attached.png'});
  return {checks};
}
