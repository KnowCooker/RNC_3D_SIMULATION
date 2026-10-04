# B2-003 五注册布局浏览器 Worker 证据

2026-10-05；Role:B2；Task:B2-003；Identity-Source:user-declared；Executor:Codex。认领提交 `71fc8e985cff89a450539ebaa3205640db17b156`，原仓库 [PR #61](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/61)，base 为 A2 `a/a2-driving-experience`。

上一批 [#60](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/60) 已合入该分支，合并提交 `382100930ca950adfed27390acbb6226e0af4afc`；本批从此版本开展独立浏览器验证。main 仍为 `b968d926ce343cb4568e00bdb14da4e87bdd6fc6`，注册模型尚未进入正式 main。本批只新增本目录证据与双日志，不修改运行源码、原测试、旧证据或冻结基准。

## 实际运行

在本机 Codex 内嵌浏览器运行 Vite **生产构建**，页面为 `http://127.0.0.1:5276/docs/evidence/B/B2-003/registered-worker/browser.html`。页面创建独立 module Worker；其全局类型实际为 DedicatedWorkerGlobalScope，安全上下文与 Web Crypto 可用。浏览器自报 Windows x64、Chromium 154，hardwareConcurrency=14；这不证明目标核显、特定 Windows 系统版本或第二台机器已验收。

`browser-report.json` 保存原始 DOM 报告，218/218 检查通过，30组矩阵为五布局×两声源×1/4/8参考。每种对照1460000个Float32值，包括浏览器对已提交Node哈希、同步结果解码、异步结果解码和配方复算。每路均使用明确小端字节SHA，信号完全一致；同步/异步容器字节也一致。

Web Crypto 是异步接口。同步API验证使用实际Web Crypto预先算出的摘要，仅对逐字节相同的已捕获载荷返回缓存摘要；不同载荷会拒绝。它不使用manifest自报摘要充当哈希校验，也不声称浏览器有同步Web Crypto。异步导入及篡改拒绝均直接使用真实crypto.subtle.digest。

其他实际检查：

- 原RNQ1完整长度/哈希、注册布局/动力类型、模型身份、通道维度及原指标核对。
- 由旧编码器生成的真实model-1文件保留原身份与缺省，只读且无verifiedMetrics；旧模型复算在素材访问前拒绝。
- 未知布局、assetId别名、动力错配保持只读，导出及复算拒绝；三类拒绝均未触发resolver或hash。未知布局的非法seed仍在哈希前拒绝。
- 错载荷的真实SHA校验拒绝，字节预算在哈希前拒绝，非零byteOffset、导入等待期间转移调用方buffer、导出等待期间修改run/config/q/x都保留独立数据。
- GX注册布局的真实发散保留551/6000点有限前缀及原发散身份，不补零或冒充完成。

`browser-console.json` 的error/warn记录为空；实际完成页面见 `browser-success.png`。页面自报全流程约2456.5ms，仅是该30组短案例夹具的观测时间，不用于B1-004默认16秒计算/发送的目标性能判定。没有测量峰值内存。

## 构建、源码与回归

`verification.json` 由 `verify.ts` 核对：报告30组与此前Node证据逐路一致、全部检查成功；注册模型17项UTF-8/LF哈希一致；B/A/shared/integration及测试相对候选无改动；八份冻结fixture相对main b968d92原字节哈希相同；本批源码、报告和实际浏览器生产构建产物哈希保存。源码commit在Worker中声明为3821009，因为本批没有改变B运行模块；夹具自己的源码哈希及后续实现提交另作绑定，不能将该字符串当作整个证据构建认证。

已执行：证据Worker/config的strict tsc、独立Vite生产构建、`pnpm test:b`125/125及`pnpm check`295/295（类型/边界/构建均通过）。命令输出分别保存 typecheck.txt、browser-build.txt、test-b.txt、check.txt；既有主应用大块构建提示保留。CI仍以PR最终head实际检查为准。

## 复现

在仓库根目录执行：

```powershell
pnpm exec tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck docs/evidence/B/B2-003/registered-worker/browser-worker.ts docs/evidence/B/B2-003/registered-worker/vite-audit.config.ts docs/evidence/B/B2-003/registered-worker/verify.ts
pnpm exec vite build --config docs/evidence/B/B2-003/registered-worker/vite-audit.config.ts
pnpm exec vite preview --config docs/evidence/B/B2-003/registered-worker/vite-audit.config.ts --host 127.0.0.1 --port 5276 --strictPort
```

打开上述本机页面，等待“通过”，保存页面#report的JSON及控制台error/warn记录。再执行 `pnpm exec tsx docs/evidence/B/B2-003/registered-worker/verify.ts`、`pnpm test:b`和`pnpm check`。若修改夹具后重建，须重新加载生产页面并重新保存实际报告，不能沿用旧报告。旧模型与Node基准来自只读的 registered-compat 目录，不重新生成或覆盖原证据。

## 后续门槛

本批通过的是独立生产模块Worker的数据兼容验证。A1正式文件UI/产品Worker/取消/实验隔离、新布局B1独立审查、真实峰值内存、目标设备性能和第二台Windows真断网仍待验；完整B2-003/最终B2-004未签收。#58/#59最新A实现未在本夹具中组合验收；各角色按其最终head自行集成复验。本批B2写入结束后由维护者审查#61，不自动合并A分支或main。
