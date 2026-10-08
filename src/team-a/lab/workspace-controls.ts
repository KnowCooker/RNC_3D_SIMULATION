import { presentationIcon as icon } from './presentation-icons';

export type ObservationMode = 'gallery' | 'road' | 'inspect' | 'workshop';
export type DrivingEnvironment = 'coast' | 'mountain' | 'desert' | 'snow';
export const DRIVING_ENVIRONMENTS: readonly [DrivingEnvironment, string][] = [['coast','田野公路'],['mountain','山地'],['desert','沙漠'],['snow','雪山']];
export const observationMode = (stage?: string, overlay?: string): ObservationMode => stage === 'road' ? overlay === 'true' ? 'inspect' : 'road' : stage === 'workshop' ? 'workshop' : 'gallery';

export function observationDockMarkup() {
  return `<section class="cp-mode-dock cp-glass" aria-label="展厅与道路模式切换"><div class="cp-dock-label"><small>探索方式</small><strong>选择观察场景</strong></div><div class="cp-dock-modes" role="group" aria-label="观察场景"><button type="button" data-observation="gallery" aria-pressed="true">${icon('wave')}<span>展厅声场<small>静态观察车内声音分布</small></span></button><button type="button" data-observation="road" aria-pressed="false">${icon('route')}<span>道路行驶<small>进入三维道路与行驶环境</small></span></button></div><button type="button" class="cp-drive-inspect" data-observation="inspect" aria-pressed="false">${icon('layout')}行驶声场</button></section>`;
}

export function drivingEnvironmentMarkup() {
  return `<section class="cp-driving-environments cp-glass" aria-label="选择行驶环境" hidden><header><div><small>DRIVING ENVIRONMENT</small><h2>选择行驶环境</h2></div><span class="cp-driving-current" role="status"></span></header><div class="cp-driving-environment-options" role="group" aria-label="行驶环境">${DRIVING_ENVIRONMENTS.map(([id,name])=>`<button type="button" data-driving-env="${id}" aria-pressed="${id==='coast'}"><span class="cp-landscape cp-landscape-${id}" aria-hidden="true"></span><span>${name}</span></button>`).join('')}</div><p>景物切换不改变噪声输入；路面粗糙度在工况设置中单独调整。</p></section>`;
}

/** A disclosure retains the actual controls and event handlers; it does not remount the viewer. */
export function mountPanelDisclosure(panel: HTMLElement, title: string, id: string, redraw: () => void) {
  let header=panel.querySelector<HTMLElement>(':scope > .cp-card-heading');
  if(!header){header=document.createElement('div');header.className='cp-card-heading';const heading=document.createElement('h2');heading.textContent=title;header.append(heading);panel.prepend(header);}
  const body=document.createElement('div');body.className='cp-panel-body';body.id=id;
  for(const child of [...panel.children])if(child!==header)body.append(child);
  panel.append(body);panel.classList.add('cp-disclosure-panel');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='cp-panel-toggle';toggle.setAttribute('aria-controls',id);header.append(toggle);
  let collapsed=false,frame=0;
  const setCollapsed=(value:boolean)=>{
    collapsed=value;
    if(value&&body.contains(document.activeElement))toggle.focus();
    body.hidden=value;panel.dataset.collapsed=String(value);
    toggle.setAttribute('aria-expanded',String(!value));toggle.setAttribute('aria-label',`${value?'展开':'收起'}${title}控制面板`);
    toggle.innerHTML=`${icon('chevron')}<span>${value?'展开':'收起'}</span>`;
    panel.scrollTop=0;cancelAnimationFrame(frame);frame=requestAnimationFrame(redraw);
  };
  const click=()=>setCollapsed(!collapsed);
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!collapsed){event.preventDefault();event.stopPropagation();setCollapsed(true);toggle.focus();}};
  toggle.addEventListener('click',click);body.addEventListener('keydown',escape);setCollapsed(false);
  return {setCollapsed,dispose(){cancelAnimationFrame(frame);toggle.removeEventListener('click',click);body.removeEventListener('keydown',escape);}};
}
