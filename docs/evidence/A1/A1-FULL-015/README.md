# A1-FULL-015：离线包源码与构建身份闭环

Role: A1；Identity-Source: user-declared；执行者 Codex 代 A1。对应[草稿 PR #40](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/40)。本任务处理的是发布链路的**版本真实性**，不声称四车型同资产声学或正式设备验收完成。

## 已复核的第一候选 `c3c2523`

从干净提交 `c3c2523557672be27c5a43cfceae6c4c37079bdc` 运行 `node scripts/package-offline.mjs`，命令自行执行 `pnpm check`（类型、边界、全仓测试、生产构建），随后生成 `release/rnc-lab-c3c252355767/`。38 个 dist 文件及全部 43 个包文件由[候选清单](candidate-manifest-c3.json)逐项标识；dist 摘要 `47d026df8fd8f14c32e90df030c4bd48fa895c942913f8345a9f1d30108ca165`，清单 SHA-256 `7a9d88dc63e4b7163dee0e80f2b2f0ceda16b6f3c5fa4120643aa3416dd81f6a`。包内 `node scripts/verify-package.mjs` 核验 43 个文件通过，实际运行 `启动演示.cmd` 先打印相同源码/产物身份，再在 `127.0.0.1:5189` 启动包内服务。

[浏览器脚本](qa-offline.js)从包内服务在一份全新 Chromium 上下文中运行四类教学车各 10 s 正式 Worker 实验和末尾残余声场查询；[原始结果](browser-result.json)记录 4 个 Worker、四车计算及场成功、页面异常 0、外网资源请求 0；[整页截图](offline-four-cars.png)对应最后的增程车。测试在导航前拦截并拒绝非回环请求，证明此流程没有运行时外网资源依赖。它不是物理断网或第二台 Windows 验收。

专项测试对真实包校验逻辑构造独立临时包：原包通过、改文件/增文件/缺文件均拒绝；带未提交源码运行打包命令按预期拒绝。第一候选打包时 Node 对固定的 `shell: true` 子进程发出弃用提示；后续源码已改为明确 `cmd.exe` 调用，并补检查构建前后 HEAD 一致。**第一候选只证明 `c3c2523`；最新源码须另从干净提交重新打包和验证。**

尚待：最新源码候选的同版复验、第二台 Windows 真断网、目标核显、实物音画、与 A2/B 最终四车布局集成后的正式包。
