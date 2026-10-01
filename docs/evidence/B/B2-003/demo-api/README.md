# B2-003 demo-v2 导出与复算实现

2026-10-01；Role: B2；Identity-Source: user-declared；执行者 Codex。用户授权可继续时继续；接班基线原仓库 main `67387f68c6a6c1d9ad0826794f61ebde74aa649c`。B1 最新 #50 交接明确结束写入，开放 PR 只有 A2 #30；从 main 建立 `b/b2-003-export-api`，认领 `fd6404c` 已推送并建立[草稿 PR #51](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/51)，复查无重复 B 任务后修改功能。

设计 #44 已合并 `83ee77a`，B1-001 的完整五工况 #48 已合并 `fa805e2`，B1-002/003 #50 已合并 `67387f6`。此前“无非默认逐样本证据”是历史状态；本批核对新增证据后解除 **demo-v2** 数值依赖。B1 的 lab 布局接口审查及 A1/Worker 接入仍独立待办，不把设计合并解释为全部接口批准。

## 实现与验证范围

新增 `src/team-b/export/` 的 `encodeResult`、`decodeResult`、`estimateExport`、`encodeRecipe`、`decodeRecipe`、`recomputeRecipe` 及模型身份清单；新增 B 测试帮助文件，挂入既有 analysis 测试入口，`pnpm test:b`/全仓均自动执行。B 说明、证据和两份共同记录同批提交。运行算法、A 组、shared/integration、根配置和冻结 fixture 不变。

| 验证 | 实际结果 |
| --- | --- |
| 默认、seed29、seed47、32 taps、μ0 | 每工况 640000 值；五工况分别累计 3200000 个值，结果往返与复算均逐位一致，编码输入未改，解码数组独立 |
| 独立数值 | 复算值逐路对已合并 B1 Python oracle；相对 RMS/近零最大绝对值及每点/合功率指标沿用 B1 容差，逐通道哈希和最大误差见 [audit.json](audit.json) |
| 数值边界 | 负零/次正规数/Float32 极值、NaN/±Infinity 原指标标签、静音与低功率不可用、真实 0 dB/负改善、reference-replay 身份通过 |
| 严格读取 | 头部/截断/溢出长度/尾随/零填充/UTF-8/维度/通道顺序与单位/指标错配/哈希错/哈希正确的坏样本/大小预算/配方额外字段拒绝通过 |
| 版本与模式 | 未知模型结果只读且无已验证指标；未知模型/错误配置/旧 runId 不能复算；lab、实时快照和非零起点拒绝通过 |
| 专项首次运行 | 28/28（16 项新增导出 + 12 项分析），见 [export-test-first.txt](export-test-first.txt)；首次类型检查暴露两个类型问题，修复后通过，并非先前日志已通过 |
| B 组 | 85/85，通过日志 [test-b.txt](test-b.txt)；此日志在后续补充审计断言前生成，最终断言执行以全仓日志及 audit 为准 |
| 全仓 | 175/175，类型、目录边界与生产构建全部通过，见 [check.txt](check.txt)；保留既有 viewer 大块提示 |
| 冻结文件 | 8 个文件哈希未变，见 audit 的 frozenFixtures；没有生成或覆盖既有参考 |

结果载荷固定 2560000 字节，manifest 通常约 4.2 KiB；具体文件大小随运行 ID/耗时等元信息变化，audit 记录当次精确值。配方约 1.3 KiB，不含信号或脚本。原信号加文件的约 5.1 MB 是内存下界，未测浏览器峰值、目标设备或第二机，不宣称这些验收通过。

## 复现与版本

在仓库根运行（Node ≥22.12、pnpm 11.19.0；已有 B1 压缩 oracle，日常无需 Python）：

```text
pnpm exec tsx --test tests/analysis.test.ts
pnpm test:b
pnpm check
pnpm exec tsx docs/evidence/B/B2-003/demo-api/run-audit.ts test-results/B2-003-new-audit.json
```

审计脚本只允许新文件位于 `test-results/`，拒绝覆盖已有输出；需要先存在该目录。保存源码哈希采用 UTF-8/LF；提交 SHA 以 PR 最新 head/交接为准，审计固定验证文件身份，避免在日志中自引用未生成的提交 SHA。原始 stdout 不代替验收说明。

API用法及行为见 [模块说明](../../../../../src/team-b/export/README.md)。本批是 B2-003 **demo-v2 API 阶段**完成，不标完整任务或产品完成：lab-v3 两种源、布局/素材身份、动态参考、发散前缀、实时状态协议、A1 文件 UI、浏览器 Worker/取消/峰值内存、目标核显/实物试听/第二台 Windows 尚未验收。A1 当前摘要格式保持独立；同步 SHA-256 适配或异步导出/Worker 接入须另行协调。本批完成后停止写入，下一位先核对 PR 版本及合并状态；不自动合并。
