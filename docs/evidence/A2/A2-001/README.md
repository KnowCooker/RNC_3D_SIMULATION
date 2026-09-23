# A2-001 标签与点选验证

日期：2026-09-23。执行者：Codex root-a2-markers。分支 `a/a2-001-markers`，基线 `9b2fb8e`；最终代码版本由 [PR #3 HEAD](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/3) 定位。Windows 本机 Chromium、Vite 参考回放，默认 seed 11 / taps 64 / μ 0.08；没有混入 A1 播放器或状态修复。

## 复现与修复

- 默认视角实测 `REF RL / OUT RL`、`OUT RR / MIC FL` 标签矩形重叠。原标签为 8px span，`pointer-events: none`，只能点击小球。
- 现用 64 × 24px 按钮、10px 字体、中文位置/硬件说明、键盘焦点与选中状态。空间不足时标签移开并以引导线保留真实硬件位置；不改变硬件坐标。
- 缩至 390px 浏览器窗口时，原 Three.js `setSize` 写入的固定 CSS 宽度让 viewer 保留 937px。改为 viewer 自有 canvas 100% CSS、`setSize(w, h, false)`，同窗口下实测 viewer 375px。
- `createViewer` 的创建、render、setBody、setExploded、reset 和点选回调未改变；仍消费外部统一播放时间。viewer 数据属性使用 `data-viewer-*`，避免与 A1 的选择器耦合。

## 坐标与信号核对

右手系：+X 车辆左侧、+Y 上、+Z 车头。每类顺序均为 FL/FR/RL/RR；保留原模型坐标及展开位移。

| 类别/信号 | FL | FR | RL | RR | 展开 ΔY |
| --- | --- | --- | --- | --- | --- |
| REF / x | (0.86,0.8,1.45) | (-0.86,0.8,1.45) | (0.86,0.8,-1.45) | (-0.86,0.8,-1.45) | 0 |
| OUT / u | (1.03,1.15,0.65) | (-1.03,1.15,0.65) | (1.03,1.15,-0.75) | (-1.03,1.15,-0.75) | 0.65 |
| MIC / e | (0.48,1.86,0.4) | (-0.48,1.86,0.4) | (0.48,1.86,-1.01) | (-0.48,1.86,-1.01) | 0.4 |

## 复现命令

先启动 `pnpm dev:a --port 5174`，用 Playwright CLI 独立 session `rnc-a2` 打开 `http://127.0.0.1:5174` 并执行 snapshot，再执行：

```powershell
playwright-cli -s=rnc-a2 run-code --filename docs/evidence/A2/A2-001/browser-check.js
pnpm check
```

脚本通过正常 DOM 点击、鼠标拖动和键盘操作验证，不暴露 Three.js 私有对象、不改应用状态。截图先写到 `output/playwright`，正式证据复制到本目录。

## 实际结果

- `pnpm check` 通过：类型、源码边界、9/9测试、生产构建（含2项 A2 碰撞布局测试）。
- [浏览器结果](browser-result.json)：90/90断言；五种视图 × 12标签逐点点击，图表信号/通道和 MIC 试听座位一致，全部标签在视口内且无矩形重叠。含小球射线点选、旋转拖动不误选、Enter/Tab/Space键盘操作。
- 视图：1440×1100 默认、旋转、展开、实体车身展开；390×844 窄窗。实际无头窄窗 viewer 390px，headed 带滚动条为375px。
- 截图：[修复前](before.png)、[默认](default.png)、[旋转](rotated.png)、[展开](exploded.png)、[窄窗](narrow.png)。已逐张检查。
- 并行 headed 浏览器后台节流曾使旋转阻尼以约1fps缓慢更新，导致等待元素稳定超时；最终在独立无头 session `rnc-a2-check` 完整通过，没有修改产品时钟、阻尼或测试断言。首次固定500ms读高亮过早，脚本现等待真实 aria 状态。

## 边界

本任务验证标签交互与位置对应；核显目标机帧率、20轮复位、20分钟稳定性、实际听感和音画延迟未验收。截图中的瞬时 fps 不是性能验收证据。初次浏览器打开出现既有 favicon.ico 404；复测无 JavaScript 错误。主脚本约521kB的构建体积提示仍存在。
