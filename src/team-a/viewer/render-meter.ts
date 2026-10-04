/** Bounded render-loop observations, not a GPU timer or a device-wide FPS claim. */
export function createRenderMeter(host: HTMLElement) {
  let samples:number[]=[],last=0,key='',calls=0,triangles=0;
  return (now:number,context:string,drawCalls:number,drawTriangles:number) => {
    if(context!==key || !last || now-last>250){samples=[];calls=triangles=0;key=context;last=now;return;}
    samples.push(now-last);last=now;calls+=drawCalls;triangles+=drawTriangles;
    if(samples.length<90)return;
    const sorted=[...samples].sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length;
    host.dataset.renderMeter=JSON.stringify({context,frames:samples.length,fps:Number((1000/mean).toFixed(1)),p95Ms:Number(sorted[Math.floor(sorted.length*.95)].toFixed(1)),drawCalls:Math.round(calls/samples.length),triangles:Math.round(triangles/samples.length)});
    samples=[];calls=triangles=0;
  };
}
