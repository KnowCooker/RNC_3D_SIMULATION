async (page) => {
  return await page.evaluate(async () => {
    if(window.__attachmentQA){window.__attachmentQA.viewer.dispose();window.__attachmentQA.host.remove();}
    const moduleText=await (await fetch('/src/team-a/viewer/lab-viewer.ts')).text();
    const threePath=moduleText.match(/import \* as THREE from ["']([^"']+)["']/)[1];
    const THREE=await import(threePath);
    const {createLabViewer}=await import('/src/team-a/viewer/lab-viewer.ts');
    const {defaultLabConfig}=await import('/src/shared/lab-contracts.ts');
    const host=document.createElement('div');host.id='attachment-test';host.style.cssText='position:fixed;inset:0;z-index:99999;width:1500px;height:1000px;background:#101a25';document.body.append(host);
    const selections=[],additions=[];const qa={host,selections,additions,THREE,scene:null,camera:null,renderer:null};
    const previous=Object.getOwnPropertyDescriptor(THREE.WebGLRenderer.prototype,'render');
    Object.defineProperty(THREE.WebGLRenderer.prototype,'render',{configurable:true,set(fn){const renderer=this;Object.defineProperty(this,'render',{configurable:true,writable:true,value:function(scene,camera){if(renderer.domElement===host.querySelector('canvas')){qa.scene=scene;qa.camera=camera;qa.renderer=renderer;}return fn.call(renderer,scene,camera);}});}});
    const viewer=createLabViewer(host,{select:s=>selections.push(s),add:(position,mountPart)=>additions.push({position,mountPart}),context:()=>{}});
    if(previous)Object.defineProperty(THREE.WebGLRenderer.prototype,'render',previous);else delete THREE.WebGLRenderer.prototype.render;
    const config=defaultLabConfig();config.references.push({id:'roof-test',name:'ROOF TEST',position:[0,1.985,-.5],mountPart:'roof'});
    viewer.setConfig(config);viewer.setBody('solid');viewer.setPaths('both');viewer.setWaves(true);viewer.render(1,{signal:'q',channel:3},[1,1,1,1],[.1,.2,.3,.4]);
    qa.viewer=viewer;qa.config=config;window.__attachmentQA=qa;
    return {buttons:[...host.querySelectorAll('button')].map(e=>({text:e.textContent,signal:e.dataset.signal,channel:e.dataset.channel})),parts:qa.scene.getObjectByName('teaching-suv-bev').children.length};
  });
}
