# A 组：展示与试听

入口 app/index.ts 接收 AppPorts，不需要知道 B 组内部实现。`pnpm dev:a` 锁定参考回放，`pnpm dev` 联调真实计算。

A1 维护 app/charts/player，A2 维护 viewer。当前车型由 Three.js 基础几何生成，无远程模型。信号单位来自共享契约，误差点颜色采用固定 30–80 dB 合成 SPL 标度。

按根目录开发记录推进硬件标记遮挡优化、音频端到端人工检查、20 分钟稳定性及核显测试。播放器重采样自动验证位于 tests/player.test.ts。
