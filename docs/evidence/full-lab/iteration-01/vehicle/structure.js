async (page) => {
  await page.evaluate(() => { const qa=window.__vehicleQA; for(const {model,camera} of qa.scenes){ for(const shell of model.shell) shell.visible=false; camera.position.set(4.7,6.5,6.1);camera.lookAt(0,.8,0); }qa.render(); });
  await page.screenshot({path:'output/playwright/vehicle-full/four-structure.png'});
  await page.evaluate(() => { const qa=window.__vehicleQA;for(const {model,camera} of qa.scenes){for(const shell of model.shell)shell.visible=true;for(const part of model.parts)part.object.position.copy(part.origin).addScaledVector(part.offset,.85);camera.position.set(6.7,5,7.4);camera.lookAt(0,1.3,0);}qa.render(); });
  await page.screenshot({path:'output/playwright/vehicle-full/four-exploded.png'});
  return 'captured';
}
