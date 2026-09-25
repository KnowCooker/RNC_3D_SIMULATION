# B 组边界

- 先确认本次用户身份：已明确 B1/B2 就采用；未说明或只说“B组”必须先提问，收到回答再开始调试/修改/提交。本地 rnc.role、Git账号或旧日志不能代替确认。
- B1 主责 FxLMS、数值正确性、异常和性能；B2 主责合成源/路径说明、指标分析、导出及结果交付。具体任务、状态和验收见 `docs/coordination/B.md`。
- B1/B2 不同时工作，共用整套 `src/team-b/**`、B组测试、日志和同一交接页；engine/analysis 是功能模块，不是两人独占范围。不增加 B1/B2 目录或按人拆分测试文件。
- 接班前确认上一位已停止并保存/提交工作，记录接手版本和遗留项；一人执行期间另一人不写。交接不等于把所有任务重新分配给接班人；跨主责任务说明原因与原负责人。
- 纯 TypeScript，不导入 Three.js、DOM、A 组或 integration；Worker 属于适配层。
- W[output][reference][tap]、S[error][output][tap]、P[error][source][tap]。
- e=d+a，负梯度更新；当前误差更新的 W 只用于下一样本。
- 内部 Float64，出口按契约 Float32；不随意限幅 u。
- 执行 `pnpm test:b`，保留原始数值基准；每批改动同步根目录开发记录。
- 每批还需同步 B.md；每份新增调试/验证记录含角色、执行者、任务 ID、日期、版本、命令、结果及下一步。提交说明写 `Role: B1/B2`（实际二选一）、`Task: <任务ID>`、`Identity-Source: user-declared`，PR注明同样信息。
