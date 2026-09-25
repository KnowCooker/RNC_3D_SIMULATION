async (page) => {
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const {createVehicleModel} = await import('/src/team-a/viewer/vehicle-model.ts');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#14232e';document.body.append(host);
    const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); renderer.setSize(1600,1000); renderer.setPixelRatio(1);host.append(renderer.domElement);renderer.setScissorTest(true);
    const scenes = []; const metadata=[];
    for (const [index,kind] of ['ice','bev','hev','erev'].entries()) {
      const scene=new THREE.Scene();scene.background=new THREE.Color('#14232e');scene.add(new THREE.HemisphereLight('#e9f9ff','#445563',3));
      const light=new THREE.DirectionalLight('#fff5e2',4);light.position.set(3,6,4);scene.add(light);
      const light2=new THREE.DirectionalLight('#83bdeb',2);light2.position.set(-3,2,-4);scene.add(light2);
      const model=createVehicleModel(kind);scene.add(model.group);
      const camera=new THREE.PerspectiveCamera(35,1.6,.1,60);camera.position.set(6,3.7,6.7);camera.lookAt(0,1,0);
      const title=document.createElement('div');title.textContent=kind.toUpperCase();title.style.cssText=`position:absolute;left:${(index%2)*800+20}px;top:${Math.floor(index/2)*500+10}px;color:#e8f9ff;font:24px sans-serif`;host.append(title);
      let tris=0,meshes=0;model.group.traverse(o=>{if(o.isMesh){meshes++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});metadata.push({kind,meshes,tris,parts:model.parts.length});
      scenes.push({scene,model,camera,index});
    }
    function render(){for(const {scene,camera,index} of scenes){const x=(index%2)*800,y=(1-Math.floor(index/2))*500;renderer.setViewport(x,y,800,500);renderer.setScissor(x,y,800,500);renderer.render(scene,camera);}}
    render();window.__vehicleQA={scenes,renderer,render};return metadata;
  });
  await page.screenshot({path:'output/playwright/vehicle-full/four-solid.png'});return result;
}
