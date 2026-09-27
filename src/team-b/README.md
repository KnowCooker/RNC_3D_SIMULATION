# B 组：计算与分析

先读 [B1/B2任务与串行交接](../../docs/coordination/B.md)（仓库路径 `docs/coordination/B.md`）。开始调试前必须确认本次用户身份；用户未主动说明 B1/B2 就先问，本地角色配置不能代替。

B1 负责算法、数值对照、异常和性能；B2 负责合成源/路径核对、分析、导出与数据交付。两人不同时工作，继续共用现有源码和测试；按任务交接，不增加人员专属目录。调试记录、根开发记录和提交说明都要注明实际角色与任务编号。

## 当前 lab-v3 与冻结 demo-v2

日常 `pnpm dev` 使用 `lab/` 的四车型、参数化工况、动态参考拓扑及持续计算；当前源与路径见 [lab-v3模型说明](../../docs/research/LAB_V3_SIGNAL_PATH_MODEL.md)。其源采用实录归一化谱形合成新样本，默认立即学习，不能套用下面demo-v2的固定带通、2秒等待或固定时长说明。原始录音单位V且未校准；教学m/s²、Pa及60dBA锚点不是实车标定。

以下固定参数仅属于demo-v2历史回归（`pnpm dev:a`参考回放）。`engine/core.ts` 的 calculateSync 是纯计算内核；`analysis/index.ts` 提供 RMS / Welch PSD / 稳态功率降噪。`pnpm test:b` 覆盖两版，无浏览器执行，装好依赖后无需 Python。

内核按照 fixtures/reference/reference_mimo.py 移植；integration 的 Worker 适配为 Promise calculate(config, runId)，B 组不管理页面或声音。

配置仅允许共享契约内值。x 单位 m/s²，u 无量纲，d/a/e 单位 Pa。初级路径 4×4×24，次级路径 4×4×16，16 组控制器各 32 或 64 taps，S_hat=S。

测试包含默认 640,000 样本对照、五配置指标、零步长、确定性、交叉路径脉冲、非法参数与 PSD 积分归一。新实验输出到 test-results/，不能覆盖参考。

## demo-v2 合成激励与复现

- 2000 Hz、32000样本，时间为`n/2000`，索引0～31999，最后一个样本15.9995秒；片段终点为16秒。固定60km/h/沥青只是工况标签，不含车速外推或道路空间相关模型。
- 四路轮端激励与参考x采用单位比例的教学映射，顺序FL/FR/RL/RR。Xorshift32使用`seed + 101*k`，支持seed 11/29/47。不同通道使用不同伪随机序列，不表示已验证真实四轮统计独立。
- 均匀噪声通过65系数、Hamming窗的40～350Hz带通FIR，按`sum(h²)/3`归一化至理论单位RMS；有限片段含起始瞬态，实际RMS不强制等于1。有限FIR存在过渡带及带外泄漏，40～350Hz不是砖墙带限，也不是分析指标的积分频带。
- `P[m][k]`为参考加速度到误差点声压，量纲Pa/(m/s²)；`S[m][l]`为无量纲扬声器drive到声压，量纲Pa/drive。两者均为合成系数，16条路径均非零，包含12条交叉路径。P长24、主/交叉首延时12/14～16采样；S长16、主/交叉首延时4/5～7采样。
- `d_m = Σ P_mk*x_k + v_m`；独立扰动`v_m = 0.001*sqrt(3)*uniform(seed+5001+101*m)`具有理论0.001Pa RMS，不能把d解释为纯P*x。`a=ΣS*u`、`e=d+a`；d/a/e均为Pa，u不是耳旁声压。
- `core.ts`直接用同一secondary矩阵生成filtered-x及实际反噪声，即理想`S_hat=S`，没有独立次级辨识或失配模型。控制器16组W，当前误差更新下一样本权重，前2秒关闭学习。完整数值/时序验收仍由B1队列追踪。

[B2-001复现与证据](../../docs/evidence/B/B2-001/README.md)包含只读Python生成脚本、三种子x/d全样本校验摘要、全部路径非零tap及整形频响/带内比例。使用`pnpm exec tsx --test tests/engine.test.ts`核对；默认回归只读取证据，不运行Python或改写fixture。
