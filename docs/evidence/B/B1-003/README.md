# B1-003 参数边界、数值失败与恢复

2026-09-30；Role: B1；Identity-Source: local-config；执行者 Codex。
基线 `fa805e2da2ec16ce7e17a087b202ec3380a48ba2` 加 B1-002 本地验证。按用户指令在002专项完成后串行接续；当前仅本地，未提交/推送。范围为任务表的 demo-v2，不改变 lab-v3 实时发散前缀及播放语义。

## 复现问题与最小修复

原 `validateConfig` 只排除 null 和非object值；`Object.assign([], DEFAULT_CONFIG)` 能通过检查，因此数组可冒充配置对象。新的非法形状测试先失败：4项专项3通过、1失败，见 [before-fix.txt](before-fix.txt)。

仅在 `src/team-b/engine/core.ts` 加上 `Array.isArray(config)` 拒绝条件，返回既有 `EngineError` / `INVALID_CONFIG`、调用方 runId 和“配置必须是非数组对象”。不改正常配置、FxLMS公式、矩阵或数值容差，也不改 A组/shared/Worker。修复后专项4/4通过，见 [after-fix.txt](after-fix.txt)。

## 验证范围

| 项目 | 覆盖及判据 |
| --- | --- |
| 128组非法配置 | null/undefined/数组/原始值、附有合法属性的数组；每个必填键缺失、NaN/±Infinity、对象/数组/布尔值、错误固定值和数字字符串；额外非法tap/seed/μ。对validateConfig和calculateSync分别检验，共256次结构化错误核对，code/runId/message必须正确 |
| 12组合法配置 | 3种子 × 32/64系数 × μ0/0.08；每次20路Float32、每路32000点、全部有限、通道buffer不别名、配置快照独立、四点及总指标有限 |
| μ0恒等关系 | 全6组零步长配置逐点u=a=0、e=d；四点及总改善严格0 |
| 保留实际驱动幅度 | 正常算例存在绝对驱动大于1的样本，保持真实数值，不当成PCM满幅裁剪；全12配置检查e=d+a误差≤1e-5 |
| 7组数值异常 | 参考NaN、原声Infinity、次级路径NaN、最后样本NaN、Float64有限但Float32出口溢出、参考短数组及旧版驱动界限；均抛NUMERIC_FAILURE并携带当前runId，不返回部分成功结果 |
| 失败隔离与恢复 | 同一模块成功→故障→成功；失败不更改此前结果，下一次全信号和指标与前次正常结果严格一致；修改新结果不影响旧结果 |

完整配置、峰值、叠加误差、指标及实际错误消息见 [result.json](result.json)。数值异常通过 B1-002 的测试模块载入器注入数据，运行文件始终使用正常源/路径。这里确认的是B纯函数状态隔离，不代表已经验收A1取消按钮、旧结果展示或Worker并发状态。

demo-v2 旧参考实现保留原来的 `|u|>10` 数值失败边界，本任务只验证它；lab-v3 已按用户要求允许大幅有限信号计算至实际溢出，这次没有回退或更改该行为。

## 复现与结果

```text
pnpm exec tsx --test tests/helpers/engine-failure-tests.ts
pnpm exec tsx docs/evidence/B/B1-003/audit.ts
pnpm test:b
pnpm check
```

新增4项注册在既有engine测试入口。最终组合验证：`pnpm test:b` **69/69**、`pnpm check` **159/159**及类型/边界/生产构建全部通过，B1-001五算例逐样本对照重新通过。见[test-b.txt](test-b.txt)、[check.txt](check.txt)；源码及8个冻结文件哈希见[final-integrity.json](final-integrity.json)，冻结文件与B1-001完全一致，原有viewer大块提示保留。`git diff --check`与证据本地链接检查通过。下一项是B1-004目标设备性能/版本冻结；B2-003接口协调、lab-v3布局核对和设备/离线验收不在本批完成范围内。
