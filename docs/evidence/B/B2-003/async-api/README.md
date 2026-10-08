# B2-003 异步接口与生产浏览器 Worker 验证

2026-10-01；Role: B2；Identity-Source: user-declared；执行者 Codex。用户授权继续；接班基线 main `c2b0f43abff449e25a87eb3dba35ce188ff1057f`，已合并 #51。开放 PR 只有 A2 #30，B1 最新交接结束写入。分支 `b/b2-003-async-export`，认领 `260d99a` 先推送并创建[草稿 PR #52](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/52)，复查无 B 重复任务后改功能。

## 变更与实际验证

新增 B 纯函数 `encodeResultAsync` / `decodeResultAsync`，注入 Promise 型 SHA-256，浏览器 Web Crypto 可直接适配。保留同步接口、格式与模型身份；配方编码/估算仅需源码 commit，不调用哈希。编码在等待前捕获元数据和信号；解码在预算/边界核对后持有独立容器快照，在结构/有限性/哈希均通过后还原独立通道。Node Buffer、带偏移视图及输入转移均有验证，适配器拒绝原样传播。调用方提供的哈希适配器是可信依赖，不得修改内部载荷。

| 验证 | 实际结果与证据 |
| --- | --- |
| 异步专项 + 既有分析 | 33/33，新增5项竞态/Web Crypto/失败/预算验证，[analysis-test.txt](analysis-test.txt) |
| B 组 | 90/90，[test-b.txt](test-b.txt)；之后配方参数仅作类型放宽，最终运行验证以全仓日志为准 |
| 全仓 | 180/180，类型/边界/生产构建通过，既有 viewer 大块提示保留，见 [check.txt](check.txt) |
| 旧版文件兼容 | 从合并 #51 的 `c2b0f43` 只读提取旧 API，在忽略的 test-results 中加载，旧新容器完全逐字节一致，两个方向均可解码；[compatibility.json](compatibility.json)、[原始输出](compatibility.txt)、[复现脚本](compatibility.ts) |
| 真实浏览器 | Windows Chromium 154、secure context，生产 module Worker 用真实 Web Crypto，20/20；五工况结果往返与配方复算各320万值逐位一致，等待时改配置/信号和转移原 buffer、坏哈希、预算拒绝通过，[原始页报告](browser-result.json) |
| 浏览器错误 | 最终构建重载后，开发工具 error/warn 查询返回空数组；[browser-console.json](browser-console.json) |
| 源码/构建/冻结完整性 | 见 [source-integrity.json](source-integrity.json)，绑定实际运行 B 文件、测试、验证页/Worker 和独立构建文件 SHA-256；既有8个冻结文件未改 |

运行模块只改 B export；测试追加至既有 B 入口，说明与证据在 B 范围，不修改 A/shared/integration/根配置、数值公式或 fixture。验证页/Worker/config 位于本证据目录，单独构建至 test-results，不接入产品，不替代 A1 的正式下载/文件流程。此前旧 demo 证据保留其对应版本，不用旧源码哈希冒充本次版本。

首次尝试在沙箱启动产品 dev，被 esbuild 目录访问限制拒绝；首次验证页因此连接失败。随后授权构建进程，改用本目录独立生产构建/preview，页面和全部测试通过。没有将失败尝试写作成功，也没有修改根 Vite 配置。源码中的 sourceCommitContext 使用认领 SHA 作为注入测试值，**不是测试时构建已提交的声明**；实际版本由 source-integrity 的源码/产物哈希绑定，交接另记录最终提交。

## 复现

在仓库根目录，安装锁定依赖后执行：

```text
pnpm exec tsx --test tests/analysis.test.ts
pnpm test:b
pnpm check
pnpm exec tsx docs/evidence/B/B2-003/async-api/compatibility.ts test-results/B2-003-new-compat
pnpm exec vite build --config docs/evidence/B/B2-003/async-api/vite-audit.config.ts
pnpm exec vite preview --config docs/evidence/B/B2-003/async-api/vite-audit.config.ts --port 5174 --strictPort
```

最后打开 `http://127.0.0.1:5174/docs/evidence/B/B2-003/async-api/browser.html`，报告为20项 passed=true；构建变化后重载。兼容脚本要求 test-results 下的新单层目录，拒绝已有输出，不覆盖 fixture。页面无输入、文件下载或外部通信；生产构建日志见 [browser-build.txt](browser-build.txt)。

异步解码新增容器副本，至少持有输入文件+文件副本+输出信号；没有测浏览器堆峰值、目标设备耗时/取消、第二台 Windows 或产品集成。因此只解除“浏览器没有同步哈希适配”的接口障碍，不签收完整 B2-003。lab-v3 两种源/布局/素材身份、动态参考/发散前缀、实时状态仍待 B1/指定集成者协调，A1 正式文件 UI/Worker 和峰值内存另验。本批推送可审查后停止写入，不自动合并。
