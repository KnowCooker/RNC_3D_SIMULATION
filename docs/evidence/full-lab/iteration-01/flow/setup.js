async page => {
  await page.setViewportSize({width:1440,height:1100});
  await page.addInitScript(() => {
    window.__qaWorkers=[];window.__qaErrors=[];
    addEventListener('error',e=>window.__qaErrors.push(String(e.message)));
    addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason)));
    const NativeWorker=Worker;
    window.Worker=class extends NativeWorker {
      constructor(...args){super(...args);this.addEventListener('message',({data})=>{
        if(data.type!=='result')return;
        const r=data.result;
        const maxAbs=arrays=>Math.max(...arrays.map(a=>a.reduce((m,v)=>Math.max(m,Math.abs(v)),0)));
        let maxDifference=0;
        for(let i=0;i<4;i++)for(let n=0;n<r.signals.d[i].length;n++)maxDifference=Math.max(maxDifference,Math.abs(r.signals.d[i][n]-r.signals.e[i][n]));
        window.__qaWorkers.push({runId:r.runId,config:r.config,computeMilliseconds:r.computeMilliseconds,maxAbsU:maxAbs(r.signals.u),maxAbsA:maxAbs(r.signals.a),maxDE:maxDifference,metrics:r.metrics});
      });}
    };
  });
  await page.goto('http://127.0.0.1:5177/');
  await page.locator('#lab-status').filter({hasText:'实验就绪'}).waitFor({timeout:60000});
  return {status:await page.locator('#lab-status').innerText(),workers:await page.evaluate(()=>window.__qaWorkers)};
}
