# A2-FULL-011 移动剖面真实声场采样平面

本批从 A2-FULL-010 已提交 `97ffcf0` 开始，对应[草稿 PR #16](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/16)。经验证运行源码 SHA 与原仓库 CI 在后续证据固定提交中填写；开放 PR 不等于 main 已集成。

## 实现与物理语义

当 X/Y/Z 声场切片轴与车身剖面轴一致时，viewer 将原 280 点网格的对应中心层移动到当前剖面坐标：X 层 40 点、Y 层 56 点、Z 层 35 点。页面沿用既有 `field(time, points)` Worker 查询；B 组在新的三维坐标计算声压级，三角面内仅做显示插值。色片顶点同步移动到查询位置，旧点位帧立即隐藏，坐标不匹配的返回也不得上色。其余网格点保持不变，体积模式和不匹配轴的场片仍用原固定网格；爆炸显示偏移不改变物理查询坐标。切片与裁剪面重合时，仅该透视色片不受浮点边界裁剪，车辆实体仍按真实剖面裁剪。

## 实测证据

- [浏览器复现脚本](check-moving-plane.js)在真实 lab-v3/Worker 页面记录发出的场请求，核对每个中心层的 280 点布局与当前位置，并在返回后检查色片坐标说明。四车原始结果：[BEV](bev.json)、[ICE](ice.json)、[HEV](hev.json)、[EREV](erev.json)。四车型各覆盖 X=-0.40/0.40 m、Y=1.10/1.60 m、Z=-0.80/0.80 m，共 24 个位置；24 次均请求到了匹配点位并显示当前剖面真实采样说明，四车型各自实验标识保持不变，页面异常与 WebGL 上下文丢失均为 0。
- 每车型每轴两张同版视角截图，共 24 张，例如 [BEV X=-0.40](bev-x-first.png)、[BEV X=0.40](bev-x.png)、[EREV Z=-0.80](erev-z-first.png)、[EREV Z=0.80](erev-z.png)。截图检查了裁剪边界两侧的可见性；不将透视叠层解释为真实遮挡模拟。
- [环境](environment.json)：Windows Headless Chromium 153、1440×1000、ANGLE NVIDIA RTX 4070 Laptop GPU/Direct3D11，非目标核显。本机 `pnpm check` 通过类型、A/B 边界、66/66 测试和生产构建；同版 `dist/index.html` SHA-256 为 `4D745B4A75CE045B7627F8281B07109171CD2468C879762DA514D71F72ABB6A7`。

复现：从仓库根运行 `pnpm dev -- --port 5183`，以 Playwright CLI 打开 `http://127.0.0.1:5183/?captureVehicle=bev`，用 `run-code --filename docs/evidence/A2/A2-FULL-011/check-moving-plane.js` 运行；再分别导航到 `captureVehicle=ice/hev/erev` 重复。脚本通过真实页面控件修改剖面和查询时间，并观察 Worker 请求，不构造假场数据。

## 完整应用尚需联调

当前 A1 仅在播放时间变化超过 0.15 s 时轮询声场。**只拖动剖面滑块且时间暂停不一定发出新查询**；A2 会隐藏旧位置色片，不能宣称暂停态已自动获得新场。A1 需在 `section()` 变化时使旧请求的 `fieldEpoch` 失效并触发当前绝对时间的重查，即使时间未变；移动过程中可节流，但最终位置必须查询。integration/B 应核对多次任意点请求的负载、实验身份及同窗语义。上述跨端工作、目标核显性能、最终视觉质量和整组正式交付仍未验收。
