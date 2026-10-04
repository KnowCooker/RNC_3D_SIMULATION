import { presentationIcon } from './presentation-icons';

type Kind = 'field' | 'paths' | 'layout';
const images: Record<Kind, string> = {
  field: new URL('./assets/overview/field.png', import.meta.url).href,
  paths: new URL('./assets/overview/paths.png', import.meta.url).href,
  layout: new URL('./assets/overview/layout.png', import.meta.url).href,
};
const labels: Record<Kind, string> = { field:'透明座舱声场概念渲染', paths:'车身与底盘噪声传递概念渲染', layout:'座舱传感器与扬声器布置概念渲染' };
const ring = (x:number,y:number,color:string,delay:number) => `<circle class="cp-motion-ring" cx="${x}" cy="${y}" r="20" style="color:${color};animation-delay:${delay}s"/>`;
const overlays: Record<Kind, string> = {
  field: `<defs><clipPath id="cp-cabin-mask"><path d="M480 325 740 197Q1100 88 1490 180L1600 325 1540 480 1320 650 735 590Z"/></clipPath><radialGradient id="cp-heat-cyan"><stop stop-color="#3cffff" stop-opacity=".8"/><stop offset="1" stop-color="#3cffff" stop-opacity="0"/></radialGradient><radialGradient id="cp-heat-amber"><stop stop-color="#ffce53" stop-opacity=".75"/><stop offset="1" stop-color="#ffce53" stop-opacity="0"/></radialGradient></defs><g clip-path="url(#cp-cabin-mask)"><ellipse class="cp-motion-heat cp-motion-heat-a" cx="905" cy="420" rx="280" ry="185" fill="url(#cp-heat-cyan)"/><ellipse class="cp-motion-heat cp-motion-heat-b" cx="1320" cy="290" rx="230" ry="160" fill="url(#cp-heat-amber)"/><path class="cp-motion-wave" d="M560 440Q800 165 1110 410T1600 330M530 475Q850 210 1090 470T1630 365M570 510Q830 265 1080 530T1600 405"/></g>`,
  paths: `<g fill="none" stroke-linecap="round"><path class="cp-motion-photon cp-motion-photon-amber" d="M550 665 550 560Q495 435 610 430L725 572 857 586"/><path class="cp-motion-photon cp-motion-photon-blue" d="M748 594 912 526 920 426Q1080 354 1320 360"/><path class="cp-motion-photon cp-motion-photon-blue cp-motion-photon-lower" d="M730 666 915 688 1250 615 1410 529"/></g>${ring(550,650,'#e9a443',0)}`,
  layout: [[314,171,'#dd9b37',0],[1478,167,'#dd9b37',.8],[313,677,'#dd9b37',1.6],[1485,676,'#dd9b37',2.4],[948,284,'#369cf7',.4],[1289,284,'#369cf7',1.2],[944,531,'#369cf7',2],[1285,533,'#369cf7',2.8],[848,178,'#eb5c53',.6],[1183,178,'#eb5c53',1.4],[845,656,'#eb5c53',2.2],[1184,655,'#eb5c53',3]].map(([x,y,c,d])=>ring(Number(x),Number(y),String(c),Number(d))).join(''),
};

/** Art is deliberately independent of the experiment stream. Never invent a dB value. */
export function overviewMotionMarkup(kind: Kind) {
  return `<span class="cp-motion-art cp-motion-${kind}" data-motion-paused="true"><span class="cp-motion-scene"><img src="${images[kind]}" alt="${labels[kind]}" width="1774" height="887" decoding="async"><svg viewBox="0 0 1774 887" fill="none" aria-hidden="true">${overlays[kind]}</svg></span><span class="cp-motion-caption">概念动效</span></span>`;
}

export type MotionConditions = { active: boolean; visible: boolean; reduced: boolean; manual: boolean; intersecting: boolean };
export const shouldAnimateOverview = (s: MotionConditions) => s.active && s.visible && !s.reduced && !s.manual && s.intersecting;

/** Pause rather than restart: navigation, visibility and manual pause preserve animation phase. */
export function mountOverviewMotion(root: HTMLElement) {
  const cards = [...root.querySelectorAll<HTMLElement>('.cp-motion-art')];
  const button = root.querySelector<HTMLButtonElement>('.cp-motion-toggle')!;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const visibleCards = new Set<Element>();
  let active = true, manual = false;
  const update = () => {
    for (const card of cards) card.dataset.motionPaused = String(!shouldAnimateOverview({active,manual,visible:!document.hidden,reduced:preference.matches,intersecting:visibleCards.has(card)}));
    button.disabled = preference.matches;
    button.setAttribute('aria-pressed', String(manual || preference.matches));
    button.setAttribute('aria-label', preference.matches ? '展示动画已按系统偏好静止' : manual ? '播放展示动画' : '暂停展示动画');
    button.title = button.getAttribute('aria-label')!;
    button.innerHTML = presentationIcon(manual || preference.matches ? 'play' : 'pause');
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) { if(entry.isIntersecting) visibleCards.add(entry.target); else visibleCards.delete(entry.target); }
    update();
  }, { threshold: .1 });
  cards.forEach(card => observer.observe(card));
  const toggle = () => { manual = !manual; update(); };
  button.addEventListener('click',toggle);
  preference.addEventListener('change',update);
  document.addEventListener('visibilitychange',update);
  update();
  return {
    setActive(value: boolean) { active=value; update(); },
    dispose() { active=false;update();observer.disconnect();button.removeEventListener('click',toggle);preference.removeEventListener('change',update);document.removeEventListener('visibilitychange',update); },
  };
}
