# 四类 SUV 的建模依据与实现边界

核对日期：2026-09-23。用户恢复完整目标后，这份资料取代旧计划中“只建一辆纯电 SUV”的建模限制。外观为原创双排五座教学 SUV，长度约 4.8 m、轮距 2 m、轴距 2.9 m。尺寸、曲面控制点及配色是为可读性作出的工程设计，不冒充某一量产车测绘结果。

## 结构依据

| 架构 | 可核对的公开依据 | 本模型采用的结构与机械/电连接 |
| --- | --- | --- |
| ICE 纯燃油 | 美国能源部 [Gasoline car components](https://afdc.energy.gov/vehicles/how-do-gasoline-cars-work)；Toyota [RAV4 公开技术资料](https://newsroom.toyota.eu/new-toyota-rav-4-hybrid/) 中的横置发动机、承载式车身及悬架说明 | 前舱横置汽油机、变速器/差速器、前半轴；后部油箱、油管、催化器、底部排气与后消声器。发动机经变速器机械驱动前轮。 |
| BEV 纯电 | 美国能源部 [All-electric car components](https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work)；Volkswagen [ID.4 结构与座舱说明](https://www.volkswagen-newsroom.com/en/the-id4-from-volkswagen-15712/design-vehicle-interior-and-controls-15718) | 座舱底板下扁平动力电池，后桥电机、减速器/差速器、逆变器、后半轴；充电口、车载充电器、DC/DC、橙色高压线。无油箱、发动机或排气。采用后驱结构，非所有纯电车的唯一布局。 |
| HEV 混动 | 美国能源部 [Hybrid electric car components](https://afdc.energy.gov/vehicles/how-do-hybrid-electric-cars-work)；Toyota [2015 RAV4 Hybrid 原厂说明](https://newsroom.toyota.eu/new-toyota-rav-4-hybrid/) | 选择功率分流前驱 HEV：前发动机、MG1 发电机、MG2 驱动电机、行星功率分流机构、前差速器/半轴；后排下小电池、逆变器、油箱及排气。发动机与车轮之间保留机械路径；MG1 是分流支路，MG2 可提供驱动力。未冒充串联增程。无外接充电口。 |
| EREV 增程 | Stellantis/Leapmotor [C10 Hybrid EV 原厂技术资料](https://www.media.stellantis.com/uk-en/leapmotor/press/leapmotor-c10-uk-press-information) | 前舱发动机直接联接发电机，橙色高压线路接电池/后逆变器，后电机通过减速器驱动后轮。发电机组与车轮**无机械连接**；前桥无驱动半轴。底板电池、油箱、排气、外接充电口均存在。 |

选择这些资料，是因为它们直接说明部件作用和关键布局；建模不要求下载或复制商标车模。RAV4 的 HEV 前驱架构、ID.4 后驱 BEV、C10 后驱 EREV 可作为进一步查证的实车参考，不能由本模型反推它们的精确管线、悬架尺寸或认证性能。四种教学车统一采用同一原创外壳，便于只比较动力结构。

## 座舱与底盘

- 五座两排：两张前座、三位后座、五个头枕、座椅支架、背部及坐垫、座椅轮廓/侧翼；左侧方向盘及转向柱、仪表台、仪表屏、中央屏、扶手储物箱、杯托、油门/制动踏板、内门板和拉手。位置布局参考 [Volkswagen ID.4 座舱说明](https://www.volkswagen-newsroom.com/en/press-releases/freedom-on-the-outside-free-space-on-the-inside-the-interior-of-the-new-id4-6361) 与上述 C10 的座椅、扶手储物及杯托说明。
- 四轮胎、轮辐/轮毂、制动盘/卡钳、前后副车架、控制臂、弹簧/减振器、底板、门槛与横梁。Toyota 公开说明支持前 MacPherson、后独立悬架这一教学选择；杆件简化为结构示意，未声称真实运动学和生产级碰撞结构。
- 四个车门内侧各有一个可辨识扬声器，供 RNC OUT 标记对应。其数量来自用户的演示要求，不代表上述量产车原装音响数量。
- 曲面车头/车顶/尾门、侧围轮拱、独立车门缝、前后挡风玻璃、侧窗、A/B/C 柱、后视镜、灯组、保险杠、轮眉和雨刷。透明与剖切是教学查看方式，爆炸偏移不是维修拆装顺序。

## 代码交接

`src/team-a/viewer/vehicle-model.ts` 的 `createVehicleModel(kind)` 返回顶层 `group`、可动画的 `parts`、可切换显示/透明的 `shell`、四个 `wheels`、模型所有 `materials` 与幂等 `dispose()`。单位为米；+X 为车辆左，+Y 向上，+Z 为车头。轮中心为 `(±1, 0.42, ±1.45)`，轮胎半径约 0.40 m。`parts` 每项的 `object` 为顶层组，`origin` 为初始位置，`offset` 是完全展开的位移；调用方按同一插值进度设 `position = origin + offset × progress`，不要叠加位移。轮组绕自身 X 轴滚动。

`object.name` 与 `userData.component` 保存稳定部件标识，`parts.name` 为中文讲解名称，`category` 区分 shell / cabin / chassis / suspension / powertrain / energy / electrical / exhaust / wheel。`userData.description` 用于解释能量或机械连接。所有材质都由单次模型工厂拥有；调用 `dispose()` 前先从场景移除 group。

头枕附近麦克风使用共管契约的坐标；所有 cabin 分组爆炸上移 0.45 m。四个实体扬声器网格名为 `speaker-fl/fr/rl/rr`，中心与 `SPEAKER_POSITIONS` 一致；它们分别归属 `door-front-1`、`door-front--1`、`door-rear-1`、`door-rear--1`。车门完全展开时向同侧外移 0.72 m、上移 0.35 m，标记和声波表现应跟随该位移，计算坐标不变。

## 本批验证

2026-09-24：`tests/a2-vehicle-model.test.ts` 的 2 项测试通过，覆盖四类架构的必需/禁用部件、五座、轮坐标、四扬声器坐标、独立爆炸层级、有限几何、尺寸范围与资源幂等释放；类型检查及 A/B 边界检查通过。实际模型总三角数为 ICE 44,508、BEV 44,976、HEV 46,896、EREV 47,300，不等同实际帧率承诺。

在真实 Chromium/WebGL 独立场景核对四类实体、隐藏外壳、85% 爆炸展开三组截图；修复了初版 HEV 电机与发动机体积重叠和 EREV 充电器占用发动机空间的问题。该核对证明模型可以渲染并展示结构差异；应用选择、动画时间、声场随动、剖切和目标核显性能仍由集成验收覆盖，不能由本模型测试代替。

## 尚未达到的完整目标

这是有资料支撑的程序化详细教学模型，**尚未达到《地平线》系列的外观精度**。尚无扫描车身、PBR 纹理集、焊缝/紧固件/完整内饰缝线、生产级悬架运动学、散热软管和真实线束布置。不能用“四类可切换”或自动测试通过替代视觉精度验收；后续需逐视角检查并迭代曲面和细节，必要时引入有明确授权的精细资产。本模型不提供真实车辆 NVH 标定，也不把几何爆炸位置用于重建物理通道。
