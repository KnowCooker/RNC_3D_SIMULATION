# 最新 A1 #38 与 A2 #30 隔离组合

2026-09-29；Role: A1；Task: A1-FULL-013；Identity-Source: user-declared；执行者 Codex 代 A1。本目录是固定提交的本机组合验收，不把 A2 代码写入 A1 分支，也不表示任何 PR 已合并。

## 固定版本与实际结果

- A1 [PR #38](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/38) `c26cc3b437146bbccf810a314490b7b69ec753ac`，A2 [草稿 PR #30](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/30) `d8e27178ca634c75e17448a2bb98fd1f1a7f85f7`。在空闲隔离 QA 工作树从 A1 提交执行 `git merge --no-commit --no-ff`，无文本冲突，索引树 `69ae5b8407379c7900e0c87fbb8a2eb20bc6f8f7`，没有提交或推送组合分支。
- `pnpm check`：类型、A/B 边界、**142/142** 全仓测试及生产构建通过。构建 SHA-256、浏览器原始摘要见 [result.json](result.json)。现存 viewer >500 kB 提示未隐藏。
- 生产 Chromium [ICE 同资产流程脚本](qa-current.js)：写实车、座椅头枕拆出、车间透明剖面、道路回装、返回教学实验与 10 秒教学场。**第一次脚本判失败**：车可见且流程走通，但一项 Range Rover GLB 请求返回 `net::ERR_ABORTED`；同脚本重试无失败请求、页面异常 0。这个间歇问题与 A2 PR #30 的已知记录一致，未由本批修复。[车间截图](ice-workshop.png)、[返回教学场截图](ice-field.png)对应重试成功流程。
- [四车/实时脚本](qa-four-live.js)：ICE、BEV、HEV、EREV 各 10 秒预计算与教学声场均可见；BEV 实时继续至 5.2 秒，RNC ON→OFF→ON 后场更新至 4.89 秒，页面异常/失败请求均 0，[实时截图](bev-live.png)。这补足新 A1 完整配置身份校验与 A2 当前三维代码的同版兼容性证据。

结论只限所列本机流程。四车仍全部使用 `teaching-fixed-v1` 教学声学坐标；写实车界面明确不投影教学场。ICE 尚缺核实的四门扬声器和声学安装锚点，BEV/HEV/EREV 同车资产与结构也未达到终点。此处没有目标核显、真实音画、长稳或第二台 Windows 离线验收；GLB 间歇请求失败仍是 A2 需处理的可靠性问题。

复现：在独立干净工作树从上述 A1 提交检出，再以 `--no-commit --no-ff` 合入上述 A2 提交，执行 `pnpm install --frozen-lockfile` 和 `pnpm check`；设置 PowerShell 环境变量 `$env:PORT='5186'` 后运行 `pnpm start`。先创建 `output/playwright/`，使用 Playwright CLI 的 `run-code --filename` 运行两份脚本。脚本使用本次端口，复现时端口不同须同步调整。
