# 当前组合版 Windows 离线候选与同机隔离启动

日期：2026-09-24。运行源码/打包源提交为 `abf1d2eac6e24f30fa4834773492194a08d5af82`，包含 A2 #20、A1暂停态移动场与A1试听预取改进。该提交执行 `pnpm check`，类型/源码边界/67项测试/生产构建通过；[原始工程输出](pnpm-check.txt)。其后只增加本证据和文档，没有修改运行源码。候选不是最终交付。

## 包身份与逐文件完整性

- [可直接下载的候选 ZIP](rnc-lab-abf1d2eac6e2.zip)：3,366,910 字节，SHA-256 `85233a6412da65777f85b24ad36bc1b92f7779c70166a8c7817b518abc91a6ce`。
- [包内清单](rnc-lab-abf1d2eac6e2.zip)的 `candidate-manifest.json` SHA-256 `be95587a23e7aa4eb32d7c7282750248aa5ded4245d899457b1f726913d69e81`；27个构建文件的清单摘要 `0d905b531b36fb03f7fc70fca47fa4e4952a40b658b455c969404fa6a550c99b`。
- [校验脚本](verify-package.ps1)重新计算当前 `dist`、候选目录及 ZIP 内每个文件的 SHA-256，31/31个包文件与31/31个ZIP条目一致，27/27个构建文件与包内一致；[原始结果](integrity-results.json)。脚本拒绝缺失、额外及重复的 ZIP 文件。打包入口是根目录 `scripts/package-offline.mjs`；[打包输出](package-result.json)。
- 包含 `dist`、Node内置静态服务、Windows启动脚本、中文使用说明和文件清单。运行时无需 `node_modules`、CDN、在线模型或AI API；预装 Node.js ≥22.12及支持 WebGL/Web Audio 的 Chromium 浏览器。HTTP服务仍是必需，不能双击 `index.html`。

## 从包内实际启动

将上述 ZIP 完整解压，设置 `PORT=5188` 并在候选目录运行其自带 `node scripts/serve.mjs`，浏览器访问 `http://127.0.0.1:5188/`。同一台 Windows 上使用独立 Playwright CLI 浏览器，每轮新建非持久上下文、独立缓存/存储，并在导航前拦截所有非回环地址的请求；Service Worker 被禁用。完成三轮后关闭专属浏览器和包内静态服务。

| 轮次 | 四车型真实批算及场 | 真实 lab Worker | 持续运行与暂停 | 检查 / 应用外网请求 / 页面异常 |
| --- | --- | ---: | --- | --- |
| 1 | ICE/BEV/HEV/EREV 均通过 | 6 | 2.22秒后暂停 | 15/15 · 0 · 0 |
| 2 | ICE/BEV/HEV/EREV 均通过 | 6 | 2.22秒后暂停 | 15/15 · 0 · 0 |
| 3 | ICE/BEV/HEV/EREV 均通过 | 6 | 2.22秒后暂停 | 15/15 · 0 · 0 |

每轮主动请求一次 `offline-isolation.invalid` 验证拦截器有效，三轮各阻断该探针一次；应用自身没有发出非回环资源请求。四车型各自返回真实末段指标、图表及16秒空间场，再切实时模式生成新样本并暂停；未替换B计算引擎。全部 **45/45** 条页面断言通过。脚本、每个请求/Worker/车型的[原始结果](browser-results.json)及[首轮完整页截图](offline-first-context.png)保留。环境见[记录](environment.json)：Windows、Node 24.13.1、Chromium 153、1500×1050无头视口；非目标核显。

另外从**已经提交的ZIP**解压到全新临时目录，完全使用解压出的 `scripts/serve.mjs` 和 `dist` 再运行相同脚本。三次新的浏览器上下文仍为45/45通过，三轮应用外网请求均为0；独立[原始结果](zip-browser-results.json)保留。这证明下载的ZIP可在本机解压后启动，不增加第二台Windows真实断网的结论。

这只是**同机浏览器请求隔离**。没有关闭操作系统网络，也没有使用第二台 Windows；三次新浏览器上下文不是三次真实机器重启。无头流程不能证明扬声器听感、爆音或≤100毫秒物理音画延迟。A2视觉仍未达到参照精细度；本候选不能冒充最终包。后续A2源码或A1运行源码变化必须重新构建和验收。

## 复核

仓库提交包含候选 ZIP 与原始证据。新克隆先安装锁定依赖并执行 `pnpm check`；解压 ZIP 到仓库的 `release/`，使 `release/rnc-lab-abf1d2eac6e2/` 存在，同时复制该 ZIP 为 `release/rnc-lab-abf1d2eac6e2.zip`。然后运行：

```powershell
& './docs/evidence/A1/A1-FULL-008/offline/verify-package.ps1'
$env:PORT = '5188'
Set-Location 'release/rnc-lab-abf1d2eac6e2'
node scripts/serve.mjs
```

在另一终端用预先安装的 Playwright CLI 会话执行本目录的[隔离脚本](offline-check.js)。QA工具不是包的运行依赖；在真实断网机器上不能通过 `npx` 临时下载工具来声称离线。ZIP 总哈希用于核对本页原包；重新运行打包脚本会写入新时间戳，应逐文件比较清单并记录新ZIP哈希。

首次临时完整性命令将 `dist/` 前缀拼成 `dist/dist/`，在当前构建文件比对时中止，未发现包内容不一致；固化的 `verify-package.ps1` 修正路径后重新执行全部目录、ZIP和构建比对并通过。原包与运行源码没有因此修改。
