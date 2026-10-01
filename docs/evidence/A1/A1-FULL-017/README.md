# A1-FULL-017：三维实验台视觉改版证据

Role: A1；Identity-Source: user-declared；执行者 Codex 代 A1。原仓库[草稿 PR #45](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/45)；基线为原仓库 `main` `842bec8`。本批只改 A1 的正式 lab-v3 页面和样式，A2 viewer 模型/场景、B 数值、shared/integration 及冻结 fixture 均未改。

## 视觉决策

用户要求界面更令人眼前一亮。本批采用深蓝黑、霓虹青、酸绿及少量洋红的赛博工业实验舱语言：顶部品牌与系统状态、三维舞台边框、任务引导、配置抽屉、四座指标、图表和试听区使用统一的层级与焦点反馈。保留三维世界为最大可视区，不用装饰性假仪表覆盖车辆或替换实际声学结果。标题下的车型、速度、路面和运行方式直接由当前配置刷新；手动声学粗糙度与三维预设不同步时如实标为手动。教学声学尺度、未标定实录及写实资产未配准的提示仍可见。

## 固定截图

| 视图 | 基线 | 改版后 |
| --- | --- | --- |
| 1440×900 首屏 | [before-desktop.png](a1-full-017-before-desktop.png) | [final-desktop.png](a1-full-017-final-desktop.png) |
| 390×844 首屏 | [before-mobile.png](a1-full-017-before-mobile.png) | [final-mobile.png](a1-full-017-final-mobile.png) |

补充：[窄屏固定控制抽屉](a1-full-017-final-controls.png)、[真实 Worker 回放的四座指标](a1-full-017-final-metrics.png)、[同次运行的三张分析图](a1-full-017-final-plots.png)。前图在开发页采集，后图由本批 `pnpm check` 的生产构建经本机 `vite preview` 采集；截图为视觉与操作证据，不代表实车或目标设备验收。

## 实际验证

- `pnpm check`：TypeScript、A/B 边界、145/145 全仓测试、生产构建通过。构建仍提示现有 viewer 大于 500 kB 的 chunk 建议，不是本批新失败。
- Chromium 生产页 1440×900 与 390×844 首屏加载；390px 时文档滚动宽度为 375px，无水平溢出。窄屏控制台打开后为固定可滚动抽屉，关闭后返回三维场景；桌面收起控制台后主舞台扩至单列。
- 在三维路面选择“粗糙沥青”后，声学粗糙度从 0.6 同步到 1.2，标题摘要随之更新。改为 20 秒预计算回放并运行实际 Worker，基线保存按钮可用；点击播放后，四座指标与时域/频谱/收敛图出现真实数值。移动端引导可展开，阶段按钮与教学布局说明仍可见。
- 页面脚本错误 0；生产预览的控制台仅有缺失 `favicon.ico` 的 404。截图显示的数值来自本次真实计算，没有新增占位性能或降噪统计。

尚未验证目标核显、实物音画、第二台 Windows 断网和写实车型同车声学配准；这些仍按完整目标独立验收。
