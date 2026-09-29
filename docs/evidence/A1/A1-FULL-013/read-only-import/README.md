# A1-FULL-013 / 未接入布局案例只读导入

2026-09-29；Role: A1；Identity-Source: user-declared；执行者：Codex 代 A1。基于原仓库 PR #38 的 `d8f2b5268537f443ccba53394ee3bb397372ade1` 增量修改 A1 案例导入与评审页面；本目录脚本及截图对应同批源码，不代表后续写实布局已可计算。

问题：旧版会直接拒绝包含未知 `layoutId` 的 `rnc-case-v1` 文件，导致未来他人分享的案例连原始记录也无法查看。本批允许格式合法、长度受限的陌生布局身份进入**只读**评审；它仍是未经签名的文件自报数据，不能复算、与教学布局比较，甚至两个相同陌生布局也不输出 A/B 数值差值。格式错误的布局身份仍拒绝。旧文件未带身份时仍按 `teaching-fixed-v1` 解释；正式实验、Worker 和路径分析仍只运行已实现的教学布局。

验证：`pnpm check` 类型、边界、135/135 全仓测试和生产构建通过。Windows 上使用 `PORT=5187` 的生产构建与 Playwright CLI Chromium：先运行 BEV 10 秒预计算并显示残余声场，再上传既有[未知布局样例](../import-boundary/unknown-layout-case.json)；页面显示“只读导入/文件自报”，四个 B−A 均为 `—`，当前实验 ID 与 10 秒场状态不变。[截图](foreign-layout-readonly.png)。继续导入[旧缺省布局案例](../../A1-FULL-012/example-review.json)，四个 B−A 仍为 `+3.0 dB` 且当前实验/场不变。[截图](legacy-layout-still-comparable.png)。[复现脚本](qa-foreign-readonly.js)及[原始输出](qa-foreign-readonly-production.log)记录 0 页面脚本异常、0 请求失败。已有大 chunk 构建提示保留；本批不涉及目标核显、真实音频或第二机离线验收。

边界：浏览器只检验导入后的显示与现有实验隔离。文件的座位声压、来源、人工结论均未被签名或原始信号验证，不能用此流程判定实车声学效果。待 A2 提供同车可核实安装点、B 组按新布局重算 H/S/场并在数值入口校验后，才能定义新布局的可计算和可比较条件。
