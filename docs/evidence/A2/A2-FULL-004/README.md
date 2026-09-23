# A2-FULL-004：四架构动力与车底检视

日期：2026-09-24。本批基于 A2-FULL-003 的 `19973ca`，开发分支 `a/a2-full-004-architecture`、[草稿 PR #9](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/9)，依赖 #8→#7；确切运行源码提交在本批代码推送后固定。当前构建主包 `dist/assets/index-DJCirg5A.js` SHA-256 为 `53b6b992918d6b689834cc95ba2b876c1f4f07de28b8493d95ab039f7c4171f8`，viewer 包 `dist/assets/index-Y1rfaRRu.js` 为 `577599665254a3a009b12949b95d4366bd58ac06b5457e0561236a0f3ae9abfa`。未合并的源码、同机运行与正式集成版本分别对待。

## 本轮实作与来源

四种架构沿用[已核对的官方部件和路径依据](../../../research/vehicle-architectures.md)。ICE 保留发动机—变速/前差速—前轮的机械路径，补可见的变速器钟形壳体、发动机外部进气/油底壳与油箱绑带、排气后部热屏；BEV 补底板电池外框与安装筋、充电口外圈、车载充电器底座、后电机端盖/减速器接口、逆变器底座；HEV 将发动机、功率分流壳体、MG1、MG2 外形区分并保留到前轮的机械支路；EREV 发电机与发动机同轴连接，橙色电气连接通往底板电池和后桥电驱，**没有**发动机到前轮的传动轴。壳体尺寸、法兰、连接筋和配色是原创教学设计，不冒充实车测绘或内部电芯/齿轮/线束路由。

为了让用户直接检视车底，OrbitControls 最大极角由 `0.51π` 扩至 `0.84π`，未增加 A1 控件或共享接口。[真实鼠标拖动结果](orbit-result.json)从默认相机移动到车辆下方，见[拖动后截图](orbit-underbody.png)。电池底部取消会遮盖电池的大面积护板，保留外露封装及四边安装筋；[可见性测试](../../../../tests/a2-vehicle-model.test.ts)从车底射线确认 BEV/EREV 首个可见部件为动力电池，ICE 则不是。车底真实护板设计并非本教学几何的制造声明。

## 原图与验证

- [同版视角清单](screens-result.json)：四车型各有 V5 前舱、V5 后桥合拢、V6 车底，以及 V5 后桥分层展开，共 16 张 1500×1000 未裁切原图。`capture-v5-v6.js` 记录相机、target、车身/展开状态与 ANGLE 实际 GPU；`viewer.html` 只隐藏硬件与声场标记以便检查几何，**不代表完整页面无标记**。前舱/后桥合拢图分别可追溯到对应文件，例如 [HEV 前舱](hev-v5-front.png)、[BEV 车底](bev-v6-underbody.png)、[EREV 展开后桥](erev-v5-rear-open.png)。后驱电机在合拢上视角会被行李厢底板遮挡，展开后可见；这不是模型缺失。
- [六组真实网格剖面与爆炸数值](section-result.json)：四车 X=0、HEV 另测 Y=1.06/Z=0.1，均有实体截面；BEV 展开安装问题为空，座舱/车顶位移 `.45/1.0 m`。沿用[A2-FULL-003 剖面脚本](../A2-FULL-003/section-regression.js)在本轮源码重新运行，不能由上轮旧结果代替本轮回归。
- [完整页面结果](full-app-result.json)：真实 Worker 默认 BEV 约272 ms就绪，隐藏壳体/展开后 16 个硬件和源标记仍存在；切换 EREV 后旧实验明确失效。[BEV 完整页](full-app-bev-open.png)、[EREV 完整页](full-app-erev-open.png)揭示默认页面中标签仍较密、结构在窗口内仍偏小。此项只验证本轮几何没有破坏页面联动，不代表完整声学或视觉终验。
- `pnpm check`：60/60 工程测试、类型、源码边界、生产构建通过。四车网格三角约 ICE 46,016 / BEV 46,004 / HEV 48,260 / EREV 48,932，仍低于既有 50,000 守护线；三角数只用于当前负载观察。运行环境为 Windows 11、Chromium、ANGLE NVIDIA RTX 4070 Laptop GPU/D3D11；指定核显性能仍未测。

## 仍有差距与接续

近景虽能区分动力关系，外壳、连接和附件仍是教学级几何，BEV 前舱充电器仍较像盒体，HEV 功率分流/电机没有实物截面精度，ICE/HEV/EREV 底部排气、油箱和悬架连接在整页常规距离下不够清晰。缺同视角《地平线》参照资产与人工对照，**A2-F2 视觉精细度仍未通过**。V5/V6 是同版结构检查入口，不意味着 V7/V8 或 A2-F7 已通过。可用车底角度存在，但没有一键底视，若产品需要该入口，应在 A2 交接中向 A1 提兼容接口请求。

下一批优先处理 V7/V8 的全车型分层与三轴截面观察方式、完整页标记遮挡和结构说明；随后做目标核显、长稳与同版正式验收。保留本轮部件 ID、四轮中心、四门扬声器/四头枕物理点和正确能量路径；A1 可独立推进实时音频及页面。

复现：仓库根执行 `pnpm install --frozen-lockfile`、`pnpm dev -- --port 5183`，访问 `/docs/evidence/A2/A2-FULL-004/viewer.html`；`capture-v5-v6.js`、`orbit-underbody.js` 和 `full-app-check.js` 是 Playwright `page` 回调，原始截图/JSON 已随本目录入库。底视需在真实视口从默认相机向上拖动，不能只通过脚本设置不可达相机冒充可用性。
