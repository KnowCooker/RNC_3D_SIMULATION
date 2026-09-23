async page => {
  await page.setViewportSize({width:1500,height:1000});
  await page.waitForFunction(() => window.ready === true);
  const views = {
    v1: {position:[6.3,3.9,7.2], body:'solid'},
    v2: {position:[7,1.8,0], body:'solid'},
    v3: {position:[-5.8,3.4,-6.6], body:'solid'},
    v4: {position:[3.7,5,4.4], body:'hidden'},
  };
  const captures=[];
  for (const kind of ['ice','bev','hev','erev']) for (const [view,setting] of Object.entries(views)) {
    const state=await page.evaluate(({kind,view,setting})=>{
      qa.show(kind,setting.body);
      qa.camera.position.set(...setting.position);
      qa.draw();
      return {kind,view,body:setting.body,position:qa.camera.position.toArray(),direction:qa.camera.getWorldDirection(new qa.THREE.Vector3()).toArray(),gpu:qa.renderer.getContext().getParameter(qa.renderer.getContext().getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? qa.renderer.getContext().RENDERER)};
    },{kind,view,setting});
    await page.waitForTimeout(100);
    const path=`output/playwright/a2-full-003/${kind}-${view}.png`;
    await page.screenshot({path});
    captures.push({...state,path});
  }
  return {captures, errors:[]};
}
