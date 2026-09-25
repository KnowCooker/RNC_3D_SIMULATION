# A2-FULL-005：V7 分层、V8 三轴截面与完整页标记

日期：2026-09-24。基线为 A2-FULL-004 的 `3a965fd`，[草稿 PR #10](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/10) 依赖 #9→#8→#7；经验证的运行源码提交为 [`9f8b7aa8bc96386ab28c617d88e932cc4c5e54fa`](https://github.com/lzhdai/RNC_3D_SIMULATION/commit/9f8b7aa8bc96386ab28c617d88e932cc4c5e54fa)。此处是 A2 局部视觉/交互证据，不表示 main 已合并或完整 A 组交付。

## 实际改动

- 完整实验 viewer 的 16 个硬件/轮端标签在足够尺寸下排到车辆两侧，并以细引导线指向真实投影点；点选和右键仍使用原回调与物理锚点。旧 demo-v2 继续调用原 `placeLabels`，不改其布局。
- 从页面切换 X/Y/Z 剖面轴时，viewer 将相机对准切除侧的实体截面；拖动同一轴的剖面位置不会反复抢走手动视角。Y 视角极角 2.536，小于产品上限 2.639。截面模式下降低场采样点不透明度，静态接触阴影也随剖面/爆炸衰减；不改场值、物理坐标或 renderer 公共接口。

## 可复现证据

1. [原始采集脚本](capture-v7-v8.js)、[模型夹具](viewer.html)及[44 条相机/偏移/截面/GPU 结果](capture-result.json)：四车型各有前左和后右 V7 合拢、中间、完全展开、回收共 8 图，以及 V8 X=0、Y=1.05、Z=0.1 三轴共 3 图，共 44 张 1500×1000 原图。示例：[BEV 前左中间](bev-v7-middle.png)、[BEV 后右展开](bev-v7-rear-open.png)、[HEV 水平截面](hev-v8-y.png)、[EREV 横剖](erev-v8-z.png)。中间状态屋顶位移约 0.6 m、座舱约 0.27 m；完全展开分别 1.0/0.45 m，回收后 0。三轴四车均有实体封口且实际相机极角未越界。夹具为净结构检视，隐藏硬件/场叠层，不能代替整页。
2. [完整页面 UI 脚本](full-app-inspection.js)、[六组真实页面状态](full-app-result.json)与对应 `full-*.png`：通过页面选车型/轴、键盘移动剖面滑块、点击侧栏 REF、展开、开启初/次级路径及真实残余场，再把播放位置点到 3.91 s 取得空间窗口；HEV 切换后真实重算。默认 BEV 16 个可见标签/16 条引导线；三个剖面各 8 个可见标签/8 条线，脚本断言标签不占车辆中央区域且仍能选中 REF FL。示例：[完整页 BEV 水平剖](full-bev-y.png)、[BEV 展开与真实场](full-bev-exploded-field.png)、[HEV 纵剖](full-hev-x.png)。
3. 本机 `pnpm check`：A2 标签回归、全部工程测试、类型、源码边界和生产构建通过；本批新增完整页与窄窗侧栏布局断言。运行浏览器的实际 GPU 为 Chromium/ANGLE `NVIDIA GeForce RTX 4070 Laptop GPU`，**不是目标核显**。构建主包 `dist/assets/index-BDeF0WCo.js` SHA-256 为 `4a3ec725f2046312fae3a5d233146b6e4b0c5f72e6e78f0b4c2a35773efe3ddb`；`dist/assets/index-D3a-2bxx.css` 为 `e3ec59ee5cb79f74c1509bdc8c8005b100318f34dcf037a091b5deaa28bbeca3`。构建仍有大于 500 kB 的原有包体提醒。

复现：仓库根执行 `pnpm install --frozen-lockfile`、`pnpm dev -- --port 5183`；运行 `capture-v7-v8.js` 时访问 `/docs/evidence/A2/A2-FULL-005/viewer.html`，运行 `full-app-inspection.js` 时访问根页。两脚本为 Playwright CLI 的 `run-code` 回调；脚本返回原始 JSON，截图写本目录。整页脚本按真实 UI 输入和 Worker 计算，不把旧场结果套到 HEV。

## 未通过与下一步

V7/V8 目前是固定视角的 44 张静帧及位移/截面断言，缺连续录像、所有材质模式下穿越薄蒙皮/动力件的过程、逐项人工视觉对照。全开场/路径时，场采样球和连线仍会遮挡部分座舱与截面，虽然侧栏标签已退出车体中央；页面内尚无部件名称与架构路径的逐件讲解入口。外观和座舱仍是教学级，与《地平线》参照精细度有明显差距，**A2-F2/A2-F7 未验收**。下一批需要继续处理结构说明、全开叠层可读性、更多剖面位置/材质组合与正式录像；目标核显 30 fps 和最终包/第二机验收也仍缺。
