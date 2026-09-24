async page => {
  await page.setViewportSize({width:1440,height:1100});
  await page.addInitScript(() => {
    window.__liveQA={errors:[],runs:[],chunks:[],fields:[],requests:[]};
    addEventListener('error',e=>window.__liveQA.errors.push(String(e.message)));
    addEventListener('unhandledrejection',e=>window.__liveQA.errors.push(String(e.reason)));
    const NativeWorker=Worker;
    window.Worker=class extends NativeWorker {
      constructor(...args){super(...args);this.addEventListener('message',({data})=>{
        if(data.type==='ready')window.__liveQA.runs.push({id:data.runId,at:performance.now()});
        if(data.type==='chunk'){
          const {chunk:c,snapshot:s}=data.packet;let maxDE=0,maxU=0,maxA=0;
          for(let m=0;m<4;m++)for(let n=0;n<c.sampleCount;n++){maxDE=Math.max(maxDE,Math.abs(c.signals.e[m][n]-c.signals.d[m][n]));maxU=Math.max(maxU,Math.abs(c.signals.u[m][n]));maxA=Math.max(maxA,Math.abs(c.signals.a[m][n]));}
          window.__liveQA.chunks.push({runId:c.runId,start:c.startSample,count:c.sampleCount,historyStart:s.startSample,historyEnd:s.endSample,historyCount:s.result.sampleCount,maxDE,maxU,maxA,q:c.sources[0][0],metrics:s.result.metrics,at:performance.now()});
          if(window.__liveQA.chunks.length>1000)window.__liveQA.chunks.shift();
        }
        if(data.type==='field'){window.__liveQA.fields.push({runId:data.runId,time:data.frame.time,valid:data.frame.valid});if(window.__liveQA.fields.length>100)window.__liveQA.fields.shift();}
      });}
      postMessage(message,...rest){if(['live-start','calculate'].includes(message.type))window.__liveQA.requests.push({type:message.type,runId:message.runId,config:message.config});super.postMessage(message,...rest);}
    };
  });
  await page.goto('http://127.0.0.1:5177/');
  await page.locator('#lab-status').filter({hasText:'实验就绪'}).waitFor({timeout:30000});
  return {status:await page.locator('#lab-status').innerText()};
}
