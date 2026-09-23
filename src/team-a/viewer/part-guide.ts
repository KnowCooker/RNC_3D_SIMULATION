import type { VehicleKind, VehiclePart } from './vehicle-model';

export interface PartGuide {
  id: string;
  title: string;
  role: string;
  path: string;
  sourceLabel: string;
  sourceUrl: string;
}

const sources = {
  gasoline: { label: '美国能源部 · 汽油车部件', url: 'https://afdc.energy.gov/vehicles/how-do-gasoline-cars-work' },
  electric: { label: '美国能源部 · 纯电车部件', url: 'https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work' },
  hybrid: { label: 'Toyota · 双电机机械功率分流', url: 'https://global.toyota/en/mobility/tnga/powertrain2018/ths2/' },
  range: { label: 'Stellantis/Leapmotor · C10 增程架构', url: 'https://www.media.stellantis.com/uk-en/leapmotor/press/leapmotor-c10-uk-press-information' },
  hardware: { label: 'RNC 硬件公开专利 EP3156998B1', url: 'https://patents.google.com/patent/EP3156998B1/en' },
} as const;

const architectures: Record<VehicleKind, { path: string; source: keyof typeof sources }> = {
  ice: { path: '燃油箱 → 发动机 → 变速器/前差速器 → 前轮。排气由发动机经催化器、消声器排出。', source: 'gasoline' },
  bev: { path: '充电口/底板电池 → 逆变器 → 后电机/减速器 → 后轮；本车没有油箱、发动机和排气。', source: 'electric' },
  hev: { path: '发动机经功率分流机构保留到前轮的机械支路；MG1 发电，电池经逆变器向 MG2 供能，MG2 也能驱动前轮。', source: 'hybrid' },
  erev: { path: '燃油箱 → 发动机 → 发电机 → 电池/高压母线 → 后电机/减速器 → 后轮；发动机不机械驱动车轮。', source: 'range' },
};

const roles: Record<string, string> = {
  transmission: '把发动机机械功经前差速器和半轴传到前轮；此件只在本教学 ICE 架构中出现。',
  'power-split': 'HEV 用机械功率分流机构连接发动机、车轮机械支路与 MG1 发电支路；不能当作串联增程。',
  'range-generator': 'EREV 的发动机直接带动发电机；电能进入高压母线/电池，车轮由后电机驱动。',
  'traction-motor-front': 'HEV 的 MG2 前电机经减速/差速机构为前轮提供驱动力。',
  'traction-motor-rear': '把来自电池/逆变器的电能转成后轮驱动力；本教学 BEV 和 EREV 都采用后驱。',
  'traction-battery': '储存牵引用电；BEV/EREV 置于底板，HEV 使用后排下较小的教学电池。',
  inverter: '管理牵引电池与驱动电机之间的电能流，不代表本模型绘出了真实内部电路。',
  'charge-system': '展示外接充电口、车载充电器和 DC/DC；本教学 BEV/EREV 可外接充电，HEV 不设充电口。',
  'fuel-tank': '储存供发动机使用的燃油；BEV 不需要油箱。',
  exhaust: '把发动机排气经催化器、管道和后消声器导出；不是本项目的四轮路噪源。',
  chassis: '承载车身和动力部件。底盘附近的振动参考传感器为 RNC 采集路面激励相关信息。',
};

const categoryRoles: Record<string, string> = {
  cabin: '两排五座及驾驶操作件构成教学座舱；四个指定头枕附近是固定的 RNC 误差声压点。',
  shell: '外壳和车门用于展示车身及拆解层次；外形与尺寸为原创教学设计。',
  suspension: '车轮路面激励通过悬架与车身传递；本模型允许把振动参考传感器安装到可见结构。',
  wheel: '四个轮胎各自对应一路路面激励 q；本教学声学模型只把这四处作为路噪源。',
  electrical: '展示车辆供电、功率电子和辅助电气件；外形、端子与管线是教学简化。',
  energy: '展示储能或供油位置；本模型尺寸和容量不代表某一量产车。',
  powertrain: '展示动力转换与传递部件；形状和比例是教学简化。',
  exhaust: '展示燃油车的排气路径；外形和消声器内部结构未按实车测绘。',
  chassis: '展示承载和安装结构；不代表生产级结构或有限元模型。',
};

export function describeVehiclePart(kind: VehicleKind, part: VehiclePart): PartGuide {
  const id = part.object.name;
  const architecture = architectures[kind];
  const hardware = id === 'chassis' || id.startsWith('wheel-') || id.startsWith('suspension-') || id.startsWith('seat-') || id.startsWith('door-');
  const sourceKey = hardware ? 'hardware' : id === 'fuel-tank' || id === 'exhaust' || id === 'transmission' ? 'gasoline' : architecture.source;
  const source = sources[sourceKey];
  const role = id === 'combustion-engine'
    ? kind === 'erev' ? '增程发动机仅与发电机机械连接；本教学车的前轮没有来自发动机的驱动半轴。'
      : kind === 'hev' ? '发动机的机械功经功率分流机构保留到前轮的支路，同时可带动 MG1 发电。'
        : '汽油发动机把燃料能量转成机械功，经变速器和前差速器驱动前轮。'
    : id.startsWith('door-')
    ? '此车门内置一只教学 RNC 扬声器，作为次级声源 OUT；爆炸时随车门移动，声学计算位置保持不变。'
    : id.startsWith('seat-')
      ? categoryRoles.cabin
      : roles[id] ?? categoryRoles[part.category] ?? '此件为原创教学车辆的一部分。';
  return { id, title: part.name, role, path: architecture.path, sourceLabel: source.label, sourceUrl: source.url };
}

const featured: Record<VehicleKind, readonly string[]> = {
  ice: ['combustion-engine', 'transmission', 'fuel-tank', 'exhaust', 'chassis', 'wheel-fl', 'door-front-1', 'seat-1'],
  bev: ['traction-battery', 'inverter', 'traction-motor-rear', 'charge-system', 'chassis', 'wheel-fl', 'door-front-1', 'seat-1'],
  hev: ['combustion-engine', 'power-split', 'traction-motor-front', 'traction-battery', 'inverter', 'fuel-tank', 'exhaust', 'wheel-fl'],
  erev: ['combustion-engine', 'range-generator', 'traction-battery', 'inverter', 'traction-motor-rear', 'charge-system', 'fuel-tank', 'exhaust'],
};

export function featuredVehicleParts(kind: VehicleKind, parts: readonly VehiclePart[]): VehiclePart[] {
  const byId = new Map(parts.map(part => [part.object.name, part]));
  return featured[kind].map(id => byId.get(id)).filter((part): part is VehiclePart => !!part);
}
