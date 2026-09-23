import type { LabConfig } from '../../shared/lab-contracts';

export function validateLabConfig(config: LabConfig): void {
  if (!config || config.schemaVersion !== 'lab-v3') throw new Error('需要 lab-v3 配置');
  if (!['ice', 'bev', 'hev', 'erev'].includes(config.vehicle)) throw new Error('车型不受支持');
  if (config.sampleRateHz !== 2000 || config.durationSeconds !== 16 || config.adaptationStartsSeconds !== 2) throw new Error('当前时基为 2000Hz / 16s / 2s 开始学习');
  const range = (value: number, min: number, max: number, label: string) => {
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} 必须在 ${min}～${max} 之间`);
  };
  range(config.seed, 1, 2147483647, '种子');
  if (!Number.isInteger(config.seed)) throw new Error('种子必须为整数');
  range(config.taps, 16, 128, '阶数');
  if (!Number.isInteger(config.taps)) throw new Error('阶数必须为整数');
  range(config.stepSize, 0, 0.5, '归一化步长');
  range(config.speedKph, 0, 130, '车速');
  range(config.roadRoughness, 0.1, 3, '路面粗糙度');
  range(config.treadRoughness, 0.1, 3, '胎面粗糙度');
  range(config.pressureKpa, 160, 320, '胎压');
  range(config.temperatureC, -20, 50, '温度');
  if (typeof config.rncEnabled !== 'boolean') throw new Error('RNC 开关必须为布尔值');
  if (!Array.isArray(config.references) || config.references.length < 1 || config.references.length > 8) throw new Error('参考传感器须为 1～8 个');
  const ids = new Set<string>();
  for (const reference of config.references) {
    if (!reference || typeof reference.id !== 'string' || !reference.id || ids.has(reference.id) || typeof reference.name !== 'string') throw new Error('参考传感器需要唯一 ID 与名称');
    ids.add(reference.id);
    if (!Array.isArray(reference.position) || reference.position.length !== 3 || !reference.position.every(Number.isFinite)) throw new Error('参考传感器坐标无效');
    range(reference.position[0], -1.3, 1.3, '传感器横向位置');
    range(reference.position[1], 0, 2.3, '传感器高度');
    range(reference.position[2], -2.6, 2.6, '传感器纵向位置');
  }
  if (!Array.isArray(config.speakerEnabled) || config.speakerEnabled.length !== 4 || !config.speakerEnabled.every(v => typeof v === 'boolean')) throw new Error('需要四个扬声器开关');
}

