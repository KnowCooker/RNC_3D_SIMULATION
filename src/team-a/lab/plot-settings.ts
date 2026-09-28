import type { AcousticWeighting } from '../../shared/lab-contracts';

export type PlotKind = 'wave' | 'spectrum' | 'convergence';
export type AxisRange = [number, number];
export interface PlotSettings {
  x: AxisRange | null; y: AxisRange | null; rightY: AxisRange | null;
  xScale?: 'linear' | 'log'; showOriginal: boolean; weighting: AcousticWeighting;
}
export const plotDefaults = (kind: PlotKind): PlotSettings => ({
  x: kind === 'spectrum' ? [20, 500] : null, y: null, rightY: null, showOriginal: true, weighting: 'A', xScale: 'linear',
});
export function validAxisRange(min: number, max: number, bounds?: AxisRange): boolean {
  return Number.isFinite(min) && Number.isFinite(max) && min < max && Number.isFinite(max-min)
    && (!bounds || (min >= bounds[0] && max <= bounds[1]));
}
const names: Record<PlotKind, string> = { wave: '时域', spectrum: '频谱', convergence: '收敛' };
const initialRange = (kind: PlotKind, axis: string): AxisRange => axis === 'x'
  ? kind === 'spectrum' ? [20,500] : [0,5]
  : kind === 'wave' ? [-1,1] : kind === 'spectrum' ? [0,70] : [30,90];
export function plotSettingsMarkup(kind: PlotKind): string {
  const axis = (key: string, label: string) => {
    const [min,max] = initialRange(kind,key), auto = !(kind === 'spectrum' && key === 'x');
    return `<fieldset><legend>${label}</legend><label class="lab-check"><input data-axis-auto="${key}" type="checkbox" ${auto ? 'checked' : ''}>自动范围</label><div class="lab-axis-inputs"><label>下限<input data-axis-min="${key}" type="number" step="any" value="${min}" ${auto ? 'disabled' : ''}></label><label>上限<input data-axis-max="${key}" type="number" step="any" value="${max}" ${auto ? 'disabled' : ''}></label></div></fieldset>`;
  };
  return `<details class="lab-plot-settings" data-plot-settings="${kind}"><summary aria-label="${names[kind]}显示设置">显示设置</summary><div class="lab-plot-menu">
    ${kind === 'spectrum' ? '<label class="lab-setting-weight">横轴刻度<select data-x-scale><option value="linear">线性</option><option value="log">对数</option></select></label>' : ''}
    ${axis('x', kind === 'spectrum' ? '横轴 / Hz' : '横轴 / 实验时间 s')}${axis('y','纵轴 / 图示单位')}
    ${kind !== 'convergence' ? axis('rightY','原声右轴 / 图示单位（混合单位时）') : ''}
    ${kind !== 'wave' ? '<label class="lab-setting-weight">计权方式<select data-weighting><option value="A">A 计权</option><option value="Z">Z（不计权）</option></select></label>' : ''}
    <label class="lab-check"><input data-show-original type="checkbox" checked>显示原始噪声 d</label>
    <p class="lab-settings-help">${kind === 'wave' ? '自动显示最近5秒。手动坐标只显示当前时刻前的可用数据；实时历史约8秒。' : kind === 'spectrum' ? '原始采样率4 kHz，运行素材抗混叠降至2 kHz，频谱上限1 kHz。对数轴不含0 Hz。声压 PSD 参考 (20 μPa)²/Hz；A计权标为 dBA/Hz。Hann 1024；非声压信号保持Z计权。' : '总声压级：0–1 kHz、0.5秒窗口；只显示当前时刻及以前的数据。计权仅影响此图。'}</p>
    <p class="lab-settings-error" role="status" hidden></p><button type="button" data-reset-plot>恢复默认</button>
    </div></details>`;
}
/** Display controls never mutate the experiment config, samples or transport. */
export function bindPlotSettings(root: HTMLElement, changed: () => void): Record<PlotKind, PlotSettings> {
  const settings = { wave: plotDefaults('wave'), spectrum: plotDefaults('spectrum'), convergence: plotDefaults('convergence') };
  root.querySelectorAll<HTMLDetailsElement>('[data-plot-settings]').forEach(menu => {
    const kind = menu.dataset.plotSettings as PlotKind;
    const input = (selector: string) => menu.querySelector<HTMLInputElement>(selector)!;
    const error = menu.querySelector<HTMLElement>('.lab-settings-error')!;
    const apply = () => {
      const next = { ...settings[kind] };
      for (const axis of ['x','y',...(kind === 'convergence' ? [] : ['rightY'])] as const) {
        const key = axis as 'x'|'y'|'rightY', auto = input(`[data-axis-auto="${axis}"]`).checked;
        const min = input(`[data-axis-min="${axis}"]`), max = input(`[data-axis-max="${axis}"]`);
        min.disabled = max.disabled = auto;
        if (auto) { next[key] = null; continue; }
        if (!min.value.trim() || !max.value.trim() || !validAxisRange(min.valueAsNumber,max.valueAsNumber,key === 'x' ? [0,kind === 'spectrum' ? 1000 : 600] : undefined)) {
          error.textContent = key === 'x' ? `横轴需满足 0 ≤ 下限 < 上限 ≤ ${kind === 'spectrum' ? 1000 : 600}。` : '纵轴需输入有限数值，且下限小于上限。';
          error.hidden = false; return;
        }
        next[key] = [min.valueAsNumber,max.valueAsNumber];
      }
      next.xScale = menu.querySelector<HTMLSelectElement>('[data-x-scale]')?.value === 'log' ? 'log' : 'linear';
      if (next.xScale === 'log' && next.x && next.x[0] <= 0) {
        error.textContent = '对数横轴下限必须大于 0 Hz。'; error.hidden = false; return;
      }
      next.showOriginal = input('[data-show-original]').checked;
      next.weighting = (menu.querySelector<HTMLSelectElement>('[data-weighting]')?.value ?? 'A') as AcousticWeighting;
      settings[kind] = next; error.hidden = true; changed();
    };
    menu.addEventListener('change',apply);
    menu.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach(field => { field.oninput = apply; });
    menu.querySelector<HTMLButtonElement>('[data-reset-plot]')!.onclick = () => {
      for (const axis of ['x','y',...(kind === 'convergence' ? [] : ['rightY'])]) {
        const [min,max] = initialRange(kind,axis);
        input(`[data-axis-min="${axis}"]`).value = String(min); input(`[data-axis-max="${axis}"]`).value = String(max);
        input(`[data-axis-auto="${axis}"]`).checked = !(kind === 'spectrum' && axis === 'x');
      }
      input('[data-show-original]').checked = true;
      const scale = menu.querySelector<HTMLSelectElement>('[data-x-scale]'); if (scale) scale.value = 'linear';
      const weight = menu.querySelector<HTMLSelectElement>('[data-weighting]'); if (weight) weight.value = 'A';
      apply();
    };
    menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary')?.focus(); } });
  });
  return settings;
}
