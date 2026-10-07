import type { createLabViewer } from '../viewer/lab-viewer';
import { PASSENGERS, PASSENGER_PRESETS, type PassengerId } from '../viewer/passenger-model';
import { createPassengerState } from './passenger-state';
import { presentationIcon as icon } from './presentation-icons';
import './passenger-panel.css';

/** Modeless drawer: the live vehicle remains directly rotatable beside the controls. */
export function mountPassengerPanel(root: HTMLElement, viewer: ReturnType<typeof createLabViewer>, enter: () => void) {
  const host = root.querySelector<HTMLElement>('#lab-viewer')!, state = createPassengerState();
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'cp-passenger-trigger';
  trigger.innerHTML = `${icon('seat')}<span>同行伙伴</span>`; trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', 'cp-passenger-drawer');
  root.querySelector('.cp-asset')!.append(trigger);
  const panel = document.createElement('aside'); panel.className = 'cp-passenger-drawer cp-glass'; panel.id = 'cp-passenger-drawer'; panel.hidden = true;
  panel.setAttribute('aria-label', '车内乘客选择');
  panel.innerHTML = `<header><div><small>TRAVEL COMPANIONS</small><h2>让旅程，多一份陪伴</h2></div><button class="pc-close" aria-label="关闭乘客选择">${icon('close')}</button></header>
    <p class="pc-intro">选择座位，再邀请喜欢的角色上车。</p><div class="pc-availability" role="status"></div>
    <div class="pc-seat-map" role="group" aria-label="当前车辆全部座位，包含主驾"></div>
    <div class="pc-selection-title"><b>为<span class="pc-active-seat">副驾</span>选择伙伴</b><small class="pc-count"></small></div>
    <div class="pc-characters" role="group" aria-label="选择三维乘客">${PASSENGERS.map(c => `<button data-character="${c.id}" style="--pc-color:${c.color}" aria-label="安排${c.name}" aria-pressed="false"><span class="pc-avatar pc-avatar-${c.id}" aria-hidden="true">${avatar(c.id)}</span><strong>${c.name}</strong><small>${c.detail}</small></button>`).join('')}</div>
    <div class="pc-actions"><button data-action="remove">此座留空</button><button data-action="focus">近看此座 ${icon('chevron')}</button></div>
    <div class="pc-presets"><button data-action="trio">经典三人</button><button data-action="strawhats">草帽同行</button></div>
    <div class="pc-presets"><button data-action="clear">全部清空</button><button data-action="cabin">整舱视角</button></div>
    <label class="pc-visibility"><input type="checkbox" checked>显示车内乘客</label>
    <p class="pc-message" role="status" aria-live="polite"></p>
    <p class="pc-quality" role="status"></p><footer>主驾、副驾和后排均可独立选人或留空。<br>角色仅作视觉展示，不影响本次声学结果。</footer>`;
  root.querySelector('.cp-stage')!.append(panel);
  let seat = '', visible = true; const events = new AbortController();
  const q = <T extends HTMLElement = HTMLElement>(selector: string) => panel.querySelector<T>(selector)!;
  function render() {
    const seats = viewer.passengerSeats, assignments = state.assignments;
    if (!seats.some(s => s.id === seat)) seat = seats[0]?.id ?? '';
    q('.pc-availability').textContent = seats.length ? `${seats.length} 个可选座位（含主驾）· 本次会话按车型保留` : '正在匹配座位；当前仅支持五款小鹏实验车。';
    const map = q('.pc-seat-map'); map.replaceChildren();
    const rows = [...new Set(seats.map(s => s.row))];
    for (const row of rows) {
      const line = document.createElement('div'); line.className = 'pc-seat-row';
      for (const s of seats.filter(s => s.row === row)) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.seat = s.id;
        if (s.driver) button.className = 'pc-driver-seat';
        const person = PASSENGERS.find(c => c.id === assignments[s.id]);
        button.setAttribute('aria-label', `${s.label}，${person?.name ?? '空座'}`); button.setAttribute('aria-pressed', String(seat === s.id));
        button.innerHTML = `${icon('seat')}<span>${s.label}</span><strong>${person?.name ?? '空座'}</strong>`;
        button.onclick = () => { seat = s.id; render(); q<HTMLButtonElement>(`[data-seat="${s.id}"]`).focus(); q('.pc-message').textContent = `已选择${s.label}。`; };
        line.append(button);
      }
      map.append(line);
    }
    q('.pc-active-seat').textContent = seats.find(s => s.id === seat)?.label ?? '座位';
    q('.pc-count').textContent = `${Object.values(assignments).filter(Boolean).length} 位已上车`;
    panel.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(b => { b.disabled = !seat; b.setAttribute('aria-pressed', String(assignments[seat] === b.dataset.character)); });
    panel.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => b.disabled = !seat || b.dataset.action === 'remove' && !assignments[seat]);
    host.dataset.passengerSeatCount = String(seats.length);
    renderQuality();
  }
  function renderQuality() {
    const quality = viewer.passengerQuality;
    const detailed = quality.filter(q => q.status === 'detailed').length, loading = quality.filter(q => q.status === 'loading').length;
    q('.pc-quality').textContent = !quality.length ? '选择角色后显示模型状态。' : loading ? `正在加载精细模型 · ${detailed}/${quality.length}` : detailed === quality.length ? `精细模型已就绪 · ${detailed} 位` : `精细模型 ${detailed}/${quality.length} · 部分本机资源缺失，暂显示基础模型。`;
    host.dataset.passengerQuality = JSON.stringify(quality);
  }
  function apply(message: string) {
    viewer.setPassengers(state.assignments); render(); q('.pc-message').textContent = message + (visible ? '' : ' 当前人物已隐藏，可勾选显示。');
  }
  function bind() { state.bind(viewer.passengerAsset, viewer.passengerSeats); viewer.setPassengers(state.assignments); viewer.setPassengersVisible(visible); render(); }
  host.addEventListener('passenger-layout-change', bind, { signal: events.signal }); bind();
  host.addEventListener('passenger-quality-change', renderQuality, { signal: events.signal });
  panel.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(b => b.onclick = () => {
    const id = b.dataset.character as PassengerId; if (state.choose(seat, id)) apply(`${PASSENGERS.find(c => c.id === id)!.name}已坐在${q('.pc-active-seat').textContent}。`);
  });
  q<HTMLButtonElement>('[data-action=remove]').onclick = () => { state.choose(seat, null); apply('当前座位已留空。'); };
  q<HTMLButtonElement>('[data-action=clear]').onclick = () => { state.clear(); apply('所有乘客已离座。'); };
  q<HTMLButtonElement>('[data-action=trio]').onclick = () => { state.fill(); apply('牛来、神里绫华和路飞已上车。'); viewer.focusPassengers(); };
  q<HTMLButtonElement>('[data-action=strawhats]').onclick = () => { state.fill(PASSENGER_PRESETS.strawhats); apply('索隆主驾、娜美副驾，乔巴和路飞在后排同行。'); viewer.focusPassengers(); };
  q<HTMLButtonElement>('[data-action=focus]').onclick = () => viewer.focusPassengers(seat);
  q<HTMLButtonElement>('[data-action=cabin]').onclick = () => viewer.focusPassengers();
  q<HTMLInputElement>('input').onchange = event => { visible = (event.target as HTMLInputElement).checked; viewer.setPassengersVisible(visible); q('.pc-message').textContent = visible ? '乘客已显示。' : '乘客已隐藏；选座配置保留。'; };
  function close(restoreFocus = true) { panel.hidden = true; delete root.dataset.passengerPanel; trigger.setAttribute('aria-expanded', 'false'); if (restoreFocus) { viewer.focusPassengers(); trigger.focus(); } }
  q<HTMLButtonElement>('.pc-close').onclick = () => close();
  trigger.onclick = () => {
    if (!panel.hidden) { close(); return; }
    enter(); panel.hidden = false; root.dataset.passengerPanel = 'open'; trigger.setAttribute('aria-expanded', 'true'); bind();
    viewer.focusPassengers(); q<HTMLButtonElement>('.pc-close').focus();
  };
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }, { signal: events.signal });
  return { close, resume() { if (!panel.hidden) { enter(); viewer.focusPassengers(); } }, dispose() { events.abort(); panel.remove(); trigger.remove(); delete root.dataset.passengerPanel; } };
}

function avatar(id: PassengerId) {
  if (id === 'chopper') return '<svg viewBox="0 0 64 64"><path d="M16 26 7 15 7 7m3 14L2 19m46 7 9-11V7m-3 14 8-2" stroke="#8b6041" stroke-width="5" fill="none"/><ellipse cx="32" cy="42" rx="18" ry="17" fill="#cfa15d"/><path d="M12 29V15Q32 1 52 15v14" fill="#5fadd0"/><rect x="11" y="23" width="42" height="12" rx="6" fill="#cf7499"/><path d="m27 16 10 10m0-10L27 26" stroke="white" stroke-width="4"/><ellipse cx="32" cy="43" rx="5" ry="3" fill="#4477a9"/><circle cx="23" cy="39" r="3"/><circle cx="41" cy="39" r="3"/><path d="M26 49q6 7 12 0" fill="none" stroke="#755133" stroke-width="2"/></svg>';
  if (id === 'nami') return '<svg viewBox="0 0 64 64"><path d="M10 59V26Q10 4 32 5q24-1 24 24v30" fill="#dd8638"/><ellipse cx="32" cy="34" rx="15" ry="19" fill="#f1cbb2"/><path d="M15 35Q10 4 35 7q12 3 16 19L34 16 23 29Z" fill="#e99540"/><path d="M21 31q5-4 9 0m5 0q5-4 9 0" stroke="#654326" fill="none"/><circle cx="26" cy="35" r="2"/><circle cx="39" cy="35" r="2"/><path d="M28 45q5 4 10 0" stroke="#b7685a" fill="none"/><path d="m16 61 6-11 10 6 10-6 7 11" fill="#418f86"/></svg>';
  if (id === 'zoro') return '<svg viewBox="0 0 64 64"><path d="M17 63V49h31v14" fill="#eeede2"/><path d="M14 20q17-17 37 0l-3 23-16 14-16-14Z" fill="#deb389"/><path d="M12 25 12 12l8 4 2-12 8 8 7-10 6 12 10-5-1 19-9-6-8 2-10-3Z" fill="#719246"/><path d="m20 32 10 2m8 0 10-2m-23 11 16 1" stroke="#4d4c37" stroke-width="2"/><path d="M50 40v10m3-10v10m3-10v10" stroke="#bd9134" stroke-width="2"/></svg>';
  const face = id === 'niulai' ? '<path d="M18 25 11 10 21 17M46 25 53 10 43 17" fill="#777567"/><ellipse cx="32" cy="35" rx="18" ry="19" fill="#d5ae3c"/><ellipse cx="32" cy="44" rx="14" ry="10" fill="#d9c0ae"/><path d="m21 30 8-2m6 0 8 2m-17 15q6 4 12 0" stroke="#635344" fill="none" stroke-width="2"/>' : id === 'ayaka' ? '<path d="M13 54V29a19 19 0 0 1 38 0v25" fill="#aebbe2"/><ellipse cx="32" cy="35" rx="13" ry="17" fill="#f3d7c6"/><path d="M18 31 22 14 31 12 45 19 46 31 21 27" fill="#b8c5ea"/><path d="m20 54 12-8 12 8" fill="#516790"/>' : '<ellipse cx="32" cy="25" rx="26" ry="5" fill="#c69d59"/><path d="M16 24q0-21 16-21t16 21" fill="#d9b56f"/><path d="M16 23h32" stroke="#a94e40" stroke-width="5"/><ellipse cx="32" cy="38" rx="15" ry="18" fill="#e8b68c"/><path d="M17 34 18 26 44 26 47 35 42 30 36 34 28 29 24 35" fill="#323032"/><path d="M24 44q8 11 16 0Z" fill="#fff8ea"/>';
  return `<svg viewBox="0 0 64 64" fill="none">${face}<circle cx="26" cy="35" r="2" fill="#3b393a"/><circle cx="38" cy="35" r="2" fill="#3b393a"/></svg>`;
}
