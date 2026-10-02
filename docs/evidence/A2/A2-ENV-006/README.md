# A2-ENV-006 · 云境香槟整体页面与四环境

2026-10-01 · Role: A2 · Identity-Source: user-declared · Codex 代 A2 执行。

用户要求以 `docs/design/FINAL_PRESENTATION.md` 为最终视觉验收依据，优化整体页面和全部背景。沿用本会话 A2 身份，使用 interactive-3d-atlas；景观位图使用 imagegen 内置工具。保留工作区上一批 A2-XPENG-005 的五车细化成果。

## 已实现与母版对照

| 母版要点 | 本批落实 |
| --- | --- |
| 湖畔日落、开放玻璃展厅 | 新湖山远景、弧顶/玻璃立面/细柱、座椅/石块、实例化枝叶；修复旧顶棚占满天空 |
| 温暖且有层次的地面 | 分形石纹、真实镜面反射的九点过滤、分辨率随视口调整；分场景曝光、主光、补光及 HDR 反射 |
| 全部四环境 | 海岸、山地、沙漠、雪山独立素材和光照，菜单真实缩略图，页面导航保持环境 |
| 暖白玻璃与香槟控件 | 四页统一材质、留白、标题、导航与悬停；结构页两侧工具、对比页车型选择避免遮挡 |
| 真实模型与数据 | 卡片由同一车辆即时透明渲染；实验前无示例读数，热图/频谱/指标继续从有效计算读取 |
| 不同屏幕清晰度 | 主画布原生/高 DPI 分辨率保留；跨越窄屏断点重新取景，手机车辆/控制/结果分区 |
| 切换稳定与失败状态 | HDR 单路串行、只跟进最新选择、最近两种纹理缓存；加载失败显示后备天空与说明，切回可用场景恢复 |

母版指定布局和材质方向已逐页对照，正式产品仍是可旋转、点选、拆回装、剖切的 Three.js 模型与真实 HTML 控件。不是把整页效果图铺成背景。实际车型沿用用户后续指定的小鹏系列。

## 修改范围

- `src/team-a/viewer/champagne-gallery.ts`：四景、几何/材料、景片投影、反射、异步加载与释放。
- `src/team-a/viewer/lab-viewer.ts`：环境光照、反射尺寸、透明预览、断点相机、加载状态。
- `src/team-a/lab/champagne-shell.ts`：环境主题/署名、标题、资源就绪后刷新预览。
- `src/team-a/lab/champagne.css`：四页玻璃/标题/布局、真实缩略图、柔光层级、响应式。
- `src/team-a/viewer/assets/`：三份新增 4K HDR、两张生成景片、四张 WebP，以及素材来源说明。
- 本证据目录、根 `开发记录.md`、`docs/coordination/A2.md`。

整体页面优化已获用户明确授权，涉及 A1 维护的 A 组展示壳/CSS，已在开发记录登记原因；本批未改 B、shared、integration、数值算法或冻结 fixture。工作区的车辆源码/测试差异属于上一批 A2-XPENG-005，未撤销或覆盖。

## 素材与分辨率

[当前运行素材、来源与许可](../../../../src/team-a/viewer/assets/CHAMPAGNE-ENVIRONMENT.md)。四 HDR 原生 4096×2048；两张生成远景原生 **1774×887**，不是 4K，也不是标定无缝全景。只投射于限定正面角域，边缘融合至完整 HDR；光照仍来自 HDR。沙漠为艺术组合。

[完整实际提示词与产出路径](image-prompts.md) · [素材大小与 SHA-256](asset-manifest.json) · [最终源码 SHA-256](source-manifest.json)。

四 HDR 合计约 102 MB，按需串行加载；初次仅选中环境约 25 MB。资源随 Vite 本地打包，运行不访问外部 CDN；未新增 Service Worker。目标核显显存/帧率仍需要设备验收。

## 实际验证

最终全仓检查 **194/194** 通过，包含类型、边界及构建；Chrome 产品 **69** 项、环境专项 **23** 项、高 DPI 鼠标 **12** 项（合计104项）全部通过。实际画布 3840×2004，四个修改源码的 SHA-256 与最终检查版本一致。最终正常流程无 JS/WebGL 异常或失败请求；专项另有主动模拟失败与恢复。已查看最终四环境及页面/窄屏截图，`git diff --check` 通过。

- `check.log`：`pnpm check`，包含 `typecheck`、`check:boundaries`、全部 194 项测试与生产构建。
- `product-regression/browser-results.json`：四页/五车、真实 Worker 批量与连续实验、A/B、导出、七档 390～3840 宽度。
- `interaction-results.json`：真实鼠标旋转、滚轮、点选、拆回装、五车切换和 DPR=2。
- `environments/results.json`：快速切换、主题/车型/参数/页面一致、透明预览、按需请求、资源失败恢复。
- `product-regression/*.png`、`environments/*.png` 与 `hidpi-interaction.png`：最终浏览器截图。

复现：先 `pnpm build`，设置 `PORT=5197` 后运行 `node scripts/serve.mjs`；再按序运行本目录 `product-regression.mjs`、`environment-check.mjs`、`interaction-check.mjs`。这些浏览器脚本使用本机 `test-results/a2-tools/browser/node_modules/playwright-core` 与 Chrome；复现设备需具备对应工具。不要把浏览器模拟尺寸当成实体设备测试。

## 纠错与限制

- 首轮类型检查暴露 `ReflectorShader` 运行时静态成员未被类型包声明；核对 Three 实现后补局部准确类型，未修改依赖。
- 中间截图发现景片错误当成完整全景造成放大，HDR 翻转试验造成倒置，以及标题/窄屏/蒙层遮挡；逐项修复。中间截图留在忽略目录 `test-results/champagne-refine`，不作最终效果证据。
- 快速切换首测有一条 Quarry HDR 请求失败，无 JS/WebGL 异常；当时未记录 errorText，未宣称已证明根因。保留 `environments/first-failure.json`；改为串行跟进最新选择。第二轮仍记录一条 `net::ERR_ABORTED`（`second-failure.json`），第三轮同一最终源码 23 项全通过，无失败请求；未把瞬态中断归为已证明的网络或业务根因，未豁免错误断言。专项明确模拟的加载失败在单独页面验证后备与恢复。
- `check-before-queue.log` 是加载队列修正前的通过日志；最终以 `check.log` 和最终浏览器结果为准。未放宽既有测试容差或数值断言。
- 当前仍有与母版摄影效果的差距：展厅几何/景物是实时可交互重建，生成景片只覆盖正面，离轴可见原 HDR；并非整圈同一实景。母版摄影级材质、用户最终视觉签收、目标核显和第二机验收仍待完成，不宣称这些已通过。
- 五车型原有公开资料重建、隐藏工程尺寸估计和未实车声学标定的限制不因本批环境优化改变。

## 本地与远端

分支 `a/a2-xpeng-reconstruction`，基线 `a88536a58d5f489cb245246d243dd0eb23b333e1`。已只读 fetch / 核对开放 PR；本批未新发布任务认领，不宣称新增远端任务占用。**无新增提交 SHA，未提交、未推送、未更新 PR；仅本地，GitHub 尚未同步。** 用户要求新的明确上传指令才发布。

预览：<http://127.0.0.1:5197/>。下一步为目标设备性能、四景离轴视觉和母版对照的人工最终验收；上传须用户明确指令。
