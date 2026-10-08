import { labLayoutId, registeredVehicleLayout, type LabConfig } from '../../shared/lab-contracts';
import { compareCases, type CaseSnapshot, type ComparisonPolicy } from './case-compare';

const esc=(text:unknown)=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const valid=(n:number|null):n is number=>n!==null&&Number.isFinite(n);
const num=(n:number|null,sign=false)=>valid(n)?`${sign&&n>=.05?'+':''}${(Math.abs(n)<.05?0:n).toFixed(1)}`:'—';
const seats=['左前','右前','左后','右后'];
export interface ConfigDifference {label:string;a:string;b:string;changed:boolean}
/** Human-readable input values, not a second acoustic calculation. */
export function configurationDifferences(a:LabConfig,b:LabConfig):ConfigDifference[] {
  const rows:[string,(c:LabConfig)=>string][]=[
    ['车型 / 物理布局',c=>`${registeredVehicleLayout(c.layoutId)?.name??c.vehicle} / ${labLayoutId(c)}`],
    ['计算协议',c=>c.schemaVersion],['采样率',c=>`${c.sampleRateHz} Hz`],
    ['ANC 开关',c=>c.rncEnabled?'开启':'关闭'],['滤波器系数数',c=>`${c.taps} taps`],['学习步长 μ',c=>String(c.stepSize)],
    ['参考传感器',c=>c.references.map(r=>`${r.name} (${r.id}) [${r.position.join(', ')}] m${r.mountPart?` · ${r.mountPart}`:''}`).join('；')],
    ['扬声器',c=>c.speakerEnabled.map((on,i)=>`${seats[i]} ${on?'启用':'禁用'}`).join(' / ')],
    ['车速',c=>`${c.speedKph} km/h`],['路面粗糙度',c=>String(c.roadRoughness)],['胎面粗糙度',c=>String(c.treadRoughness)],
    ['胎压',c=>`${c.pressureKpa} kPa`],['温度',c=>`${c.temperatureC} °C`],
    ['声源',c=>(c.sourceMode??'shaped-noise')==='recorded-noise'?'实录等效声源':'整形随机声源'],
    ['声源种子',c=>String(c.seed)],['实验时长',c=>`${c.durationSeconds} s`],['学习起点',c=>`${c.adaptationStartsSeconds} s`],
    ['教学声压修正',c=>`${c.levelOffsetDb??0} dB`],
  ];
  return rows.map(([label,read])=>{const left=read(a),right=read(b);return {label,a:left,b:right,changed:left!==right};});
}

function differencesTable(rows:ConfigDifference[]) {
  return `<div class="cp-difference-table"><table><caption>实际实验输入 · A 与 B</caption><thead><tr><th scope="col">配置项</th><th scope="col">基线 A</th><th scope="col">候选 B</th></tr></thead><tbody>${rows.map(r=>`<tr data-changed="${r.changed}"><th scope="row">${esc(r.label)}${r.changed?'<small>已改变</small>':''}</th><td>${esc(r.a)}</td><td>${esc(r.b)}</td></tr>`).join('')}</tbody></table></div>`;
}

/** Shared-axis point charts avoid the misleading nonzero baseline of truncated dB bars. */
export function pairedLevelChart(a:readonly (number|null)[],b:readonly (number|null)[],kind:'residual'|'reduction',connected=true) {
  const values=[...a,...b].filter(valid),step=5;
  const low=Math.floor(Math.min(...values,kind==='reduction'?0:Infinity)/step)*step;
  const high=Math.ceil(Math.max(...values,kind==='reduction'?0:-Infinity)/step)*step;
  const min=Number.isFinite(low)?low:0,max=Number.isFinite(high)?Math.max(high,min+step):step;
  const left=76,width=358,x=(n:number)=>left+(n-min)/(max-min)*width;
  const title=kind==='residual'?'控制后谁更安静？':'各方案降低了多少噪声？',unit=kind==='residual'?'dBA':'dB';
  const description=kind==='residual'?'残余声压 · 越低越安静':'降噪量（原声 − 残余）· 越大越好，负值为变差';
  const ticks=Array.from({length:5},(_,i)=>{const value=min+(max-min)*i/4;return `<line x1="${x(value)}" y1="30" x2="${x(value)}" y2="226" class="cp-chart-grid"/><text x="${x(value)}" y="247" text-anchor="middle">${num(value)}</text>`;}).join('');
  const rows=seats.map((seat,i)=>{
    const y=51+i*51,av=a[i]??null,bv=b[i]??null;
    const line=connected&&valid(av)&&valid(bv)?`<line x1="${x(av)}" y1="${y-7}" x2="${x(bv)}" y2="${y+8}" class="cp-chart-link"/>`:'';
    const point=(value:number|null,side:'a'|'b',py:number)=>valid(value)?`<circle cx="${x(value)}" cy="${py}" r="5" class="cp-point-${side}" data-seat="${i}" data-series="${side}" data-value="${value}"/><text x="${left+width+18}" y="${py+4}" class="cp-text-${side}">${side.toUpperCase()} ${num(value)}</text>`:`<text x="${left+width+18}" y="${py+4}" class="cp-missing">${side.toUpperCase()} 无读数</text>`;
    return `<text x="15" y="${y+4}">${seat}</text>${line}${point(av,'a',y-7)}${point(bv,'b',y+8)}`;
  }).join('');
  return `<figure class="cp-comparison-chart"><figcaption><h3>${title}</h3><p>${description}</p></figcaption><div class="cp-chart-key"><span>A 基线</span><span>B 候选</span><small>${unit} · 共用横轴</small></div><svg viewBox="0 0 540 266" role="img" aria-label="${title}，四个座位的 A 与 B ${description}"><title>${title}</title><desc>${seats.map((s,i)=>`${s}：A ${num(a[i]??null)}，B ${num(b[i]??null)} ${unit}`).join('；')}</desc>${ticks}${rows}</svg></figure>`;
}

export function caseVisualsMarkup(base:CaseSnapshot|null,candidate:CaseSnapshot|null,mode:ComparisonPolicy='control') {
  if(!base||!candidate||base.runId===candidate.runId)return `<section class="cp-case-visuals" data-ready="false" aria-label="方案对比图表"><div class="cp-comparison-empty"><span>配置差异 → 四座位结果 → 降噪收益</span><h3>${base?'基线 A 已锁定，等待候选 B':'先建立一组真实的 A/B 实验'}</h3><p>${base?'调整一个控制参数，点击“计算候选 B”，图表将显示两次实验的实际结果。':'计算并保存基线 A，再改变一个因素计算 B。图表不会使用示例降噪数值。'}</p><div class="cp-empty-steps"><span>${base?'✓':'01'} 基线 A</span><i></i><span>02 候选 B</span><i></i><span>03 四座位图表</span></div></div></section>`;
  const comparison=compareCases(base,candidate,mode),rows=configurationDifferences(base.config,candidate.config),changed=rows.filter(r=>r.changed),same=rows.filter(r=>!r.changed);
  const warning=!comparison.comparable?`暂不能公平比较：${comparison.conditions.join('、')}不同。下方仅并列各自读数，隐藏连线与差值结论。`:mode!=='control'?'工况结果并列：包含声源或工况影响，不能视为 ANC 控制方案的净收益。':changed.length>1?'多项输入同时变化：图表展示方案整体差异，不能将结果归因于其中某一项。':!changed.length?'A/B 输入相同：这是重复运行，不能据此声称方案变更有效。':'控制变量比较：在相同工况下观察这项变更对应的四座位结果。';
  const deltas=comparison.reductionDeltaDb;
  const scale=Math.max(1,...deltas.filter(valid).map(Math.abs));
  const deltaPanel=comparison.comparable?`<section class="cp-benefit-panel"><h3>${mode==='control'?'候选 B 相对 A 的降噪量变化':'两个场景的降噪量差异'}</h3><p>B − A；正值为降噪量增加，负值为减少。${mode==='control'?'同时检查每个座位，避免只看平均数。':'不代表控制方案的净收益。'}</p><div class="cp-benefit-seats">${deltas.map((value,i)=>`<div data-effect="${!valid(value)?'missing':value>.05?'better':value<-.05?'worse':'same'}"><span>${seats[i]}</span><strong>${num(value,true)} <small>dB</small></strong><div class="cp-benefit-track" aria-hidden="true">${valid(value)?`<i style="left:${value<0?50-Math.abs(value)/scale*48:50}%;width:${Math.abs(value)/scale*48}%"></i>`:''}</div><small>${!valid(value)?'无有效读数':value>.05?'降噪量增加':value<-.05?'降噪量减少':'显示精度内相同（0.1 dB）'}</small></div>`).join('')}</div></section>`:'';
  return `<section class="cp-case-visuals" data-ready="true" data-comparable="${comparison.comparable}" aria-label="方案对比图表"><div class="cp-comparison-verdict" role="status"><strong>${comparison.comparable?(changed.length?`${changed.length} 项输入变化`:'同配置复测'):'比较条件未对齐'}</strong><p>${esc(warning)}</p><small>A / B：末尾 ${esc(base.windowEndSeconds)} / ${esc(candidate.windowEndSeconds)} s，各 0.5 s 窗 · A 计权 · 0–1 kHz · 教学仿真</small></div><section class="cp-config-differences"><h3>01 / 两种方案改了什么</h3>${changed.length?differencesTable(changed):'<p>所有实验输入保持一致。</p>'}<details><summary>查看 ${same.length} 项相同条件</summary>${differencesTable(same)}</details></section><h3 class="cp-results-heading">02 / 这些变化对应怎样的结果</h3><div class="cp-comparison-figures">${pairedLevelChart(base.residualSpl,candidate.residualSpl,'residual',comparison.comparable)}${pairedLevelChart(base.reductionDb,candidate.reductionDb,'reduction',comparison.comparable)}</div>${deltaPanel}</section>`;
}
