# B1 共享接口审查包：A1-FULL-013

Role: A1；Identity-Source: user-declared；执行者 Codex 代 A1。对应原仓库 [PR #38](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/38)，最新运行源码 `faa6b0c42c05db9889e261a22659e64b7e74e046`，基线 main `cb3d84316a4b9906d490f17d684de006c51532c1`。此页是供 B1 审查的具体接口与决策清单，不代表 B1 已批准，也不启用写实车布局。

## 本 PR 实际改变的 A/B 边界

| 文件 | 对 B 组/后续布局的含义 | 已有防护 |
| --- | --- | --- |
| `src/shared/lab-contracts.ts` | `LabConfig.layoutId?`；旧配置缺省解释为 `teaching-fixed-v1`。`FieldFrame.layoutId?` 暂时可选，以兼容 B 纯函数既有返回；正式 Worker 必填。 | `supportedLabLayoutId` 目前只允许教学布局，未知 ID 明确拒绝。 |
| `src/integration/lab.worker.ts` | 预计算/实时启动在调用 B 前规范化并校验布局；实时 `ready` 新增完整 `config`；场帧标记布局。 | 所有发往主线程的回复包含 `runId`，错误也回传请求的运行 ID。 |
| `src/integration/lab-engine.ts` | 启动配置快照与 Worker 结果/实时回执/每包快照进行完整配置比对；实时 RNC 开关是唯一允许的动态字段变化。 | 缺失或错配 `runId`、布局或配置会拒绝该实验；错配单次场帧只拒查询。开关回执必须与请求一致才更新期望配置。 |
| `src/integration/main.ts` | 直接查看 H/S/Ŝ 时仍调用 B 的 `analyzeLabPath`。 | 装配层先用同一布局门禁拦截未知 ID。 |
| `src/team-a/lab/**` | 案例保存/导入带布局；旧 `rnc-case-v1` 缺省归教学布局。 | 未注册布局案例只读展示文件自报数据，不复算或产生 A/B 数值差值；运行中实验不被导入替换。 |

## 请 B1 明确审查的决定

1. **过渡期门禁是否可以合并**：正式页面/Worker 已拒绝未知布局，但 B 纯函数公开入口仍接受未知 `layoutId`。固定源码 [直连诊断](direct-engine-gap/README.md)证明仅换 ID 时批量、流式、H 与同点场沿用教学几何，信号逐样本相同。请判断此 PR 可否作为明确标记的过渡门禁合并，还是必须先由 B 组在 `validateLabConfig`、路径分析及场入口拒未知布局。无论审查结论如何，**不能仅放宽 Worker 白名单来启用写实车**。
2. **将来新布局的单一数据源**：A2 [#30 布局交接](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/30)要求 `layoutId`、资产哈希/尺度/坐标轴、四轮源、四 MIC、四门输出、默认参考及安装部件 ID。B 必须在批量、流式、H/S/Ŝ 和任意点场从同一版本布局取坐标，保持 16 条 S 与全部交叉影响；同点同窗场值需与 MIC 信号一致。请确认 B 数值入口将以布局身份索引该数据，而不是按 `vehicle` 名称继续读全局固定坐标。
3. **兼容字段语义**：请核对旧配置缺省 `layoutId` 归教学布局是否符合 B 的回归口径；`FieldFrame.layoutId` 在共享类型中可选、正式 Worker 必填，是否足以保护已有 B 纯函数调用；实时 `setRncEnabled` 在 B 快照中更新 `config.rncEnabled`，A1 仅在开关回执匹配后更新期望配置，这一时序是否稳定。
4. **阻止错误完成声明**：A2 当前 ICE 资产是 4.8 m 归一化美术模型，只有前门分组，后门和四门扬声器缺少已核实实体/安装点；头枕包围盒中心不是 MIC 安装点。B 不应把现有 `MIC_POSITIONS` / `SPEAKER_POSITIONS` / `SOURCE_POSITIONS` 重命名成写实布局。A2、B、A1 必须分别完成锚点、路径/场重算、页面联调后才开放新身份。

## 复核入口与当前证据边界

- `pnpm check` 对 PR #38 最新运行源码已在本机及原仓库 CI 通过；[生产浏览器配置与 RNC 切换](config-identity/README.md)、[运行 ID 必填](run-identity/README.md)、[旧/未知案例导入](read-only-import/README.md)给出脚本和原始结果。
- `pnpm exec tsx docs/evidence/A1/A1-FULL-013/direct-engine-gap/audit.ts` 复现 B 直连缺口；它是诊断，不改 B 源码。
- [A1 `c26cc3b` + A2 `d8e2717` 隔离组合](latest-a2-composition/README.md)的 142/142 测试及浏览器流程只证明旧教学声学布局的工程兼容；首次 ICE GLB 请求曾 `net::ERR_ABORTED`，重试成功，可靠性未签收。它不证明写实车声学已配准。
- 本 PR 不改 `src/team-b/**`、`src/team-a/viewer/**` 或旧 `demo-v2` fixture。目标核显、实物音画、第二台 Windows 断网及正式同版包仍待验。

审查后若同意过渡门禁，请在 PR #38 留下对上述四点的结论；若要求 B 入口先闭合，请将 B 的对应任务和验收条件写入 `docs/coordination/B.md`，A1 保持此 PR 不合并直至接口事实一致。本页不代替 B1 的实际审查。
