# A2-FULL-012：四车共用驾驶舱近景可读性

状态：本批 A2 局部实现与本机验证完成，待审查和整组最终验收。基线为 A2-FULL-011 已提交 `1d6c5b0`；工作分支 `a/a2-full-012-cockpit-readability`，草稿 [PR #17](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/17)，依赖 #16→#15→#14→#13→#12→#11→#10→#9→#8→#7。经验证运行源码 SHA 见本批后续固定版本提交；本文与最终源码在同一 PR 中。

## 范围与实现

- 四车型共用的原创教学座舱补充仪表屏/中控屏外框及示意界面、方向盘按钮和拨杆、中央扶手接缝/锁扣、杯托内衬与选择器、门内饰线条。屏幕图形是装饰，不是 RNC 实验数据；没有复制量产车精确零件。布局参考 [Volkswagen ID.4 官方座舱资料](https://www.volkswagen-newsroom.com/en/press-releases/freedom-on-the-outside-free-space-on-the-inside-the-interior-of-the-new-id4-6361)。
- 结构选择器增加「仪表台、方向盘、踏板与中央扶手」入口及说明；隐藏车壳后选择该项可将相机移入座舱。恢复实体车身时相机返回外部可观察位置。近处硬件标记随距离收小，避免遮住屏幕；通道、四头枕误差点、四门扬声器、物理安装坐标及 viewer 对外接口不变。
- 模型几何与材质仍由原 `createVehicleModel` 生命周期释放。本批没有修改 A1 页面、B 数值、shared 或 integration；完整页面功能只作消费侧回归。

## 可复现证据

运行 `capture-cockpit.js` 的 Playwright 页面函数，在 `docs/evidence/A2/A2-FULL-005/viewer.html` 固定 1500×1000 视口、机位、四车模型与隐藏车身状态；`before-*.png`、`after-*.png` 为 10 组成对原图，`before.json`、`after.json` 保存机位、模型三角数、GPU 与上下文状态。近景对比中的相机最小距离在旧版夹具中临时设为 0.6，仅用于同机位视觉比较；旧产品页面并不能由用户进入该近景，新版可从结构选择器到达。BEV 另有屏幕与中央通道两个特写。四车同样新增 436 个三角形：ICE 46,568→47,004，BEV 46,556→46,992，HEV 48,812→49,248，EREV 49,484→49,920；数字只表示几何规模，不代表视觉质量达标。

运行 `check-full-app.js` 的真实 `lab-v3` 页面函数，BEV 实验就绪后切换隐藏车身、选中驾驶舱、关闭说明、回到实体车身。`full-app.json` 保存实验身份、说明文本、可见标记数、WebGL 状态和页面异常；`full-app-zoomed-cabin.png`、`full-app-solid-after-cabin.png` 保存实际用户视图。实验身份始终为同一个 `run`，0 页面异常、0 WebGL 上下文丢失。此回归检查了完整页面入口与返回行为，没有重新计算场值、验证声学数值或实物声音。

本机 `$env:PATH='D:\MyProgram\nodejs;' + $env:PATH; pnpm check` 通过：类型、边界、66/66 测试及生产构建。构建产物 `dist/index.html` SHA-256 为 `a5ac7c1a92f3eb1282738855b61508553c07270028fe342ce6520437b6a1e318`。截图环境为 Chromium/ANGLE/NVIDIA RTX 4070 Laptop GPU (D3D11)；不是目标核显。

## 仍需完成

本批只提高共同驾驶舱若干构件的近景层次。A2-F2 所要求的四车型整车游戏参照视觉质量、完整内外饰/结构人工审查、目标核显、正式五分钟整组讲解与同版离线包仍未通过。A2-FULL-011 的移动场平面还需 A1 在剖面变化时使旧请求失效、暂停时重新查询，并由 integration/B 核对负载与同窗数据。本批没有声称这些跨角色事项已经完成。
