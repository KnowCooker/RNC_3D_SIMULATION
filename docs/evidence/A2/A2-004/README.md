# A2-004：本机性能测量与目标设备边界

2026-09-23，本机Windows 11 10.0.26200、i7-12800HX（16核24线程），GPU为NVIDIA RTX 4070 Laptop。硬件枚举见[hardware.json](hardware.json)，浏览器实际WebGL渲染器也确认ANGLE/NVIDIA/D3D11，没有把主机GPU猜作实际渲染设备。

测试使用HeadlessChrome 153、1920×1080视口，测试侧将viewer容器设为1280×720，实际drawing buffer=1280×720、devicePixelRatio=1。参考回放默认及展开各测约15秒，包含原12硬件与4个SOURCE标签。脚本按真实requestAnimationFrame时间统计，不读取界面瞬时fps作为结果。

| 场景 | UTC时段 | 帧数/时长 | 平均FPS | 95%帧间隔 | 最大绘制三角数 |
| --- | --- | --- | --- | --- | --- |
| 默认 | 14:05:44～14:05:59 | 2475 / 15.002s | 164.98 | 6.2ms | 5086 |
| 展开 | 14:05:59～14:06:14 | 2473 / 15.006s | 164.80 | 6.2ms | 5086 |

合计平均164.89fps，低于5万三角面的目标。依据本机结果没有引入无必要的性能重构。原始结果与环境见[browser-result.json](browser-result.json)，复现脚本为`browser-performance.js`；先正常打开参考回放并snapshot，再通过Playwright CLI run-code执行。

**这是独显本机测量，尚不能判定目标核显验收通过。** 当前系统枚举没有可测的指定核显目标设备；没有强制切换系统显卡或以软件渲染冒充核显。待目标电脑可用时用同脚本和相同尺寸测量平均≥30fps。实际音画≤100ms、第二台Windows离线与20分钟稳定性不由本报告替代。
