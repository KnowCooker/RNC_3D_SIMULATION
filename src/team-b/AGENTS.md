# B 组边界

- B1 维护 engine；B2 维护 analysis 与对应测试。
- 纯 TypeScript，不导入 Three.js、DOM、A 组或 integration；Worker 属于适配层。
- W[output][reference][tap]、S[error][output][tap]、P[error][source][tap]。
- e=d+a，负梯度更新；当前误差更新的 W 只用于下一样本。
- 内部 Float64，出口按契约 Float32；不随意限幅 u。
- 执行 `pnpm test:b`，保留原始数值基准；每批改动同步根目录开发记录。
