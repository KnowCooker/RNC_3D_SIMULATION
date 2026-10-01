/** Public dimensions in metres. Photo-derived surfaces are authored approximations, not OEM CAD. */
export const xpengCatalog = [
  { id: 'x9', name: '小鹏 X9', variant: '2026 增程版 · 2+2+3', length: 5.316, width: 1.988, height: 1.785, wheelbase: 3.160, rows: [2, 2, 3], drive: 'rear', generator: true, color: '#919e9f', belt: 1.02, roofFront: 1.20, roofRear: -2.02, screenFront: 1.90, screenRear: -2.48, roofWidth: .82, lights: 'ribbon', source: 'https://www.xiaopeng.com/x9_2026.html', config: 'https://www.xiaopeng.com/x9_2026/configuration.html' },
  { id: 'p7plus', name: '小鹏 P7+', variant: '2026 纯电版 · 2+3', length: 5.071, width: 1.937, height: 1.512, wheelbase: 3.000, rows: [2, 3], drive: 'rear', generator: false, color: '#c6c8c3', belt: .88, roofFront: .72, roofRear: -.80, screenFront: 1.48, screenRear: -2.04, roofWidth: .77, lights: 'ribbon', source: 'https://www.xiaopeng.com/p7_plus_2026.html', config: 'https://www.xiaopeng.com/p7_plus_2026/configuration.html' },
  { id: 'l03', name: '小鹏 MONA L03', variant: '纯电标准外观 · 2+3', length: 4.650, width: 1.920, height: 1.600, wheelbase: 2.850, rows: [2, 3], drive: 'unverified', generator: false, color: '#96869d', belt: .98, roofFront: .63, roofRear: -.89, screenFront: 1.35, screenRear: -1.91, roofWidth: .78, lights: 'split', source: 'https://www.xiaopeng.com/l03.html', config: 'https://www.xiaopeng.com/l03/configuration.html' },
  { id: 'm03', name: '小鹏 MONA M03', variant: '2026 纯电版 · 2+3', length: 4.785, width: 1.896, height: 1.445, wheelbase: 2.815, rows: [2, 3], drive: 'front', generator: false, color: '#b0a3c3', belt: .84, roofFront: .60, roofRear: -.72, screenFront: 1.35, screenRear: -1.98, roofWidth: .75, lights: 'tee', source: 'https://www.xiaopeng.com/m03.html', config: 'https://www.xiaopeng.com/m03_2026/configuration.html' },
  { id: 'gx', name: '小鹏 GX', variant: '增程四驱版 · 2+2+2', length: 5.265, width: 1.999, height: 1.800, wheelbase: 3.115, rows: [2, 2, 2], drive: 'awd', generator: true, color: '#8b9693', belt: 1.08, roofFront: .90, roofRear: -1.94, screenFront: 1.57, screenRear: -2.31, roofWidth: .85, lights: 'ribbon', source: 'https://www.xiaopeng.com/gx.html', config: 'https://www.xiaopeng.com/gx/configuration.html' },
] as const;
export type XPengSpec = typeof xpengCatalog[number];
export type XPengId = XPengSpec['id'];
export function getXPengSpec(id: XPengId): XPengSpec {
  const spec = xpengCatalog.find(row => row.id === id);
  if (!spec) throw new Error(`Unknown XPeng model: ${id}`);
  return spec;
}
