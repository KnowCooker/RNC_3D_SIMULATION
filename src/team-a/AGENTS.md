# A 组边界

- A1：app / charts / player；A2：viewer。
- 通过 AppPorts / DemoEngine 使用接口，不导入 team-b 或 integration。
- 图表只绘制 B 组分析结果，不另写 SPL、RMS、降噪公式。
- `pnpm dev:a` 在不运行 FxLMS 核心时用冻结参考数据工作。
- 所有视图使用播放器 currentTime；爆炸不改变计算坐标或声学路径。
- 必须显示数据来源和预计算回放；播放 d/e 共用增益与时间。
- 每批改动同步根目录开发记录，执行对应检查；UI 改动截图或人工复现。
