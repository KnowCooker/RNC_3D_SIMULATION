import { drawSignalComparison, plot } from './plots';
import { registeredVehicleLayout, type LabAnalysis } from '../../shared/lab-contracts';
import type { CaseSnapshot } from './case-compare';
import type { createLabViewer } from '../viewer/lab-viewer';
import type { XPengId } from '../viewer/xpeng-catalog';
import type { GalleryEnvironment } from '../viewer/champagne-gallery';
import './champagne.css';
import './champagne-overview.css';
import { presentationIcon as icon } from './presentation-icons';
import { mountOverviewMotion, overviewMotionMarkup } from './overview-motion';
import './overview-motion.css';
import { overviewReading } from './overview-reading';
import './champagne-workspace.css';
import { mountCabinFieldPanel } from './cabin-field-panel';
import './cabin-field.css';

type Page = 'overview' | 'field' | 'structure' | 'compare';
/** Rehomes existing controls; one experiment, one viewer and one transport across pages. */
export function createChampagneShell(root: HTMLElement, viewer: ReturnType<typeof createLabViewer>, redraw: () => void, changeVehicle: (id:XPengId)=>Promise<void>) {
  root.classList.add('cp-app');
  root.dataset.environment='coast';
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#lab-${id}`)!;
  const element = (html: string) => { const template = document.createElement('template'); template.innerHTML = html; return template.content.firstElementChild as HTMLElement; };
  const originalMain = root.querySelector('.lab-main')!, oldHeader = root.querySelector('.lab-header')!, journey = root.querySelector('.lab-journey')!;
  const shell = element(`<section class="cp-shell" data-page="overview">
    <header class="cp-header"><a class="cp-brand" href="#overview" aria-label="汽车主动降噪数字孪生平台，总览"><svg viewBox="0 0 64 38" aria-hidden="true"><path d="M3 25C15 38 20 0 34 13S50 39 61 23M17 12C31-3 37 12 46 19"/></svg><span>汽车主动降噪数字孪生平台<small>RNC · A QUIETER WORLD</small></span></a><nav aria-label="主导航">${(['overview','field','structure','compare'] as Page[]).map((p,i)=>`<button data-page="${p}" aria-current="${i===0?'page':'false'}">${['总览','声场实验','结构与布置','方案对比'][i]}</button>`).join('')}</nav><span class="cp-header-note">数字孪生 · 参数化仿真</span><button class="cp-more" aria-label="帮助与数据来源">${icon('more')}</button></header>
    <main class="cp-stage">
      <div class="cp-hero"><span class="cp-eyebrow">QUIETER DRIVES. A BRIGHTER TOMORROW.</span><h1>让每一段旅程，都更安静</h1><p>以数字孪生，洞察声音的本质</p></div>
      <div class="cp-work-title"><span class="cp-eyebrow">EXPLORE / UNDERSTAND / REFINE</span><h1></h1><div class="cp-config-line"></div></div>
      <div class="cp-mode-rail" role="group" aria-label="车辆显示模式">${[['solid','car','外观'],['transparent','seat','透明'],['field','wave','声场'],['explode','cube','拆解']].map(([mode,img,label])=>`<button data-mode="${mode}" aria-pressed="${mode==='solid'}">${icon(img as 'car'|'seat'|'wave'|'cube')}<span>${label}</span></button>`).join('')}</div>
      <div class="cp-asset"><label>当前车辆<select aria-label="展示车辆"><option value="p7plus">小鹏 P7+ · 2026</option><option value="x9">小鹏 X9</option><option value="l03">MONA L03</option><option value="m03">MONA M03</option><option value="gx" selected>小鹏 GX · SUV</option></select></label><span class="cp-asset-note">照片参考重建 · 可旋转与拆解</span></div>
      <section class="cp-field-card cp-glass" aria-labelledby="cp-field-title"><div class="cp-card-heading"><h2 id="cp-field-title">车内声场</h2><div class="cp-card-actions"><button class="cp-motion-toggle" type="button" aria-label="暂停展示动画" aria-pressed="false">${icon('pause')}</button><button data-go="field" aria-label="进入车内声场">${icon('chevron')}</button></div></div><div class="cp-acoustic-visual"><button class="cp-motion-enter" data-go="field" aria-label="查看当前车辆声场">${overviewMotionMarkup('field')}</button><div class="cp-mini-scale" aria-label="概念图相对强弱色标，不对应实验分贝"><small>示意</small><i></i><span><b>高</b><b>低</b></span></div></div><div class="cp-field-empty"><span>当前车辆 · 尚未运行实验</span><button type="button" class="cp-overview-run">开始当前实验 ${icon('arrow')}</button></div><div class="cp-levels"><div><small>原声 d</small><b data-level="primary">—</b></div><span class="cp-level-arrow" aria-hidden="true">${icon('arrow')}</span><div><small>残余 e</small><b data-level="residual">—</b></div><div><small>改善</small><b data-level="reduction">—</b></div></div><small class="cp-data-note">当前实验读数 · 等待计算</small></section>
      <div class="cp-summary-cards">
        <button class="cp-glass cp-summary" data-card="paths"><span>传递路径 <i>${icon('chevron')}</i></span><small>识别与分析多路径噪声传递</small>${overviewMotionMarkup('paths')}<em class="cp-card-legend"><span><i class="cp-dot amber"></i>路面激励</span><span><i class="cp-dot blue"></i>结构传递</span><span>路径示意</span></em></button>
        <button class="cp-glass cp-summary" data-card="structure"><span>结构布置 <i>${icon('chevron')}</i></span><small>传感器与执行器的协同布局</small>${overviewMotionMarkup('layout')}<em class="cp-card-legend"><span><i class="cp-dot blue"></i>麦克风</span><span><i class="cp-dot amber"></i>参考传感器</span><span><i class="cp-dot red"></i>扬声器</span></em></button>
        <button class="cp-glass cp-summary" data-card="spectrum"><span>频谱对比 <i>${icon('chevron')}</i></span><small>关键位置噪声频谱变化</small><div class="cp-spectrum-key"><span>原声 d</span><span>残余 e</span></div><canvas class="cp-spectrum-preview" aria-label="当前实验频谱缩略图"></canvas><em class="cp-spectrum-empty">运行实验，查看同窗频谱</em></button>
      </div>
      <div class="cp-environments cp-glass" role="group" aria-label="三维环境">${[['coast','海岸'],['mountain','山地'],['desert','沙漠'],['snow','雪山']].map(([id,name])=>`<button data-env="${id}" aria-pressed="${id==='coast'}"><span class="cp-landscape cp-landscape-${id}" aria-hidden="true"></span><span>${name}</span></button>`).join('')}</div>
      <button class="cp-cta" data-go="field">进入声场实验 ${icon('arrow')}</button><div class="cp-signature">更安静的出行体验<small>A QUIETER WORLD</small></div>
      <div class="cp-field-panel cp-glass"><div class="cp-card-heading"><h2>声场实验</h2><button class="cp-settings-button">工况设置</button></div><p class="cp-layout-notice"></p><button class="cp-teaching-button">切换 P7+ 实验车</button><div class="cp-run-actions"><button class="cp-run lab-primary">启动当前实验</button><button class="cp-stop">结束 / 取消</button></div><p class="cp-run-status" role="status"></p><div class="cp-panel-tabs" role="group" aria-label="实验面板"><button data-panel="field" aria-pressed="true">声场与读数</button><button data-panel="charts" aria-pressed="false">信号图表</button><button data-panel="observe" aria-pressed="false">行驶观察</button></div><div class="cp-observation-panel"></div><div class="cp-field-tools"></div><div class="cp-readings"></div><div class="cp-charts"></div></div>
      <div class="cp-structure-tools cp-glass"><div class="cp-card-heading"><h2>结构与布置</h2><button class="cp-settings-button">编辑声学硬件</button></div><div class="cp-structure-tabs" role="group" aria-label="结构检视"><button data-inspect="layout" aria-pressed="true">${icon('layout')}结构布置</button><button data-inspect="paths" aria-pressed="false">${icon('route')}传递路径</button></div><p class="cp-structure-description">部件可点选、逐件拆装与复位。当前车型安装点随部件显示，计算始终使用回装坐标。</p><div class="cp-path-inspection" hidden><label>显示路径<select aria-label="当前车辆传递路径"><option value="both">全部路径</option><option value="primary">初级路径 · 激励至座舱</option><option value="secondary">次级路径 · 扬声器至座舱</option><option value="none">隐藏路径</option></select></label><p>基于当前车型安装点显示传递关系；线条为路径示意，声学响应由当前实验计算。</p><button class="cp-path-mechanism">查看控制机理 ${icon('arrow')}</button></div><label class="cp-hardware-toggle"><input type="checkbox" aria-label="显示声学安装点">显示声学安装点</label><div class="cp-structure-controls"></div></div>
      <div class="cp-comparison cp-glass"><div class="cp-card-heading"><h2>方案对比</h2><button class="cp-settings-button">配置下一次实验</button></div><p class="cp-compare-intro">保存基线 A，改变一个设计因素，再与候选 B 比较。所有结论保留条件与时间窗。</p></div>
      <div class="cp-bottom-bar"></div><div class="cp-environment-status" role="status"><span></span><button type="button" hidden>重试环境</button></div><div class="cp-footer-note">湖畔展厅 / <span>海岸</span> · 环境仅改变景物，路面参数独立设置</div>
    </main>
    <dialog class="cp-dialog cp-settings" aria-labelledby="cp-settings-title"><header><div><small>EXPERIMENT SETUP</small><h2 id="cp-settings-title">车辆、工况与控制</h2></div><button data-close aria-label="关闭工况设置">${icon('close')}</button></header><div class="cp-dialog-content"></div></dialog>
    <dialog class="cp-dialog cp-help" aria-labelledby="cp-help-title"><header><h2 id="cp-help-title">数据来源与使用说明</h2><button data-close aria-label="关闭说明">${icon('close')}</button></header><div class="cp-dialog-content"></div></dialog>
    <dialog class="cp-dialog cp-paths-dialog" aria-labelledby="cp-paths-title"><header><h2 id="cp-paths-title">传递路径与控制机理</h2><button data-close aria-label="关闭传递路径">${icon('close')}</button></header><div class="cp-dialog-content"></div></dialog>
    <div class="cp-announcement" role="status" aria-live="polite"></div>
  </section>`);
  root.append(shell);
  const q = <T extends HTMLElement = HTMLElement>(selector: string) => shell.querySelector<T>(selector)!;
  const overviewMotion = mountOverviewMotion(shell);
  q('.cp-stage').prepend(get('viewer'));
  q('.cp-config-line').append(get('current-config'), get('run'));
  q('.cp-settings .cp-dialog-content').append(get('controls'));
  const sceneSettings = element('<section class="cp-scene-settings"><h3>场景与路面</h3><label>展示场景<select aria-label="展示场景"><option value="gallery">湖畔展厅</option><option value="road">三维道路</option><option value="workshop">装配车间</option></select></label><label>道路材质与声学预设<select aria-label="道路材质与声学预设"><option value="smooth">平整沥青 · 0.6</option><option value="coarse">粗糙沥青 · 1.2</option><option value="gravel">碎石路 · 2.2</option></select></label><small>场景切换不改计算；应用路面预设会修改粗糙度并使旧结果失效。</small></section>');
  q('.cp-settings .cp-dialog-content').prepend(sceneSettings);
  sceneSettings.append(get('road-selection-status'));
  const settingsTabs=element('<div class="cp-settings-tabs" role="group" aria-label="设置分类"><button data-setting="conditions" aria-pressed="true">车辆与工况</button><button data-setting="algorithm" aria-pressed="false">控制与硬件</button><button data-setting="scene" aria-pressed="false">三维场景</button></div>');
  const conditions=element('<section data-settings-pane="conditions"></section>'),algorithm=element('<section data-settings-pane="algorithm" hidden></section>');
  let settingsTarget=conditions;
  for(const child of [...get('controls').children]) {
    if(child.id==='lab-calculate'||child.id==='lab-cancel'||child.id==='lab-status'||child.id==='lab-controls-close')continue;
    if(child.tagName==='H2' && child.textContent?.startsWith('02'))settingsTarget=algorithm;
    settingsTarget.append(child);
  }
  get('controls').prepend(conditions,algorithm);sceneSettings.dataset.settingsPane='scene';sceneSettings.hidden=true;
  q('.cp-settings .cp-dialog-content').prepend(settingsTabs);
  const showSettingsPanel=(name:string)=>{q('.cp-settings').querySelectorAll<HTMLElement>('[data-settings-pane]').forEach(p=>p.hidden=p.dataset.settingsPane!==name);settingsTabs.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.setting===name)));q('.cp-settings').scrollTop=0;};
  settingsTabs.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>showSettingsPanel(b.dataset.setting!));
  sceneSettings.querySelector<HTMLSelectElement>('[aria-label="展示场景"]')!.onchange = event => viewer.setStage((event.target as HTMLSelectElement).value as 'gallery'|'road'|'workshop');
  sceneSettings.querySelector<HTMLSelectElement>('[aria-label="道路材质与声学预设"]')!.onchange = event => viewer.setRoadSurface((event.target as HTMLSelectElement).value as 'smooth'|'coarse'|'gravel');
  q('.cp-help .cp-dialog-content').append(root.querySelector('.lab-disclosure')!, get('guide'), root.querySelector('.lab-sources')!);
  q('.cp-help .cp-dialog-content').append(element('<p class="cp-attribution">路旁地形：<a href="https://polyhaven.com/a/aerial_grass_rock" target="_blank" rel="noreferrer">Aerial Grass Rock</a>（Rob Tuytel，2K/CC0）。道路新增素材：<a href="https://polyhaven.com/a/small_rural_road" target="_blank" rel="noreferrer">Small Rural Road</a>（Andreas Mischok，8K实拍全景）、<a href="https://polyhaven.com/a/asphalt_02" target="_blank" rel="noreferrer">Asphalt 02</a>（Rob Tuytel）、<a href="https://polyhaven.com/a/gravel_floor" target="_blank" rel="noreferrer">Gravel Floor</a>（Matterfield / Jenelle van Heerden）；4K颜色/2K法线，均CC0。路旁为按里程生成的三维景物，非实测路线。四环境采用完整360°实拍全景：<a href="https://polyhaven.com/a/lakes" target="_blank" rel="noreferrer">Lakes</a>（Sergej Majboroda）、<a href="https://polyhaven.com/a/alps_field" target="_blank" rel="noreferrer">Alps Field</a>、<a href="https://polyhaven.com/a/lago_disola" target="_blank" rel="noreferrer">Lago d’Isola</a>（Andreas Mischok）、<a href="https://polyhaven.com/a/goegap" target="_blank" rel="noreferrer">Goegap</a>（Greg Zaal）。均为Poly Haven / <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">CC0</a>；背景原生8192×4096，配套2K或4K HDR负责光照与反射，全部本地打包、按需加载。展厅、植被为原创三维几何；海岸展厅远景采用AI创作的湖畔日落球面美术背景，非实测环境；车辆、展厅和控件为实时三维与HTML。道路保留实拍全景。菜单海岸/沙漠小图为AI创作预览。环境不代表实车测试地点。</p>'));
  q('.cp-help .cp-dialog-content').append(element('<p class="cp-attribution">总览三张车辆卡为 AI 创作的概念渲染与循环动效，不是当前车型测量或仿真帧。下方读数来自当前实验；点击卡片进入当前车型三维模型与参数化仿真。界面采用本地 Noto Sans SC / Noto Serif SC 字体子集（SIL OFL 1.1），许可随项目提供。</p>'));
  q('.cp-paths-dialog .cp-dialog-content').append(root.querySelector('.lab-signals')!);
  q('.cp-comparison').append(get('case'));
  const method=element('<details class="cp-compare-method"><summary>比较条件与方法</summary></details>');
  method.append(root.querySelector('.lab-case-intro')!,get('case-policy'));get('case').append(method);
  const workflow=element('<div class="cp-case-workflow"><ol aria-label="方案比较步骤"><li>01 计算并保存 A</li><li>02 修改并计算 B</li><li>03 复核与导出</li></ol><div class="lab-case-actions"><button id="lab-case-run" class="lab-primary">结束实时并计算基线 A</button><button class="cp-case-configure">调整候选参数</button></div><small id="lab-case-next-note">实时记录不会直接作为比较基线；以当前配置重新计算完整实验。</small></div>');
  get('case').prepend(workflow);
  const caseCards = element('<div class="cp-case-pair"><article data-case="A"><span>方案 A / 基线</span><h3>等待保存基线</h3><div class="cp-case-seats"></div><small>运行一次预计算实验，再保存基线。</small></article><article data-case="B"><span>方案 B / 候选</span><h3>等待候选实验</h3><div class="cp-case-seats"></div><small>调整一个设计因素后，重新计算。</small></article></div>');
  workflow.after(caseCards);
  q<HTMLButtonElement>('.cp-case-configure').onclick=()=>{showSettingsPanel('algorithm');openDialog('.cp-settings');};
  q('.cp-bottom-bar').append(root.querySelector('.lab-player')!);
  const micReadings=element('<div class="cp-mic-readings" aria-label="四座位当前实验读数"></div>');micReadings.append(get('metrics'));q('.cp-field-tools').before(micReadings);
  q('.cp-readings').append(root.querySelector('.lab-field-note')!, get('field-evidence'));
  const viewTools = [...originalMain.querySelectorAll<HTMLElement>('.lab-view-tools')];
  if(viewTools[0]) q('.cp-structure-controls').append(viewTools[0]);
  if(viewTools[1]) q('.cp-field-tools').append(viewTools[1]);
  q('.cp-readings').prepend(get('viewer').querySelector('.lab-field-hud')!);
  const driveModes=element('<div class="cp-drive-modes" aria-label="实验观察模式"><button data-stage="gallery">展厅声场</button><button data-stage="road">道路行驶</button><button data-stage="inspect">行驶声场</button><label>行驶环境<select aria-label="行驶环境"><option value="coast">田野公路</option><option value="mountain">山地</option><option value="desert">沙漠</option><option value="snow">雪山</option></select></label></div>');
  q('.cp-observation-panel').append(driveModes,get('viewer').querySelector('.lab-driving-controls')!);
  const extraViews=element('<div class="lab-view-tools" aria-label="传播示意"></div>');extraViews.append(get('paths').closest('label')!,get('waves').closest('label')!);q('.cp-observation-panel').append(extraViews);
  root.dataset.fieldPanel='field';
  const showPanel=(name:string)=>{root.dataset.fieldPanel=name;shell.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.panel===name)));requestAnimationFrame(redraw);};
  shell.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button=>button.onclick=()=>showPanel(button.dataset.panel!));
  driveModes.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b=>b.onclick=()=>{if(b.dataset.stage==='gallery'){viewer.setStage('gallery');viewer.setPresentationView('field');}else if(b.dataset.stage==='inspect')q<HTMLButtonElement>('[data-drive-analysis]').click();else{const overlay=q<HTMLButtonElement>('[data-drive-overlay]');if(overlay.getAttribute('aria-pressed')==='true')overlay.click();viewer.setStage('road');q<HTMLButtonElement>('[data-view="orbit"]').click();}});
  driveModes.querySelector<HTMLSelectElement>('select')!.onchange=e=>viewer.setEnvironment((e.target as HTMLSelectElement).value as GalleryEnvironment);
  const driveObserver=new MutationObserver(()=>{const stage=get('viewer').dataset.stage;sceneSettings.querySelector<HTMLSelectElement>('[aria-label="道路材质与声学预设"]')!.value=get('viewer').dataset.roadSurface??'smooth';root.dataset.stage=stage??'';q('.cp-footer-note').firstChild!.textContent=stage==='road'?'仿真道路 / ':'湖畔展厅 / ';sceneSettings.querySelector<HTMLSelectElement>('[aria-label="展示场景"]')!.value=stage??'gallery';driveModes.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stage==='gallery'?stage==='gallery':stage==='road'&&(b.dataset.stage==='inspect')===(get('viewer').dataset.drivingOverlay==='true'))));});
  const driveSeat=(e:Event)=>{const channel=(e as CustomEvent<{channel:number|null}>).detail.channel;if(channel!==null){get<HTMLSelectElement>('seat').value=String(channel);get('seat').dispatchEvent(new Event('change'));}};
  get('viewer').addEventListener('driving-view-change',driveSeat);
  driveObserver.observe(get('viewer'),{attributes:true,attributeFilter:['data-stage','data-road-surface','data-driving-overlay']});

  get<HTMLSelectElement>('field-slice').options[0].textContent='连续三维声场';
  q('.cp-charts').append(root.querySelector('.lab-plots')!);
  const cabinField=mountCabinFieldPanel(root,viewer);
  // Preserve hidden controls referenced by existing event closures without duplicate IDs.
  const retained = element('<div hidden></div>');
  for (const id of ['controls-toggle','controls-close']) retained.append(get(id));
  q('.cp-help .cp-dialog-content').append(retained);
  oldHeader.remove(); journey.remove(); originalMain.remove();
  let rememberedField = 'residual', navigating = false;
  const events = new AbortController();
  let page: Page = 'overview', hasAnalysis = false, lastAnalysis: LabAnalysis | null = null, lastOriginal: LabAnalysis | null = null, lastUnit = 'dBA', lastSeat = 0, lastRun = '', lastSampleRate = 2000, lastOffset = 0;
  q<HTMLInputElement>('[aria-label="显示声学安装点"]').onchange = event => viewer.setHardwareOverlay((event.target as HTMLInputElement).checked);
  const asset = q<HTMLSelectElement>('[aria-label="展示车辆"]');
  const announce = (message: string) => { q('.cp-announcement').textContent = message; };
  let lastAssetState='';
  function syncAsset() {
    const teaching = viewer.acousticAvailable;
    const state=`${viewer.displayAsset}/${teaching}/${hasAnalysis}/${asset.disabled}`;
    if(state===lastAssetState)return;lastAssetState=state;
    if(!asset.disabled && viewer.displayAsset.startsWith('xpeng-')) asset.value = viewer.displayAsset.replace('xpeng-','');
    q('.cp-asset-note').textContent = teaching ? '同车声学实验 · 独立车型布局' : '照片参考重建 · 可旋转与拆解';
    q('.cp-layout-notice').textContent = teaching ? '当前车型坐标 · 四轮激励 / 四扬声器 / 前两排四座测点。调整工况后运行，查看空间声场。' : '正在匹配当前车型的声学布局。';
    q<HTMLButtonElement>('.cp-teaching-button').hidden = teaching;
    q('.cp-config-line').hidden = !teaching;
    q('.cp-run-actions').hidden = q('.cp-run-status').hidden = !teaching;
    q('.cp-field-tools').hidden = q('.cp-readings').hidden = q('.cp-charts').hidden = !teaching;
    q('.cp-field-empty').hidden = !!(hasAnalysis && overviewReading(lastAnalysis,lastSeat,lastOffset));
    updateLevels();
  }
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const uiAnimations=new Set<Animation>();let navigated=false;
  function animatePanel(el:HTMLElement,dialog=false,delay=0){
    if(reduceMotion.matches||!el.getClientRects().length)return;
    const motion=el.animate([{opacity:0,transform:dialog?'translateY(10px) scale(.985)':'translateY(10px)'},{opacity:1,transform:'none'}],{duration:dialog?220:260,delay,easing:'cubic-bezier(.22,.75,.25,1)',fill:'backwards'});
    uiAnimations.add(motion);motion.onfinish=motion.oncancel=()=>uiAnimations.delete(motion);
  }
  const closingDialogs=new WeakSet<HTMLDialogElement>();
  function closeDialog(dialog:HTMLDialogElement){
    if(!dialog.open||closingDialogs.has(dialog))return;
    if(reduceMotion.matches){dialog.close();return;}
    closingDialogs.add(dialog);const motion=dialog.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(6px) scale(.99)'}],{duration:110,easing:'ease-out'});
    uiAnimations.add(motion);motion.onfinish=()=>{uiAnimations.delete(motion);closingDialogs.delete(dialog);if(dialog.open)dialog.close();};
    motion.oncancel=()=>{uiAnimations.delete(motion);closingDialogs.delete(dialog);};
  }
  function navigate(next: Page) {
    const changed=page!==next;
    if (!changed && navigated) return;
    if(page==='field' && get<HTMLSelectElement>('field').value!=='off') rememberedField=get<HTMLSelectElement>('field').value;
    navigating=true;
    viewer.setPresentationView(next);
    uiAnimations.forEach(a=>a.cancel());uiAnimations.clear();
    if(next!=='field') {get<HTMLSelectElement>('field').value=next==='overview'?rememberedField:'off';get('field').dispatchEvent(new Event('change'));}
    if(next==='overview' && viewer.displayAsset.startsWith('xpeng-')) {get<HTMLSelectElement>('body').value='solid';get('body').dispatchEvent(new Event('change'));}
    page = next; shell.dataset.page = next; root.dataset.page = next; overviewMotion.setActive(next==='overview');
    q('.cp-work-title h1').textContent = {overview:'',field:'探索更安静的旅程',structure:'结构与布置',compare:'方案对比与结论'}[next];
    shell.querySelectorAll<HTMLButtonElement>('.cp-header [data-page]').forEach(b=>b.setAttribute('aria-current',b.dataset.page===next?'page':'false'));
    if(next==='field' && viewer.acousticAvailable) { get<HTMLSelectElement>('field').value=rememberedField; get('field').dispatchEvent(new Event('change')); }
    if(next==='field') shell.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String((el as HTMLElement).dataset.mode==='field')));
    if(next==='overview') shell.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String((el as HTMLElement).dataset.mode==='solid')));
    navigating=false; syncAsset(); requestAnimationFrame(redraw);
    if(changed&&navigated){const selectors=next==='overview'?['.cp-hero','.cp-field-card','.cp-summary-cards','.cp-environments']:next==='field'?['.cp-work-title','.cp-field-panel']:next==='structure'?['.cp-structure-tools']:['.cp-work-title','.cp-comparison'];selectors.forEach((selector,i)=>animatePanel(q(selector),false,i*25));}
    navigated=true;
  }
  function openDialog(selector: string) { const dialog = q<HTMLDialogElement>(selector); if(!dialog.open){dialog.showModal();animatePanel(dialog,true);}requestAnimationFrame(redraw); }
  shell.querySelectorAll<HTMLButtonElement>('.cp-header [data-page]').forEach(b=>b.onclick=()=>navigate(b.dataset.page as Page));
  shell.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(b=>b.onclick=()=>openRealField());
  q<HTMLAnchorElement>('.cp-brand').onclick = e => { e.preventDefault(); navigate('overview'); };
  shell.querySelectorAll<HTMLButtonElement>('.cp-settings-button').forEach(b=>b.onclick=()=>{showSettingsPanel('conditions');openDialog('.cp-settings');});
  q<HTMLButtonElement>('.cp-more').onclick=()=>openDialog('.cp-help');
  shell.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.closest('dialog')!));
  shell.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);}));
  const chooseAsset = async () => {
    asset.disabled = true;
    try { await changeVehicle(asset.value as XPengId); if(asset.value==='gx')viewer.setPresentationPaint('#b9b4a9'); get('reset').click(); viewer.setStage('gallery'); viewer.setPresentationView(page); syncAsset(); if(page==='overview'||page==='field'){get<HTMLSelectElement>('field').value=rememberedField;get('field').dispatchEvent(new Event('change'));} else if(page==='structure') inspectStructure(root.dataset.structureView==='paths'?'paths':'layout'); }
    finally { asset.disabled = false; }
  };
  asset.onchange=()=>void chooseAsset();
  q<HTMLButtonElement>('.cp-teaching-button').onclick=()=>{asset.value='p7plus';void chooseAsset();};
  q<HTMLButtonElement>('.cp-run').onclick=()=>get('calculate').click();
  q<HTMLButtonElement>('.cp-overview-run').onclick=()=>{openRealField();if(!hasAnalysis)get('calculate').click();};
  q<HTMLButtonElement>('.cp-stop').onclick=()=>get('cancel').click();
  const frameField = () => { if(page==='field'&&!navigating) { rememberedField=get<HTMLSelectElement>('field').value; shell.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String((el as HTMLElement).dataset.mode===(rememberedField==='off'?'solid':'field')))); } };
  get('field').addEventListener('change',frameField,{signal:events.signal}); get('field-slice').addEventListener('change',frameField,{signal:events.signal});
  get('reset').addEventListener('click',()=>{shell.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String((el as HTMLElement).dataset.mode==='solid')));viewer.setPresentationView(page);},{signal:events.signal});
  shell.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.onclick=()=>{
    const mode = b.dataset.mode!;
    if(mode==='field') { openRealField(); if(viewer.acousticAvailable) {get<HTMLSelectElement>('field').value='residual';get('field').dispatchEvent(new Event('change'));} }
    else if(mode==='explode') {navigate('structure'); if(get('explode').getAttribute('aria-pressed')!=='true') get('explode').click();}
    else {if(page!=='overview'){get<HTMLSelectElement>('field').value='off';get('field').dispatchEvent(new Event('change'));}get<HTMLSelectElement>('body').value=mode;get('body').dispatchEvent(new Event('change'));}
    shell.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));
  });
  shell.querySelectorAll<HTMLButtonElement>('[data-env]').forEach(b=>b.onclick=()=>{
    viewer.setEnvironment(b.dataset.env as GalleryEnvironment);
    root.dataset.environment=b.dataset.env!;
    shell.querySelectorAll('[data-env]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));
    q('.cp-footer-note span').textContent=b.lastElementChild!.textContent;
    announce(`已切换${b.lastElementChild!.textContent}三维景物，声学工况保持不变。`);
  });
  function openRealField() {
    navigate('field');showPanel('field');
    driveModes.querySelector<HTMLButtonElement>('[data-stage="gallery"]')!.click();
  }
  function inspectStructure(kind: 'paths' | 'layout') {
    navigate('structure');
    root.dataset.structureView=kind;
    q<HTMLInputElement>('[aria-label="显示声学安装点"]').checked=true;
    viewer.setHardwareOverlay(true);
    get<HTMLSelectElement>('body').value='transparent';get('body').dispatchEvent(new Event('change'));
    get<HTMLSelectElement>('paths').value=kind==='paths'?'both':'none';get('paths').dispatchEvent(new Event('change'));
    q<HTMLSelectElement>('[aria-label="当前车辆传递路径"]').value=kind==='paths'?'both':'none';
    q('.cp-path-inspection').hidden=kind!=='paths';
    q('.cp-structure-tools h2').textContent=kind==='paths'?'传递路径':'结构与布置';
    q('.cp-structure-description').textContent=kind==='paths'?'在当前车辆上观察四轮激励、扬声器与座舱测点之间的传递关系。拖动可环绕查看。':'部件可点选、逐件拆装与复位。当前车型安装点随部件显示，计算始终使用回装坐标。';
    q('.cp-work-title h1').textContent=kind==='paths'?'沿声音的来处，寻找答案':'结构与布置';
    shell.querySelectorAll<HTMLButtonElement>('[data-inspect]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.inspect===kind)));
  }
  shell.querySelectorAll<HTMLButtonElement>('[data-inspect]').forEach(b=>b.onclick=()=>inspectStructure(b.dataset.inspect as 'paths'|'layout'));
  q<HTMLSelectElement>('[aria-label="当前车辆传递路径"]').onchange=event=>{get<HTMLSelectElement>('paths').value=(event.target as HTMLSelectElement).value;get('paths').dispatchEvent(new Event('change'));};
  get('paths').addEventListener('change',()=>{q<HTMLSelectElement>('[aria-label="当前车辆传递路径"]').value=get<HTMLSelectElement>('paths').value;},{signal:events.signal});
  q<HTMLButtonElement>('.cp-path-mechanism').onclick=()=>openDialog('.cp-paths-dialog');
  q<HTMLButtonElement>('[data-card="paths"]').onclick=()=>inspectStructure('paths');
  q<HTMLButtonElement>('[data-card="structure"]').onclick=()=>inspectStructure('layout');
  q<HTMLButtonElement>('[data-card="spectrum"]').onclick=()=>{navigate('field');showPanel('charts');};
  function updateLevels() {
    const visible = hasAnalysis && lastAnalysis?.valid === true && viewer.acousticAvailable;
    const reading=visible?overviewReading(lastAnalysis,lastSeat,lastOffset):null,unit=reading?.unit??lastUnit;
    cabinField.update(reading,lastSeat);
    const values=reading?[reading.primary,reading.residual,reading.reduction]:[];
    ['primary','residual','reduction'].forEach((key,i)=>{q(`[data-level="${key}"]`).textContent=reading&&Number.isFinite(values[i])?`${values[i].toFixed(1)} ${i===2?'dB':unit}`:'—';});
    q('.cp-field-empty').hidden=!!reading;
    q('.cp-field-empty>span').textContent=hasAnalysis?'实验已就绪 · 播放或定位至 0.5 秒之后查看读数':'当前车辆 · 尚未运行实验';
    q('.cp-overview-run').innerHTML=`${hasAnalysis?'查看实验回放':'开始当前实验'} ${icon('arrow')}`;
    q('.cp-data-note').textContent=reading?`当前实验 · ${['左前','右前','左后','右后'][lastSeat]}座麦克风 · ${reading.time.toFixed(2)} s · 0.5 s 同窗 · 仿真`:hasAnalysis?'当前时间窗不足或读数不可用 · 未显示旧值':'当前实验读数 · 等待计算';
    q('.cp-spectrum-empty').hidden=visible;
    const preview=q<HTMLCanvasElement>('.cp-spectrum-preview'), context=preview.getContext('2d')!;
    if(visible && lastAnalysis && lastOriginal) drawSignalComparison(preview,lastAnalysis,lastOriginal,lastSampleRate,lastOffset,true,false,[20,lastSampleRate/2],{x:[20,lastSampleRate/2],y:null,rightY:null,xScale:'log',showOriginal:true,weighting:lastAnalysis.spectrumWeighting??'A'});
    else {context.clearRect(0,0,preview.width,preview.height);plot(preview,[],{x:[20,1000],y:[0,80],xScale:'log',xLabel:'频率 Hz',yLabel:'PSD dB/Hz',empty:'等待有效计算数据'});}
  }
  const previewResize = new ResizeObserver(() => { if(page==='overview') updateLevels(); });
  previewResize.observe(q('.cp-spectrum-preview'));
  const observer = new MutationObserver(()=>{
    syncAsset();
    q('.cp-announcement').textContent = get('status').textContent;
    q('.cp-run-status').textContent = get('status').textContent;
    q<HTMLButtonElement>('.cp-run').disabled = get<HTMLButtonElement>('calculate').disabled;
    q<HTMLButtonElement>('.cp-stop').disabled = get<HTMLButtonElement>('cancel').disabled;
    q('.cp-run').textContent = get('calculate').textContent;
  }); observer.observe(get('status'),{childList:true,subtree:true,characterData:true});
  observer.observe(get('calculate'),{attributes:true,childList:true}); observer.observe(get('cancel'),{attributes:true});
  const environmentStatus=q('.cp-environment-status'), retryEnvironment=environmentStatus.querySelector<HTMLButtonElement>('button')!;
  retryEnvironment.onclick=()=>viewer.setEnvironment((get('viewer').dataset.environment??'coast') as GalleryEnvironment);
  const environmentObserver=new MutationObserver(()=>{
    const failed=get('viewer').dataset.environmentFailed==='true', ready=!!get('viewer').dataset.environmentReady;
    environmentStatus.hidden=ready&&!failed;retryEnvironment.hidden=!failed;
    environmentStatus.querySelector('span')!.textContent=failed?'高清环境加载失败，当前使用基础景物。':'正在加载高清环境…';
    q('.cp-environments').setAttribute('aria-busy',String(!ready&&!failed));
    const env=get('viewer').dataset.environment as GalleryEnvironment|undefined;if(env){driveModes.querySelector<HTMLSelectElement>('select')!.value=env;shell.querySelectorAll<HTMLButtonElement>('[data-env]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.env===env)));q('.cp-footer-note span').textContent=({coast:get('viewer').dataset.stage==='road'?'田野公路':'海岸',mountain:'山地',desert:'沙漠',snow:'雪山'})[env];}
  });environmentObserver.observe(get('viewer'),{attributes:true,attributeFilter:['data-environment-ready','data-environment-failed','data-environment','data-stage']});
  q<HTMLButtonElement>('.cp-stop').disabled = true;
  q('.cp-run-status').textContent = get('status').textContent;
  viewer.setStage('gallery');
  if(location.hash==='#xpeng') asset.value='x9';
  navigate('overview'); void chooseAsset();
  return {
    update(analysis: LabAnalysis, original: LabAnalysis, seat: number, unit: string, runId: string, sampleRate: number, offset: number) {hasAnalysis=true;lastAnalysis=analysis;lastOriginal=original;lastSeat=seat;lastUnit=unit;lastRun=runId;lastSampleRate=sampleRate;lastOffset=offset;syncAsset();updateLevels();},
    clear() {hasAnalysis=false;lastAnalysis=null;lastOriginal=null;lastRun='';syncAsset();updateLevels();},
    showSignal() { openDialog('.cp-paths-dialog'); },
    showPage(next: Page) {shell.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());navigate(next);},
    showSettings() {shell.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());showSettingsPanel('conditions');openDialog('.cp-settings');},
    updateCases(base: CaseSnapshot | null, candidate: CaseSnapshot | null) {
      [base,candidate].forEach((value,index)=>{
        const card=caseCards.children[index] as HTMLElement;
        card.dataset.ready=String(!!value);
        card.querySelector('h3')!.textContent=value ? `${(value.windowEndSeconds-.5).toFixed(1)}–${value.windowEndSeconds.toFixed(1)} s · 残余声压` : index ? '等待候选实验' : '等待保存基线';
        const seats=card.querySelector('.cp-case-seats')!;seats.replaceChildren();
        if(value) value.residualSpl.forEach((level,i)=>{const item=document.createElement('div');const name=document.createElement('small');name.textContent=['左前','右前','左后','右后'][i];const number=document.createElement('strong');number.textContent=level===null?'—':`${level.toFixed(1)}`;item.append(name,number);seats.append(item);});
        card.querySelector('article>small')!.textContent=value ? `dBA · ${registeredVehicleLayout(value.config.layoutId)?.name ?? value.config.vehicle} · ${value.config.speedKph} km/h · 实验 ${value.runId.slice(0,8)}` : index ? '调整一个设计因素后，重新计算。' : '运行一次预计算实验，再保存基线。';
      });
    },
    dispose() {cabinField.dispose();previewResize.disconnect();overviewMotion.dispose();events.abort();get('viewer').removeEventListener('driving-view-change',driveSeat);driveObserver.disconnect();uiAnimations.forEach(a=>a.cancel());uiAnimations.clear();observer.disconnect();environmentObserver.disconnect();shell.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());},
  };
}
