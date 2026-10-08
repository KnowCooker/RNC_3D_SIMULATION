import { presentationIcon as icon } from './presentation-icons';

export type ObservationMode = 'gallery' | 'road' | 'inspect' | 'workshop';
export type DrivingEnvironment = 'coast' | 'mountain' | 'desert' | 'snow';
export const DRIVING_ENVIRONMENTS: readonly [DrivingEnvironment, string][] = [['coast','田野公路'],['mountain','山地'],['desert','沙漠'],['snow','雪山']];
export const observationMode = (stage?: string, overlay?: string): ObservationMode => stage === 'road' ? overlay === 'true' ? 'inspect' : 'road' : stage === 'workshop' ? 'workshop' : 'gallery';

export function observationDockMarkup() {
  return `<section class="cp-mode-dock cp-glass" aria-label="展厅与道路模式切换"><div class="cp-dock-modes" role="group" aria-label="观察场景"><button type="button" data-observation="gallery" aria-pressed="true">${icon('wave')}<span>展厅声场</span></button><button type="button" data-observation="road" aria-pressed="false">${icon('route')}<span>道路行驶</span></button></div><button type="button" class="cp-drive-inspect" data-observation="inspect" aria-pressed="false" aria-label="行驶声场" title="行驶声场">${icon('layout')}<span>行驶声场</span></button></section>`;
}

export function drivingEnvironmentMarkup() {
  return `<section class="cp-driving-environments" aria-label="行驶环境" hidden><button type="button" class="cp-environment-toggle" aria-expanded="false" aria-controls="cp-environment-options" aria-label="选择行驶环境"><small>环境</small><span class="cp-driving-current">田野公路</span>${icon('chevron')}</button><div class="cp-environment-popover cp-glass" id="cp-environment-options" hidden><header><h2>行驶环境</h2><button type="button" class="cp-environment-close" aria-label="收起环境选择">${icon('close')}</button></header><div class="cp-driving-environment-options" role="group" aria-label="选择行驶环境">${DRIVING_ENVIRONMENTS.map(([id,name])=>`<button type="button" data-driving-env="${id}" aria-pressed="${id==='coast'}"><span class="cp-landscape cp-landscape-${id}" aria-hidden="true"></span><span>${name}</span></button>`).join('')}</div><p class="cp-driving-status" role="status"></p><small>仅切换景物；声学路面参数在工况设置中调整。</small></div></section>`;
}

/** A small, normally closed picker. Selecting, leaving the mode, Escape or outside click closes it. */
export function mountEnvironmentPicker(control:HTMLElement, choose:(environment:DrivingEnvironment)=>void) {
  const toggle=control.querySelector<HTMLButtonElement>('.cp-environment-toggle')!;
  const popup=control.querySelector<HTMLElement>('.cp-environment-popover')!;
  const closeButton=control.querySelector<HTMLButtonElement>('.cp-environment-close')!;
  const options=[...control.querySelectorAll<HTMLButtonElement>('[data-driving-env]')];
  const setOpen=(open:boolean,restoreFocus=false)=>{
    popup.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
    if(open)(options.find(b=>b.getAttribute('aria-pressed')==='true')??options[0])?.focus({preventScroll:true});
    else if(restoreFocus)toggle.focus({preventScroll:true});
  };
  const onToggle=()=>setOpen(popup.hidden),onClose=()=>setOpen(false,true);
  const onOutside=(event:PointerEvent)=>{if(!popup.hidden&&!control.contains(event.target as Node))setOpen(false);};
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!popup.hidden){event.preventDefault();event.stopPropagation();setOpen(false,true);}};
  const onChoose=(event:Event)=>{choose((event.currentTarget as HTMLButtonElement).dataset.drivingEnv as DrivingEnvironment);setOpen(false,true);};
  toggle.addEventListener('click',onToggle);closeButton.addEventListener('click',onClose);control.addEventListener('keydown',onKey);
  options.forEach(b=>b.addEventListener('click',onChoose));document.addEventListener('pointerdown',onOutside);setOpen(false);
  return {close:(restoreFocus=false)=>setOpen(false,restoreFocus),dispose(){setOpen(false);toggle.removeEventListener('click',onToggle);closeButton.removeEventListener('click',onClose);control.removeEventListener('keydown',onKey);options.forEach(b=>b.removeEventListener('click',onChoose));document.removeEventListener('pointerdown',onOutside);}};
}

/** A disclosure retains the actual controls and event handlers; it does not remount the viewer. */
export function mountPanelDisclosure(panel: HTMLElement, title: string, id: string, redraw: () => void) {
  let header=panel.querySelector<HTMLElement>(':scope > .cp-card-heading');
  if(!header){header=document.createElement('div');header.className='cp-card-heading';const heading=document.createElement('h2');heading.textContent=title;header.append(heading);panel.prepend(header);}
  const body=document.createElement('div');body.className='cp-panel-body';body.id=id;
  for(const child of [...panel.children])if(child!==header)body.append(child);
  panel.append(body);panel.classList.add('cp-disclosure-panel');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='cp-panel-toggle';toggle.setAttribute('aria-controls',id);header.append(toggle);
  // A fixed top AND bottom stretched the empty structure panel. Collapse owns the whole box,
  // not just the body; restore prior inline declarations exactly when the controls reopen.
  const collapsedBox:Record<string,string>={height:'46px','min-height':'0','max-height':'46px',bottom:'auto',width:'max-content',padding:'0',overflow:'hidden'};
  const previous=new Map(Object.keys(collapsedBox).map(name=>[name,[panel.style.getPropertyValue(name),panel.style.getPropertyPriority(name)]]));
  const restoreBox=()=>{for(const [name,[value,priority]] of previous){if(value)panel.style.setProperty(name,value,priority);else panel.style.removeProperty(name);}};
  let collapsed=false,frame=0;
  const setCollapsed=(value:boolean)=>{
    collapsed=value;
    if(value&&body.contains(document.activeElement))toggle.focus();
    body.hidden=value;panel.dataset.collapsed=String(value);
    if(value)for(const [name,setting]of Object.entries(collapsedBox))panel.style.setProperty(name,setting,'important');else restoreBox();
    toggle.setAttribute('aria-expanded',String(!value));toggle.setAttribute('aria-label',`${value?'展开':'收起'}${title}控制面板`);
    toggle.innerHTML=`${icon('chevron')}<span>${value?title:'收起'}</span>`;
    panel.scrollTop=0;cancelAnimationFrame(frame);frame=requestAnimationFrame(redraw);
  };
  const click=()=>setCollapsed(!collapsed);
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!collapsed){event.preventDefault();event.stopPropagation();setCollapsed(true);toggle.focus();}};
  toggle.addEventListener('click',click);body.addEventListener('keydown',escape);setCollapsed(false);
  return {setCollapsed,dispose(){restoreBox();cancelAnimationFrame(frame);toggle.removeEventListener('click',click);body.removeEventListener('keydown',escape);}};
}
