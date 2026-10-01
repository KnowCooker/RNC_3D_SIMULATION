import { drawSignalComparison } from './plots';
import type { LabAnalysis } from '../../shared/lab-contracts';
import type { CaseSnapshot } from './case-compare';
import type { createLabViewer } from '../viewer/lab-viewer';
import type { XPengId } from '../viewer/xpeng-catalog';
import type { GalleryEnvironment } from '../viewer/champagne-gallery';
import './champagne.css';

type Page = 'overview' | 'field' | 'structure' | 'compare';
const icons: Record<string, string> = {
  car: '<path d="m5 9 2-5h10l2 5M3 10h18v8H3zM6 18v3m12-3v3M6 13h2m8 0h2"/>',
  seat: '<path d="M8 3v10h10l3 7H6l-3-8m5-6h6v7"/>',
  wave: '<path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4"/>',
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7zm0 10 9-5M3 7l9 5v10M7 4l10 6"/>',
};
const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

/** Rehomes existing controls; one experiment, one viewer and one transport across pages. */
export function createChampagneShell(root: HTMLElement, viewer: ReturnType<typeof createLabViewer>, redraw: () => void) {
  root.classList.add('cp-app');
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#lab-${id}`)!;
  const element = (html: string) => { const template = document.createElement('template'); template.innerHTML = html; return template.content.firstElementChild as HTMLElement; };
  const originalMain = root.querySelector('.lab-main')!, oldHeader = root.querySelector('.lab-header')!, journey = root.querySelector('.lab-journey')!;
  const shell = element(`<section class="cp-shell" data-page="overview">
    <header class="cp-header"><a class="cp-brand" href="#overview" aria-label="汽车主动降噪数字孪生平台，总览"><svg viewBox="0 0 64 38" aria-hidden="true"><path d="M3 25C15 38 20 0 34 13S50 39 61 23M17 12C31-3 37 12 46 19"/></svg><span>汽车主动降噪数字孪生平台<small>RNC · A QUIETER WORLD</small></span></a><nav aria-label="主导航">${(['overview','field','structure','compare'] as Page[]).map((p,i)=>`<button data-page="${p}" aria-current="${i===0?'page':'false'}">${['总览','声场实验','结构与布置','方案对比'][i]}</button>`).join('')}</nav><button class="cp-more" aria-label="帮助与数据来源">•••</button></header>
    <main class="cp-stage">
      <div class="cp-hero"><span class="cp-eyebrow">QUIETER DRIVES. A BRIGHTER TOMORROW.</span><h1>让每一段旅程，都更安静</h1><p>以数字孪生，洞察声音的本质</p></div>
      <div class="cp-work-title"><span class="cp-eyebrow">EXPLORE / UNDERSTAND / REFINE</span><h1></h1><div class="cp-config-line"></div></div>
      <div class="cp-mode-rail" role="group" aria-label="车辆显示模式">${[['solid','car','外观'],['transparent','seat','透明'],['field','wave','声场'],['explode','cube','拆解']].map(([mode,img,label])=>`<button data-mode="${mode}" aria-pressed="${mode==='solid'}">${icon(img)}<span>${label}</span></button>`).join('')}</div>
      <div class="cp-asset"><label>当前车辆<select aria-label="展示车辆"><option value="p7plus">小鹏 P7+ · 2026</option><option value="x9">小鹏 X9</option><option value="l03">MONA L03</option><option value="m03">MONA M03</option><option value="gx">小鹏 GX</option></select></label><span class="cp-asset-note">照片参考重建 · 可旋转与拆解</span></div>
      <section class="cp-field-card cp-glass" aria-labelledby="cp-field-title"><div class="cp-card-heading"><h2 id="cp-field-title">车内声场</h2><button data-go="field" aria-label="进入车内声场">↗</button></div><canvas class="cp-model-preview" aria-label="当前车型三维缩略图"></canvas><div class="cp-field-empty"><strong>从一次实验，听见改变</strong><p>运行 P7+ 声场实验后，查看同一时间窗的原声与残余。</p></div><div class="cp-levels"><div><small>原声 d</small><b data-level="primary">—</b></div><div><small>残余 e</small><b data-level="residual">—</b></div><div><small>改善</small><b data-level="reduction">—</b></div></div><small class="cp-data-note">尚无有效实验 · 不显示示例读数</small></section>
      <div class="cp-summary-cards">
        <button class="cp-glass cp-summary" data-card="paths"><span>传递路径 <i>↗</i></span><small>从路面激励，理解声音如何抵达座舱</small><div class="cp-path-art"><b>路面</b><i>→</i><b>轮胎</b><i>→</i><b>车身</b><i>→</i><b>座舱</b></div><em>路径解释与实际通道分析</em></button>
        <button class="cp-glass cp-summary" data-card="structure"><span>结构布置 <i>↗</i></span><small>逐件探索，检查传感器与执行器</small><canvas class="cp-layout-preview" aria-label="当前车型座舱俯视图"></canvas><em>参考传感器 · 误差麦克风 · 扬声器</em></button>
        <button class="cp-glass cp-summary" data-card="spectrum"><span>频谱对比 <i>↗</i></span><small>相同座位、相同时间窗的声音变化</small><canvas class="cp-spectrum-preview" aria-label="当前实验频谱缩略图"></canvas><em class="cp-spectrum-empty">等待有效计算数据</em></button>
      </div>
      <div class="cp-environments cp-glass" role="group" aria-label="三维环境">${[['coast','海岸'],['mountain','山地'],['desert','沙漠'],['snow','雪山']].map(([id,name])=>`<button data-env="${id}" aria-pressed="${id==='coast'}"><span class="cp-landscape cp-landscape-${id}" aria-hidden="true"></span><span>${name}</span></button>`).join('')}</div>
      <button class="cp-cta" data-go="field">进入声场实验 <span>→</span></button>
      <div class="cp-field-panel cp-glass"><div class="cp-card-heading"><h2>声场实验</h2><button class="cp-settings-button">工况设置</button></div><p class="cp-layout-notice"></p><button class="cp-teaching-button">切换 P7+ 实验车</button><div class="cp-run-actions"><button class="cp-run lab-primary">启动当前实验</button><button class="cp-stop">结束 / 取消</button></div><p class="cp-run-status" role="status"></p><div class="cp-field-tools"></div><div class="cp-readings"></div><div class="cp-charts"></div></div>
      <div class="cp-structure-tools cp-glass"><div class="cp-card-heading"><h2>结构与布置</h2><button class="cp-settings-button">编辑声学硬件</button></div><p>部件可点选、逐件拆装与复位。P7+ 安装点随部件显示，计算始终使用回装坐标。</p><label class="cp-hardware-toggle"><input type="checkbox" aria-label="显示声学安装点">显示声学安装点</label><div class="cp-structure-controls"></div></div>
      <div class="cp-comparison cp-glass"><div class="cp-card-heading"><h2>方案对比</h2><button class="cp-settings-button">配置下一次实验</button></div><p class="cp-compare-intro">保存基线 A，改变一个设计因素，再与候选 B 比较。所有结论保留条件与时间窗。</p></div>
      <div class="cp-bottom-bar"></div><div class="cp-footer-note">湖畔展厅 / <span>海岸</span> · 环境仅改变景物，路面参数独立设置</div>
    </main>
    <dialog class="cp-dialog cp-settings" aria-labelledby="cp-settings-title"><header><div><small>EXPERIMENT SETUP</small><h2 id="cp-settings-title">车辆、工况与控制</h2></div><button data-close aria-label="关闭工况设置">×</button></header><div class="cp-dialog-content"></div></dialog>
    <dialog class="cp-dialog cp-help" aria-labelledby="cp-help-title"><header><h2 id="cp-help-title">数据来源与使用说明</h2><button data-close aria-label="关闭说明">×</button></header><div class="cp-dialog-content"></div></dialog>
    <dialog class="cp-dialog cp-paths-dialog" aria-labelledby="cp-paths-title"><header><h2 id="cp-paths-title">传递路径与控制机理</h2><button data-close aria-label="关闭传递路径">×</button></header><div class="cp-dialog-content"></div></dialog>
    <div class="cp-announcement" role="status" aria-live="polite"></div>
  </section>`);
  root.append(shell);
  const q = <T extends HTMLElement = HTMLElement>(selector: string) => shell.querySelector<T>(selector)!;
  q('.cp-stage').prepend(get('viewer'));
  q('.cp-config-line').append(get('current-config'), get('run'));
  q('.cp-settings .cp-dialog-content').append(get('controls'));
  const sceneSettings = element('<section class="cp-scene-settings"><h3>场景与路面</h3><label>展示场景<select aria-label="展示场景"><option value="gallery">湖畔展厅</option><option value="road">三维道路</option><option value="workshop">装配车间</option></select></label><label>道路材质与声学预设<select aria-label="道路材质与声学预设"><option value="smooth">平整沥青 · 0.6</option><option value="coarse">粗糙沥青 · 1.2</option><option value="gravel">碎石路 · 2.2</option></select></label><small>场景切换不改计算；应用路面预设会修改粗糙度并使旧结果失效。</small></section>');
  q('.cp-settings .cp-dialog-content').prepend(sceneSettings);
  sceneSettings.append(get('road-selection-status'));
  sceneSettings.querySelector<HTMLSelectElement>('[aria-label="展示场景"]')!.onchange = event => viewer.setStage((event.target as HTMLSelectElement).value as 'gallery'|'road'|'workshop');
  sceneSettings.querySelector<HTMLSelectElement>('[aria-label="道路材质与声学预设"]')!.onchange = event => viewer.setRoadSurface((event.target as HTMLSelectElement).value as 'smooth'|'coarse'|'gravel');
  q('.cp-help .cp-dialog-content').append(root.querySelector('.lab-disclosure')!, get('guide'), root.querySelector('.lab-sources')!);
  q('.cp-help .cp-dialog-content').append(element('<p class="cp-attribution">展厅湖畔环境：<a href="https://polyhaven.com/a/qwantani_sunset" target="_blank" rel="noreferrer">Qwantani Sunset</a>，摄影 Greg Zaal，处理 Jarod Guest / Poly Haven，<a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">CC0</a>。素材已随本地构建打包；建筑和植被为原创三维几何。</p>'));
  q('.cp-paths-dialog .cp-dialog-content').append(root.querySelector('.lab-signals')!);
  q('.cp-comparison').append(get('case'));
  const caseCards = element('<div class="cp-case-pair"><article data-case="A"><span>方案 A / 基线</span><h3>等待保存基线</h3><div class="cp-case-seats"></div><small>运行一次预计算实验，再保存基线。</small></article><article data-case="B"><span>方案 B / 候选</span><h3>等待候选实验</h3><div class="cp-case-seats"></div><small>调整一个设计因素后，重新计算。</small></article></div>');
  get('case-state').before(caseCards);
  q('.cp-bottom-bar').append(root.querySelector('.lab-player')!);
  q('.cp-readings').append(get('metrics'), root.querySelector('.lab-field-note')!, get('field-evidence'));
  const viewTools = [...originalMain.querySelectorAll<HTMLElement>('.lab-view-tools')];
  if(viewTools[0]) q('.cp-structure-controls').append(viewTools[0]);
  if(viewTools[1]) q('.cp-field-tools').append(viewTools[1]);
  q('.cp-charts').append(root.querySelector('.lab-plots')!);
  // Preserve hidden controls referenced by existing event closures without duplicate IDs.
  const retained = element('<div hidden></div>');
  for (const id of ['controls-toggle','controls-close']) retained.append(get(id));
  q('.cp-help .cp-dialog-content').append(retained);
  oldHeader.remove(); journey.remove(); originalMain.remove();
  let previewRun = '';
  let page: Page = 'overview', hasAnalysis = false, lastAnalysis: LabAnalysis | null = null, lastOriginal: LabAnalysis | null = null, lastUnit = 'dBA', lastSeat = 0, lastRun = '', lastSampleRate = 2000, lastOffset = 0;
  q<HTMLInputElement>('[aria-label="显示声学安装点"]').onchange = event => viewer.setHardwareOverlay((event.target as HTMLInputElement).checked);
  const asset = q<HTMLSelectElement>('[aria-label="展示车辆"]');
  const announce = (message: string) => { q('.cp-announcement').textContent = message; };
  function syncAsset() {
    const teaching = viewer.displayAsset === 'xpeng-p7plus';
    if(!asset.disabled && viewer.displayAsset.startsWith('xpeng-')) asset.value = viewer.displayAsset.replace('xpeng-','');
    q('.cp-asset-note').textContent = teaching ? '同车声学实验 · 2026 纯电后驱' : '照片参考重建 · 可旋转与拆解';
    q('.cp-layout-notice').textContent = teaching ? 'P7+ 同车坐标 · 四轮激励 / 四扬声器 / 四座测点。调整工况后运行，查看空间声场。' : '此车型支持外观与拆装检视。声场实验当前支持 P7+，请切换实验车。';
    q<HTMLButtonElement>('.cp-teaching-button').hidden = teaching;
    q('.cp-config-line').hidden = !teaching;
    q('.cp-run-actions').hidden = q('.cp-run-status').hidden = !teaching;
    q('.cp-field-tools').hidden = q('.cp-readings').hidden = q('.cp-charts').hidden = !teaching;
    q('.cp-field-empty').hidden = hasAnalysis && teaching;
    updateLevels();
  }
  function navigate(next: Page) {
    if(next!=='field') {get<HTMLSelectElement>('field').value='off';get('field').dispatchEvent(new Event('change'));}
    if(next==='overview' && viewer.displayAsset.startsWith('xpeng-')) {get<HTMLSelectElement>('body').value='solid';get('body').dispatchEvent(new Event('change'));}
    page = next; shell.dataset.page = next; root.dataset.page = next;
    q('.cp-work-title h1').textContent = {overview:'',field:'看见声音，理解安静',structure:'从结构，理解每一处细节',compare:'让每一次选择，都有依据'}[next];
    shell.querySelectorAll<HTMLButtonElement>('.cp-header [data-page]').forEach(b=>b.setAttribute('aria-current',b.dataset.page===next?'page':'false'));
    if(next==='field' && viewer.displayAsset==='xpeng-p7plus') { get<HTMLSelectElement>('field').value='residual'; get('field').dispatchEvent(new Event('change')); }
    if(next==='field') shell.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String((el as HTMLElement).dataset.mode==='field')));
    viewer.setPresentationView(next); syncAsset(); requestAnimationFrame(redraw);
  }
  function openDialog(selector: string) { const dialog = q<HTMLDialogElement>(selector); if(!dialog.open) dialog.showModal(); requestAnimationFrame(redraw); }
  shell.querySelectorAll<HTMLButtonElement>('.cp-header [data-page]').forEach(b=>b.onclick=()=>navigate(b.dataset.page as Page));
  shell.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go as Page));
  q<HTMLAnchorElement>('.cp-brand').onclick = e => { e.preventDefault(); navigate('overview'); };
  shell.querySelectorAll<HTMLButtonElement>('.cp-settings-button').forEach(b=>b.onclick=()=>openDialog('.cp-settings'));
  q<HTMLButtonElement>('.cp-more').onclick=()=>openDialog('.cp-help');
  shell.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog')!.close());
  const chooseAsset = async () => {
    asset.disabled = true;
    try { await viewer.showVehicle(asset.value as 'teaching' | XPengId); get('reset').click(); viewer.setStage('gallery'); viewer.setPresentationView(page); syncAsset(); viewer.renderPreview(q<HTMLCanvasElement>('.cp-model-preview')); viewer.renderPreview(q<HTMLCanvasElement>('.cp-layout-preview'),true); }
    finally { asset.disabled = false; }
  };
  asset.onchange=()=>void chooseAsset();
  q<HTMLButtonElement>('.cp-teaching-button').onclick=()=>{asset.value='p7plus';void chooseAsset();};
  q<HTMLButtonElement>('.cp-run').onclick=()=>get('calculate').click();
  q<HTMLButtonElement>('.cp-stop').onclick=()=>get('cancel').click();
  const frameField = () => { if(page==='field') { viewer.setPresentationView(page); shell.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String((el as HTMLElement).dataset.mode==='field'))); } };
  get('field').addEventListener('change',frameField); get('field-slice').addEventListener('change',frameField);
  get('reset').addEventListener('click',()=>{shell.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String((el as HTMLElement).dataset.mode==='solid')));viewer.setPresentationView(page);});
  shell.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.onclick=()=>{
    const mode = b.dataset.mode!;
    if(mode==='field') { navigate('field'); if(viewer.displayAsset==='xpeng-p7plus') {get<HTMLSelectElement>('field').value='residual';get('field').dispatchEvent(new Event('change'));} }
    else if(mode==='explode') {navigate('structure'); if(get('explode').getAttribute('aria-pressed')!=='true') get('explode').click();}
    else {get<HTMLSelectElement>('field').value='off';get('field').dispatchEvent(new Event('change'));get<HTMLSelectElement>('body').value=mode;get('body').dispatchEvent(new Event('change'));}
    shell.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));
  });
  shell.querySelectorAll<HTMLButtonElement>('[data-env]').forEach(b=>b.onclick=()=>{
    viewer.setEnvironment(b.dataset.env as GalleryEnvironment);
    shell.querySelectorAll('[data-env]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));
    q('.cp-footer-note span').textContent=b.lastElementChild!.textContent;
    announce(`已切换${b.lastElementChild!.textContent}三维景物，声学工况保持不变。`);
  });
  q<HTMLButtonElement>('[data-card="paths"]').onclick=()=>openDialog('.cp-paths-dialog');
  q<HTMLButtonElement>('[data-card="structure"]').onclick=()=>navigate('structure');
  q<HTMLButtonElement>('[data-card="spectrum"]').onclick=()=>{navigate('field');q('.cp-charts').scrollIntoView({block:'nearest'});};
  function updateLevels() {
    const visible = hasAnalysis && viewer.displayAsset==='xpeng-p7plus';
    const values = lastAnalysis ? [lastAnalysis.primarySpl[lastSeat],lastAnalysis.residualSpl[lastSeat],lastAnalysis.reductionDb[lastSeat]] : [];
    ['primary','residual','reduction'].forEach((key,i)=>{q(`[data-level="${key}"]`).textContent=visible && values[i]!=null ? `${values[i]!.toFixed(1)} ${i===2?'dB':lastUnit}` : '—';});
    q('.cp-data-note').textContent=visible ? `${['左前','右前','左后','右后'][lastSeat]}座 · ${lastUnit} · 教学尺度 · 实验 ${lastRun.slice(0,8)}` : '尚无当前车辆的有效声场 · 不显示示例读数';
    q('.cp-spectrum-empty').hidden=visible;
    const preview=q<HTMLCanvasElement>('.cp-spectrum-preview'), context=preview.getContext('2d')!;
    preview.width=Math.max(1,preview.clientWidth*2);preview.height=Math.max(1,preview.clientHeight*2);
    if(visible && lastAnalysis && lastOriginal) drawSignalComparison(preview,lastAnalysis,lastOriginal,lastSampleRate,lastOffset,true,false);
    else context.clearRect(0,0,preview.width,preview.height);
  }
  const observer = new MutationObserver(()=>{
    syncAsset();
    q('.cp-announcement').textContent = get('status').textContent;
    q('.cp-run-status').textContent = get('status').textContent;
    q<HTMLButtonElement>('.cp-run').disabled = get<HTMLButtonElement>('calculate').disabled;
    q<HTMLButtonElement>('.cp-stop').disabled = get<HTMLButtonElement>('cancel').disabled;
    q('.cp-run').textContent = get('calculate').textContent;
  }); observer.observe(get('status'),{childList:true,subtree:true,characterData:true});
  observer.observe(get('calculate'),{attributes:true,childList:true}); observer.observe(get('cancel'),{attributes:true});
  q<HTMLButtonElement>('.cp-stop').disabled = true;
  q('.cp-run-status').textContent = get('status').textContent;
  viewer.setStage('gallery');
  if(location.hash==='#xpeng') asset.value='x9';
  navigate('overview'); void chooseAsset();
  return {
    update(analysis: LabAnalysis, original: LabAnalysis, seat: number, unit: string, runId: string, sampleRate: number, offset: number) {hasAnalysis=true;lastAnalysis=analysis;lastOriginal=original;lastSeat=seat;lastUnit=unit;lastRun=runId;lastSampleRate=sampleRate;lastOffset=offset;syncAsset();if(analysis.valid && viewer.hasValidField && previewRun!==runId) {viewer.renderPreview(q<HTMLCanvasElement>('.cp-model-preview'),false,true);previewRun=runId;}},
    clear() {hasAnalysis=false;lastAnalysis=null;previewRun='';syncAsset();viewer.renderPreview(q<HTMLCanvasElement>('.cp-model-preview'));},
    showSignal() { openDialog('.cp-paths-dialog'); },
    updateCases(base: CaseSnapshot | null, candidate: CaseSnapshot | null) {
      [base,candidate].forEach((value,index)=>{
        const card=caseCards.children[index] as HTMLElement;
        card.querySelector('h3')!.textContent=value ? `末 ${value.windowEndSeconds.toFixed(1)} 秒 · 残余声压` : index ? '等待候选实验' : '等待保存基线';
        const seats=card.querySelector('.cp-case-seats')!;seats.replaceChildren();
        if(value) value.residualSpl.forEach((level,i)=>{const item=document.createElement('div');const name=document.createElement('small');name.textContent=['左前','右前','左后','右后'][i];const number=document.createElement('strong');number.textContent=level===null?'—':`${level.toFixed(1)}`;item.append(name,number);seats.append(item);});
        card.querySelector('article>small')!.textContent=value ? `dBA · P7+ 参数化布局 · ${value.config.speedKph} km/h · 实验 ${value.runId.slice(0,8)}` : index ? '调整一个设计因素后，重新计算。' : '运行一次预计算实验，再保存基线。';
      });
    },
    dispose() {observer.disconnect();shell.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());},
  };
}
