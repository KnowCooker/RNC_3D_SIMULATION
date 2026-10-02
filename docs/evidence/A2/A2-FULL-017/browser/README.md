# A2-FULL-017 浏览器续验

日期：2026-09-27。Role: A2；Identity-Source: user-declared；执行者 Codex 代 A2。任务分支 `a/a2-full-017-asset-inspection`，提交前 HEAD `1fac78c`；当前未提交源码 SHA-256 和构建摘要固定在 `result.json`，最终提交以包含本报告的 Git 提交为准。原仓库草稿 PR #30。

本批修复低位检视被道路/车间地板遮挡、关闭教学剖面后相机仍留在地下、旧 ICE 加载失败影响新 BEV 加载状态。仅改变展示及异步请求隔离，不移动车辆或声学物理坐标。历史失败见 `before-section-y.png`、`before-teaching-reset.json`、`before-lifecycle.json`。

当前源码重新构建后的实际结果：

- `pnpm exec tsx --test tests/a2-*.test.ts`：25/25，见 `a2-tests.txt`。
- `pnpm check`：94/94，类型、边界和生产构建通过，见 `check.txt`；超过 500 kB 的构建提示保留。
- `browser-check.mjs`：33 项通过，见 `result.json`。涵盖同资产检视/拆装、三轴剖面、道路/车间、窄屏、四车型教学 Y 剖面与关闭后恢复。页面异常、正常资源失败和外网请求均为 0。
- `browser-lifecycle.mjs`：7 项通过，见 `lifecycle.json`；主动注入旧 ICE 请求 HTTP 503，验证新 BEV 加载仍保持禁用按钮和正确文案；自动拆装暂停、逆序回装及硬件配置重建通过。
- 已查看 `section-y.png` 和 `narrow.png`：底部车体不再被场景地板遮住，显示地板暂隐说明；窄屏保留车体与检视操作。此检查不等同最终视觉验收。

环境为 Windows、本机 Chrome 153、RTX 5060 Ti，非目标核显。使用项目忽略目录内 Node 22.14.0、Corepack/pnpm 11.19.0 和独立 playwright-core；未修改系统执行策略。首次检查因 pnpm 不在 PATH、随后 PowerShell 优先选择受限 ps1 而未执行成功；启用项目便携 Corepack shim 并显式使用 pnpm.cmd 后完成锁定依赖安装和全部检查，未把中止尝试计为通过。

复现：用 Node 22+ 执行 `pnpm.cmd check`，启动 `PORT=5184` 的 `scripts/serve.mjs`，依次运行同级上层的 `browser-check.mjs` 和 `browser-lifecycle.mjs`，首个参数为独立安装的 playwright-core/index.mjs 绝对路径，第二参数为 `http://127.0.0.1:5184/`。

下一步：按用户授权提交并推送现有分支，核对 PR 最新提交和 CI；继续 A1 同版组合及目标设备验收。四车型写实同车结构/声学配准、实物音画、第二机离线和最终交付未完成。本次无跨组源码/接口变更，未修改原 GLB 或冻结 fixture。
