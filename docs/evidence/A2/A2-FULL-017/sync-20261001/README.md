# 2026-10-01 本地与云端成果同步

Role: A2；Task: A2-FULL-017；Identity-Source: user-declared；执行者 Codex 代 A2。

用户明确要求同步并保留双方最新有效内容。沿用唯一开放的草稿 PR #30，无新任务认领。

## 版本与保留范围

- 本地原分支 d8e2717；13个未提交文件先备份于本机 test-results/a2-sync-20261001/，随后保存为 819ab708e028cc48d78d167dbc3605e99b7b84d6。
- 合入云端 main 67387f68c6a6c1d9ad0826794f61ebde74aa649c，无冲突。A1/B/shared/integration/配置/冻结fixture逐项保持云端内容；viewer及A2测试保持本地内容，双方开发记录作为有序子序列全部保留。核对结果和运行文件哈希见 integrity.json。
- 合并前 pnpm check 94/94（before-check.txt）；合并后 A2 25/25（a2-tests.txt），pnpm check 165/165、类型/边界/构建通过（check.txt）。既有大块构建提示保留。

## 浏览器验证与限制

- browser-load-audit.mjs 沿用原诊断，只适配最新首页默认收起控制台，操作前显式展开；断言不变。
- load-result.json：首次完成42项后因retry阶段额外net::ERR_ABORTED失败；两次主动注入net::ERR_FAILED另列。保留失败，不归为成功。
- load-repeat.json：独立会话44项通过，16次正常四车型切换及两次主动失败后的重试/换车恢复；13次GLB请求仅两次预期注入失败。此结果不能证明历史偶发取消根因已消除。
- browser-combined.mjs 从旧组合脚本适配最新main：指定预计算/随机整形源以验证路面趋势，默认收起控制台；切至窄屏后仅在控制台实际展开时关闭。所有原有功能断言保留，另检查窄屏收起状态。
- combined-before-adaptation.json/png：首次56项后因最新页面切至窄屏会自动收起控制台，旧脚本点击隐藏关闭按钮超时；这是脚本前置条件失配，未改生产源码。
- result.json：最终68项通过，四车型×三路面12次真实Worker计算、源趋势、每车型原声/残余280点场、剖面相机恢复、写实同资产座椅拆装、360px窄屏检视与控制抽屉通过；无未捕获页面异常、无外部运行请求。脚本保存父提交、main SHA及运行源码/构建哈希，以明确这是两者合并后的未提交构建。
- load-repeat-recovered.png及ice-inspection-narrow.png已人工查看。最终目标核显、实物音画、20分钟长稳、第二台Windows离线未在本批执行。

## 复测

先 pnpm build，以 PORT=5197 运行 node scripts/serve.mjs，再调用本目录两个脚本，首参数为 playwright-core/index.mjs 绝对路径，次参数 http://127.0.0.1:5197/。加载脚本第三参数指定新的结果JSON，避免覆盖已保存的失败。

## 下一步

推送现有A2分支并核对PR #30；保留草稿和历史GLB取消问题。完整同车资产/安装布局、B按布局计算、最终设备与交付仍按最新云境香槟实施计划继续；本批不认领或实现这些新功能。

## 发布核对

合并提交 `a9894522be9cfcc01be05ad85ab48511e2d52b17` 已推送，远端A2与本地SHA一致；本地main已仅快进至云端`67387f6`。[PR #30](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/30)正文已更新，状态open/draft、mergeable=true；查询时两项verify运行中，后继文档提交以最新CI为准。未合并云端main。
