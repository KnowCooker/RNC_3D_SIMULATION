# Worker 回复的运行身份必填

2026-09-29；Role: A1；Task: A1-FULL-013；Identity-Source: user-declared；执行者 Codex 代 A1。代码、测试、证据与交接记录在同一提交中固定；前一提交为 `e274c36`。

正式 `lab.worker` 的结果、实时回执、数据包、RNC 开关回执和场帧本来均带 `runId`，但 integration 接收端曾允许该字段缺失，只拒绝显式的错误 ID。本批将缺失也视为实验身份错误并终止当前 Worker，防止没有实验归属的结果进入图表、试听或声场。B 计算、A2 viewer、shared 契约和冻结 fixture 未改。

伪 Worker 测试分别验证缺少外层运行 ID 的预计算结果与声场回复均被拒绝；正常回复保持可用。`pnpm check` 的类型、A/B 边界、全仓测试和生产构建通过。生产 Chromium [脚本](verify.playwright-cli.js)在默认 BEV 教学布局下完成 10 秒预计算、实时 RNC ON→OFF→ON 与 2.43 秒声场，页面脚本错误 0；[原始摘要与构建文件哈希](result.json)、[实时截图](live.png)。这证明正常 Worker 协议未被误挡，不覆盖目标核显、实物试听或长稳。

共管接口仍由 B1 复核 PR #38 后合并；新写实布局的 A2 安装锚点与 B 路径/场计算没有因此完成。
