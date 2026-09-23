# A2-004：本机性能测量与目标设备边界

2026-09-23，本机Windows 11 10.0.26200、i7-12800HX（16核24线程），GPU为NVIDIA RTX 4070 Laptop。硬件枚举见[hardware.json](hardware.json)，浏览器实际WebGL渲染器也确认ANGLE/NVIDIA/D3D11，没有把主机GPU猜作实际渲染设备。

测试使用HeadlessChrome 153、1920×1080视口，测试侧将viewer容器设为1280×720，实际drawing buffer=1280×720、devicePixelRatio=1。参考回放默认及展开各测约15秒，包含原12硬件与4个SOURCE标签。脚本按真实requestAnimationFrame时间统计，不读取界面瞬时fps作为结果。

| 场景 | UTC时段 | 帧数/时长 | 平均FPS | 95%帧间隔 | 最大绘制三角数 |
| --- | --- | --- | --- | --- | --- |
| 默认 | 14:05:44～14:05:59 | 2475 / 15.002s | 164.98 | 6.2ms | 5086 |
| 展开 | 14:05:59～14:06:14 | 2473 / 15.006s | 164.80 | 6.2ms | 5086 |

合计平均164.89fps，低于5万三角面的目标。依据本机结果没有引入无必要的性能重构。原始结果与环境见[browser-result.json](browser-result.json)，复现脚本为`browser-performance.js`；先正常打开参考回放并snapshot，再通过Playwright CLI run-code执行。

**这是独显本机测量，尚不能判定目标核显验收通过。** 当前系统枚举没有可测的指定核显目标设备；没有强制切换系统显卡或以软件渲染冒充核显。待目标电脑可用时用同脚本和相同尺寸测量平均≥30fps。实际音画≤100ms、第二台Windows离线与20分钟稳定性不由本报告替代。

## 本机接续收尾复测（2026-09-23）

本次针对最终组合生产包838cdf3，运行新入口`run-performance.ps1`（Node24.13.1，Playwright CLI0.1.21，Chrome153）。默认与展开均实际测15秒，WebGL实际GPU仍为RTX4070。

| 测量 | 实际结果 | 判定 |
| --- | --- | --- |
| 第一次有窗口 | 实际1920×1080内部缓冲，约150.79fps | 不符合目标缓冲尺寸，入口拒绝；保留headed-before.json及summary |
| 第二次有窗口 | 修正1280×720后，默认20.60/展开1.00fps | 未通过；帧间隔出现约1秒，符合窗口节流特征，不能据此证明GPU吞吐；保留headed-throttled.json及summary |
| 最终无窗口 | 1920×1080视口、1280×720缓冲；默认146.25、展开148.32、合计147.28fps；最大5086三角 | 本机性能条件通过；不等于指定核显通过 |

[最终原始结果](local-final-result.json)、[判定摘要](local-final-summary.json)、[截图](local-final-expanded.png)。最终入口通过npx固定版本调用完成，未使用本机缓存绝对路径；测试脚本显式设置测试renderer像素比1，产品源码不变。前两次失败均保留，未覆盖旧164.89fps历史测量。

A2独立`pnpm check`再次通过20/20、类型/边界与构建；既有大chunk提示保留。完整组合22项与20分钟/离线证据见[接续手册](HANDOFF.md)。本轮没有重新执行已完成的20分钟长测。

另补齐[六章演示录像](a2-final-demo.webm)（6分20秒，实际操作章节共至少5分钟，工具等待保留），[清单与SHA256](demo-manifest.json)、[复现脚本说明](DEMO.md)。每章结束保留12硬件/4源点；抽帧核对结构/点位/播放画面。浏览器控制台仅观察到既有favicon.ico 404。录像没有声卡输出证据。
