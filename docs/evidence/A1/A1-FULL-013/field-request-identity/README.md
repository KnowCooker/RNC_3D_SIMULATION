# A1-FULL-013：同一实验内的声场请求身份

2026-09-29；Role: A1；Identity-Source: user-declared；执行者 Codex 代 A1。基线是 #38 `8ae07e2` 与原仓库 `main` `b1d07cc`。此前 integration 只校验 Worker 场帧的运行 ID 和物理布局 ID；若同一实验的回复换成另一时窗、计权或采样点，主线程仍可接收，导致当前播放时刻或 A 计权色标下显示别的场，或在当前剖面上解释另一平面的数值。

本批在每个待完成场请求中保存时间、采样率、计权及采样点坐标快照；回复时间容差为一个样本周期，点位须逐点按序匹配（坐标容差 `1e-5`），否则仅拒绝该场查询，实验和 Worker 继续运行。A1 页面原有的布局身份与当前剖面校验保持。新增伪 Worker 测试先因错回复被接受而失败；实现后覆盖错时窗、错误计权、换序点位、移位点位和正确回复，专项通过；`pnpm check` 的类型、边界、145 项全仓测试及生产构建通过。

生产构建 `lab-engine-CgCV2due.js` SHA-256 `D0EBC690C57626A68D973B6C0BFB1361416359B12DE91DB08C27D08EEEFE9319`。在 `PORT=5193 pnpm start` 的正式页面上，[四车型脚本](../../A1-FULL-016/qa-field-evidence.js)与[原始结果](four-cars.log)验证 ICE/HEV/EREV/BEV 各 10 秒真实 Worker 残余场均 280/280 有效点，A/Z 切换、剖面移动、路面失效、390px 宽度正常，页面异常与非 favicon 失败请求 0。[实时脚本](qa-live.js)和[原始结果](live.log)验证 BEV 预计算、持续模式 RNC ON→OFF→ON、约 2.50 秒真实残余场可见，[截图](live-rnc.png)留存。浏览器控制台只有预存的本机 `/favicon.ico` 404，没有页面脚本错误。

范围为指定协调的 `src/integration/lab-engine.ts`、A1 伪 Worker 测试和本证据/交接；没有修改 A2/B/shared 或数值 fixture。此保护确保当前教学场不串查询，不解决写实同车布局的几何与 B 路径接入；#38 仍待 B1 对共管接口的实际审查。
