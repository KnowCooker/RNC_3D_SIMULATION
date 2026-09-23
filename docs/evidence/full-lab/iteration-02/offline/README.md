# lab-v3 离线候选与同机网络隔离启动

日期：2026-09-24（Asia/Shanghai）。本轮只复制冻结的生产 `dist`，**没有重新构建或修改应用源码**。候选不是最终交付；此证据不代表第二台 Windows 真实断网、目标核显、实物试听或长稳验收。

## 候选身份与完整性

- 冻结源码摘要：`c2e43d7994ac8941ca7f820546010e1d28a23dc3d2590d5cd90fecb9ca7f90f1`。
- 原始冻结清单：[integration/version.json](../integration/version.json)。基线 `79df17b` 仅是本轮起点，候选身份由冻结源码摘要和产物哈希确定，不冒称已有最终提交 SHA。
- 本机目录：`release/lab-v3-c2e43d7994ac/`；归档：`release/lab-v3-c2e43d7994ac.zip`，3,341,221 字节。
- ZIP SHA-256：`e9d9445e9dc1b44dba65a20f2a910c8076175cdc33d5dfc4995b7b35c62c66c2`。
- 包清单 SHA-256：`651c82a69cb417da26c1bb80e1f96a3d7c1dbcdd1b23e71a22aee00befd63383`。
- 26 个 dist 文件逐一匹配冻结清单；31 个包文件与 ZIP 条目逐一 SHA-256 校验，无遗漏。见[完整性结果](integrity-results.json)及[包清单](candidate-manifest.json)。

包包含原样 dist、`scripts/serve.mjs`、`启动演示.cmd`、简洁使用说明、冻结版本清单及包内容清单。Node.js **≥22.12.0 须预装**，不内置 Node 或安装器，不需启动时安装 npm/pnpm 依赖。完整解压后运行启动脚本，浏览器访问 `http://127.0.0.1:4173/`，不能双击 HTML 代替 HTTP 服务。源码/研究/完整证据继续由仓库提供。

## 本轮验证结果

在候选目录启动独立 `127.0.0.1:5182` 静态服务，使用专属 Playwright CLI 会话 `rnc-lab-offline`。3 次全新、非持久 Chromium 上下文共 **45/45 断言通过**；每次独立存储/缓存，禁用 Service Worker，在导航前设置请求拦截，仅允许回环地址。

| 启动轮次 | 四车型真实批算和 16 秒场 | 真实 Worker 创建数 | 持续模式启动后暂停 | 应用外网请求 / 页面错误 |
| --- | --- | --- | --- | --- |
| 1 | ICE、BEV、HEV、EREV 全通过 | 6 | 2.28 秒，暂停状态正确 | 0 / 0 |
| 2 | ICE、BEV、HEV、EREV 全通过 | 6 | 2.27 秒，暂停状态正确 | 0 / 0 |
| 3 | ICE、BEV、HEV、EREV 全通过 | 6 | 2.26 秒，暂停状态正确 | 0 / 0 |

每轮 Worker 数包含初始实验、四次车型重算和一次实时启动。各车型返回真实末段指标、时域/频域画布和截至 16.00 秒的空间场；持续模式使用打包的 `lab.worker-B8jbtwzQ.js`。测试没有替换引擎或注入结果。

各轮唯一被阻断的非回环请求均是测试主动发出的 `https://offline-isolation.invalid/rnc-controlled-block-probe`，用于证明确实已设置隔离。应用本身没有发出外网资源请求。外部研究资料超链接不属于离线资源，测试未点击这些链接。

这是**同一台 Windows 的浏览器请求隔离**，不是关闭网卡、操作系统全局网络隔离或第二台电脑验收；3 次 fresh context 也不等于 3 次重启 Windows。持续模式这里只验证启动及暂停，不能替代连续运行长稳证据。

环境：Windows 11 10.0.26200、Node 24.13.1、Chromium 153.0.8010.48、1500×1050 视口。[环境信息](environment.json)记录机器 CPU 和显示适配器，仅用于复现，不作为核显或 GPU 性能证据。

原始记录：[浏览器结果及请求明细](browser-results.json)、[首轮实际截图](offline-first-context.png)、[服务器与包信息](server-and-archive.json)、[清理结果](cleanup-results.json)。首个工具尝试遇到 Playwright `run-code` 沙箱不提供全局 `URL` 的工具侧错误，随后改为明确的回环地址正则并重开专属会话；保留[失败原文](first-attempt-tool-error.txt)。应用源码和冻结产物未因此改变。

## 复现入口

完整脚本保存在本目录，原始执行位置为 `output/playwright/offline-lab/`。从仓库根目录将本目录文件复制到该输出目录，保持该路径，便可使用相同脚本；不需要修改应用。

另一端从仓库重建时，先检出交接记录指定且与上述 sourceDigest 对应的冻结源码版本（不能只检出旧基线 `79df17b`），使用原版本 Node 24.13.1 / pnpm 11.19.0。以下是**另一端新克隆上的重建命令**，本次验证没有重新执行构建：

```powershell
# 在对应冻结版本的仓库根目录；事先准备好 Node/pnpm 及依赖下载条件。
pnpm install --frozen-lockfile
pnpm build
New-Item -ItemType Directory -Path 'output/playwright/offline-lab' -Force | Out-Null
Copy-Item -Path 'docs/evidence/full-lab/iteration-02/offline/*' -Destination 'output/playwright/offline-lab/'
node output/playwright/offline-lab/package-candidate.mjs
& './output/playwright/offline-lab/start-package-server.ps1'
& './output/playwright/offline-lab/verify-package.ps1'
# 完成下文浏览器验证后，仅关闭上一个脚本记录的本任务静态服务器：
& './output/playwright/offline-lab/stop-package-server.ps1'
```

打包脚本强制匹配冻结清单中的全部 dist 文件名及哈希，构建产物不同就立即失败，不能修改期望哈希让检查通过。目标候选目录或 ZIP 已存在时，同样拒绝覆盖；请在新的独立克隆执行重建。重建清单包含新的打包时间，ZIP 条目也保留文件时间，因此重建 ZIP 的总体 SHA-256 **可以与本页原始归档不同**；应保存新的 SHA-256，并以相同的冻结 dist 哈希和逐文件校验确认运行内容等价。复核本页原始 ZIP 时则必须精确匹配本页 ZIP SHA-256。

- [package-candidate.mjs](package-candidate.mjs)：先核对全部冻结 dist 哈希，再创建唯一候选目录。已有目录时主动失败，避免覆盖旧包。
- [start-package-server.ps1](start-package-server.ps1)：将候选归档、计算 ZIP SHA-256，检查 5182 空闲后以隐藏窗口启动包内静态服务并记录 PID。已有 ZIP 时主动失败。
- [verify-package.ps1](verify-package.ps1)：核对包清单、冻结 dist 及 ZIP 内全部文件。
- [offline-check.js](offline-check.js)：通过 Playwright CLI `run-code --filename` 运行完整的 3 次全新上下文检查。
- [stop-package-server.ps1](stop-package-server.ps1)：核对 PID、进程及 5182 归属后，仅关闭本任务静态服务器。

已有候选包时，无需再打包。可在候选目录的独立 PowerShell 窗口运行：

```powershell
$env:PORT = '5182'
node scripts/serve.mjs
```

另一个终端进入 `output/playwright/offline-lab/`，在预先已有 Playwright CLI/Chromium 的开发环境执行：

```powershell
npx --yes --package @playwright/cli playwright-cli -s=rnc-lab-offline open about:blank
npx --yes --package @playwright/cli playwright-cli -s=rnc-lab-offline run-code --filename offline-check.js --raw > browser-results.json
npx --yes --package @playwright/cli playwright-cli -s=rnc-lab-offline close
```

Playwright/npm 是开发验证工具，不是分发包运行依赖；在真正无网络的验证机应提前准备工具，不能把 `npx` 下载成功当作断网条件的一部分。测试完毕停止自行启动的静态服务器。

本轮专属浏览器与服务器 PID 47744 已关闭，5182 不再监听；未触碰 5180 或 `rnc-live-stability`。本证据和候选文件已冻结，等待协调者关联最终交接版本。ZIP 为本机候选产物，尚不等于已上传分发附件。
