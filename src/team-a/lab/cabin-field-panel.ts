import type { createLabViewer } from '../viewer/lab-viewer';
import type { FieldQuantity } from '../viewer/field-display-data';
import type { SliceAxis } from '../viewer/field-slices';

/** Product controls drive the existing field selectors; there is still one experiment. */
export function mountCabinFieldPanel(root: HTMLElement, viewer: ReturnType<typeof createLabViewer>) {
  const panel=root.querySelector<HTMLElement>('.cp-field-panel')!;
  const field=root.querySelector<HTMLSelectElement>('#lab-field')!;
  const slice=root.querySelector<HTMLSelectElement>('#lab-field-slice')!;
  const hud=root.querySelector<HTMLElement>('.lab-field-hud')!;
  const improvement=hud.querySelector<HTMLButtonElement>('.lab-field-display-controls button')!;
  const card=document.createElement('section');card.className='cp-cabin-card';
  card.setAttribute('aria-label','同座同窗声场对照');
  card.innerHTML=`<header><h3>同座 · 同时间窗</h3><span>参数化仿真</span></header>
    <div class="cp-cabin-pair"><button data-field-quantity="primary"><small>原声 d</small><strong data-reading="primary">—</strong></button><button data-field-quantity="residual"><small>残余 e</small><strong data-reading="residual">—</strong></button><div><small>改善 d − e</small><strong data-reading="reduction">—</strong></div></div>
    <p class="cp-cabin-window">运行实验，查看当前座位读数</p>
    <div class="cp-cabin-quantities" role="group" aria-label="显示声场量"><button data-field-quantity="primary">原声</button><button data-field-quantity="residual">残余</button><button data-field-quantity="reduction">改善量</button></div>
    <div class="cp-cabin-slice-heading"><h3>声场切面</h3><button class="cp-cabin-reset">透视复位</button></div>
    <div class="cp-cabin-slices" role="group" aria-label="声场观察切面"><button data-field-slice="volume">三维</button><button data-field-slice="y">水平</button><button data-field-slice="x">纵向</button><button data-field-slice="z">横向</button></div>
    <div class="cp-cabin-preview"><canvas aria-label="当前车辆同帧声场切面预览"></canvas><canvas aria-hidden="true"></canvas><span>等待有效的空间声场</span></div><p class="cp-cabin-frame"></p>`;
  panel.querySelector('.cp-panel-tabs')!.after(card);
  const advanced=document.createElement('details');advanced.className='cp-cabin-details';
  advanced.innerHTML='<summary>四座测点、计权与显示细节</summary>';
  for(const selector of ['.cp-run-status','.cp-mic-readings','.cp-field-tools','.cp-readings'])advanced.append(panel.querySelector(selector)!);
  card.after(advanced);
  advanced.addEventListener('toggle',()=>{if(!advanced.open)panel.scrollTo({top:0,behavior:'instant'});});
  const canvases=[...card.querySelectorAll('canvas')],empty=card.querySelector<HTMLElement>('.cp-cabin-preview span')!;
  let lastKey='',pending=0,disposed=false,activeCanvas=0;
  function quantity(): FieldQuantity {return improvement.getAttribute('aria-pressed')==='true'?'reduction':field.value==='primary'?'primary':'residual';}
  function previewState() {
    const q=quantity(),axis=(slice.value==='volume'?'y':slice.value) as SliceAxis;
    return {q,axis,key:[viewer.displayAsset,hud.dataset.time,hud.dataset.weighting,hud.dataset.range,q,axis].join('/')};
  }
  function sync() {
    if(disposed)return;
    const q=quantity();
    card.querySelectorAll<HTMLButtonElement>('[data-field-quantity]').forEach(b=>b.setAttribute('aria-pressed',String(field.value!=='off'&&b.dataset.fieldQuantity===q)));
    card.querySelectorAll<HTMLButtonElement>('[data-field-slice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fieldSlice===slice.value)));
    const ready=!hud.hidden&&viewer.hasValidField;
    empty.hidden=ready;canvases.forEach(canvas=>{canvas.hidden=!ready;});
    if(!ready){lastKey='';card.querySelector('.cp-cabin-frame')!.textContent='';return;}
    if(root.dataset.page!=='field'||root.dataset.fieldPanel!=='field'||document.hidden)return;
    if(previewState().key===lastKey||pending)return;
    pending=requestAnimationFrame(()=>{
      pending=0;if(disposed||document.hidden||root.dataset.page!=='field'||root.dataset.fieldPanel!=='field'||hud.hidden||!viewer.hasValidField){lastKey='';return;}
      // Selectors or weighting may change more than once before this paint.
      const {q,axis,key}=previewState();
      const nextCanvas=1-activeCanvas;
      viewer.renderPreview(canvases[nextCanvas],axis==='y',true,'vehicle',{quantity:q,slice:axis});
      canvases.forEach((canvas,i)=>{canvas.style.opacity=i===nextCanvas?'1':'0';canvas.setAttribute('aria-hidden',String(i!==nextCanvas));if(i===nextCanvas)canvas.setAttribute('aria-label','当前车辆同帧声场切面预览');});
      activeCanvas=nextCanvas;
      lastKey=key;
      card.querySelector('.cp-cabin-frame')!.textContent=`${{y:'头部水平',x:'中央纵向',z:'前排横向'}[axis]}切面 · ${Number(hud.dataset.time).toFixed(2)} s · ${q==='primary'?'原声':q==='residual'?'残余':'改善量'} · 与主视图同帧、同色标`;
    });
  }
  card.querySelectorAll<HTMLButtonElement>('[data-field-quantity]').forEach(b=>b.onclick=()=>{
    const q=b.dataset.fieldQuantity!;
    if((improvement.getAttribute('aria-pressed')==='true')!==(q==='reduction'))improvement.click();
    field.value=q==='primary'?'primary':'residual';field.dispatchEvent(new Event('change'));sync();
  });
  card.querySelectorAll<HTMLButtonElement>('[data-field-slice]').forEach(b=>b.onclick=()=>{
    slice.value=b.dataset.fieldSlice!;slice.dispatchEvent(new Event('change'));sync();
  });
  card.querySelector<HTMLButtonElement>('.cp-cabin-reset')!.onclick=()=>{viewer.setStage('gallery');viewer.setPresentationView('field');};
  const observer=new MutationObserver(sync);observer.observe(hud,{attributes:true,attributeFilter:['hidden','data-time','data-weighting','data-quantity','data-range','data-rendering']});
  observer.observe(root,{attributes:true,attributeFilter:['data-page','data-field-panel']});
  document.addEventListener('visibilitychange',sync);
  sync();
  return {
    update(reading: {primary:number;residual:number;reduction:number;time:number;unit:string}|null, seat:number) {
      for(const key of ['primary','residual','reduction'] as const)card.querySelector(`[data-reading="${key}"]`)!.textContent=reading?`${reading[key].toFixed(1)} ${key==='reduction'?'dB':reading.unit}`:'—';
      card.querySelector('.cp-cabin-window')!.textContent=reading?`${['左前','右前','左后','右后'][seat]}座麦克风 · ${reading.time.toFixed(2)} s · 0.5 s 窗`:'运行实验，查看当前座位读数';
      card.dataset.worsened=String(!!reading&&reading.reduction<0);sync();
    },
    dispose(){disposed=true;observer.disconnect();cancelAnimationFrame(pending);document.removeEventListener('visibilitychange',sync);},
  };
}
