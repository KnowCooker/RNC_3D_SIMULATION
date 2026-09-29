# A1-FULL-015：离线包源码与构建身份闭环

Role: A1；Identity-Source: user-declared；执行者 Codex 代 A1。对应[草稿 PR #40](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/40)。本任务处理的是发布链路的**版本真实性**，不声称四车型同资产声学或正式设备验收完成。

## 最新同版候选 `9b5e16e`

从干净提交 `9b5e16e675ffa77b234cb5c075103b865144ee97` 运行 `node scripts/package-offline.mjs`：命令内 `pnpm check` 类型、边界、全仓测试、生产构建均成功；打包前后源码干净且 HEAD 不变，未再出现 `shell: true` 的 Node 弃用提示。候选目录 `release/rnc-lab-9b5e16e675ff/` 含 38 个 dist 文件和 43 个包文件，dist 摘要 `47d026df8fd8f14c32e90df030c4bd48fa895c942913f8345a9f1d30108ca165`。[完整清单](candidate-manifest-9b.json) SHA-256 `cb1ef6bb4b86c5b4987836e777cf76a4d85831b3f6c948437412ee87191d9fe2`。包内校验命令和实际 Windows `启动演示.cmd` 均先返回相同源码/产物身份，再从包内在 `127.0.0.1:5190` 启动服务。

[最终浏览器脚本](qa-offline.js)在导航前阻断非回环网络，使用全新 Chromium 上下文从**包内服务**运行 ICE/BEV/HEV/EREV 各 10 s 正式 Worker 实验、四座指标及末尾残余声场。[最终原始结果](browser-result.json)记录四个打包 Worker、四车成功、页面脚本错误 0、应用外网资源请求 0；[整页截图](offline-four-cars.png)显示最后的增程车。未点击研究来源外链；“应用无外网资源请求”不表示整个 Windows 已物理断网。

使用 Windows `Compress-Archive` 将上述候选目录制成 `release/rnc-lab-9b5e16e675ff.zip`，16,949,019 字节，SHA-256 `24135d01d2ec86b7eb9155ff3a2e302337de14120c925448de83d3c9fa5bb07a`。ZIP 有 43 个文件条目；另行解压到空目录后再次运行包内 `verify-package.mjs`，43/43 文件与同一源码/产物摘要匹配。ZIP 是本机候选产物，未上传为正式发布附件；后续若从源码重新压缩，ZIP 元数据可变，应以该次新哈希和包内逐文件清单核对。

## 已复核的第一候选 `c3c2523`

从干净提交 `c3c2523557672be27c5a43cfceae6c4c37079bdc` 运行 `node scripts/package-offline.mjs`，命令自行执行 `pnpm check`（类型、边界、全仓测试、生产构建），随后生成 `release/rnc-lab-c3c252355767/`。38 个 dist 文件及全部 43 个包文件由[候选清单](candidate-manifest-c3.json)逐项标识；dist 摘要 `47d026df8fd8f14c32e90df030c4bd48fa895c942913f8345a9f1d30108ca165`，清单 SHA-256 `7a9d88dc63e4b7163dee0e80f2b2f0ceda16b6f3c5fa4120643aa3416dd81f6a`。包内 `node scripts/verify-package.mjs` 核验 43 个文件通过，实际运行 `启动演示.cmd` 先打印相同源码/产物身份，再在 `127.0.0.1:5189` 启动包内服务。

第一候选也曾从包内服务在一份全新 Chromium 上下文中运行四类教学车各 10 s 正式 Worker 实验和末尾残余声场查询，4 个 Worker、页面异常与应用外网请求均为 0；本页保留其清单，浏览器脚本和最终原始结果以上述最新候选为准。

专项测试对真实包校验逻辑构造独立临时包：原包通过、改文件/增文件/缺文件均拒绝；带未提交源码运行打包命令按预期拒绝。第一候选打包时 Node 对固定的 `shell: true` 子进程发出弃用提示；最新候选已经使用明确 `cmd.exe` 调用并补检查构建前后 HEAD 一致。第一候选只证明 `c3c2523`，最终浏览器/归档证据以 `9b5e16e` 为准。

尚待：第二台 Windows 真断网、目标核显、实物音画、与 A2/B 最终四车布局集成后的正式包及对应版本的重验。
