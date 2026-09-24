# B 组：计算与分析

先读 [B1/B2任务与串行交接](../../docs/coordination/B.md)（仓库路径 `docs/coordination/B.md`）。开始调试前必须确认本次用户身份；用户未主动说明 B1/B2 就先问，本地角色配置不能代替。

B1 负责算法、数值对照、异常和性能；B2 负责合成源/路径核对、分析、导出与数据交付。两人不同时工作，继续共用现有源码和测试；按任务交接，不增加人员专属目录。调试记录、根开发记录和提交说明都要注明实际角色与任务编号。

engine/core.ts 的 calculateSync 是纯计算内核；analysis/index.ts 提供 RMS / Welch PSD / 稳态功率降噪。`pnpm test:b` 无浏览器执行，装好依赖后无需 Python。

内核按照 fixtures/reference/reference_mimo.py 移植；integration 的 Worker 适配为 Promise calculate(config, runId)，B 组不管理页面或声音。

配置仅允许共享契约内值。x 单位 m/s²，u 无量纲，d/a/e 单位 Pa。初级路径 4×4×24，次级路径 4×4×16，16 组控制器各 32 或 64 taps，S_hat=S。

测试包含默认 640,000 样本对照、五配置指标、零步长、确定性、交叉路径脉冲、非法参数与 PSD 积分归一。新实验输出到 test-results/，不能覆盖参考。
