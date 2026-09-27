# A1 #27 + A2 #30 同版组合验证

2026-09-27；Role: A2；Identity-Source: user-declared；执行者 Codex 代 A2。接续 A2-FULL-017，沿用原草稿 PR #30。开始时 `10ae34b` 的两项 GitHub verify 均已成功。

## 固定版本与范围

- A2 基线：`10ae34ba69ce560b0fcf4e5ede75bf3e4cfdc827`，再应用本批 viewer.css 窄屏修复。
- A1：PR #27 `c0cb25466e3c69f1a2f93f2281330af8bcf012fd`。
- 组合目录：项目忽略目录 `test-results/a2-combined-017`，detached 工作树，仅本地验证，未提交或推送组合合并；原 A1 分支及 A1/B/shared/integration 运行源码未在 A2 分支修改。
- 精确运行文件和构建 SHA-256 见 `result.json`。`composition.patch` 为 A2 基线上临时 lab/index.ts 组合差异，供 A1/集成协调者审阅，不是已批准或已发布的运行变更。

## 组合冲突与复现

A1 基线早于新版实录谱形、可变时长及 A/Z 曲线改动，合并有两处冲突：

1. 保留当前未校准 V/教学 Pa 数据说明和可变时长文案，同时保留 A1 的 `lab-controls` ID 与抽屉关闭按钮。
2. 保留当前 `Record<AcousticWeighting, SplFrame[]>`、计权与频率状态，再加入 A1 的 visualRoad/roadNames，不能退回旧曲线数组。

在上述 A2 基线建立隔离工作树，fetch `refs/pull/27/head` 到 `origin/pr-27`，运行 `git merge --no-commit --no-ff origin/pr-27`。然后以 Node 22+ 运行 `resolve-preview.mjs <组合目录/src/team-a/lab/index.ts>`，拷入本批 viewer.css，安装锁定依赖并运行 `pnpm.cmd check`。以 PORT=5185 启动组合目录的 `scripts/serve.mjs`，从该目录运行本证据中的 `browser-combined.mjs <独立playwright-core/index.mjs绝对路径>`。脚本输出写回本证据目录。

## 实际结果

- 组合 `pnpm check`：94/94，类型、边界、构建通过，见 `check.txt`。
- A2 独立分支最终 `pnpm check`：94/94，包含 A2 25 项，见 `a2-check.txt`。构建大块提示仍在。
- 组合浏览器最终 67 项通过，Windows / Chrome 153。四车型各平整、粗糙、碎石三种路面共12次真实 Worker 实验，配置分别为0.6/1.2/2.2，Q1 RMS随粗糙度增长；每车原声/残余场均为280个实际计算点，5秒定位、剖面开启/恢复、同资产座椅拆装、控制台展开收起及360px窗口通过；无未捕获页面异常或运行时外网请求。
- 初次63项组合通过后，人工看图发现窄屏写实面板仍只有约102px高。`before-narrow.png` 和 `before-result.json` 保留原结果。修复在小屏将检视入口前置，展开时增加可用高度，并暂收会遮挡它的拆装清单；关闭检视后清单恢复，说明和署名保留。新增4项可见性/高度/避让断言，最终67项全部通过；已查看桌面、声场和最终窄屏截图。
- 独立页面复验累计出现两次 GLB `net::ERR_ABORTED`（Tesla、Range Rover 各一次），见 `independent-aborted-request.json`、`independent-aborted-request-2.json` 和上层 browser/failure*.png。未放宽资源断言；补请求类型/阶段/时间记录后，最终源码重跑33项通过，三次实际GLB请求均正常完成，见上层 browser/result.json。偶发取消根因尚未确定，保留为待查项，不以最后通过抹去前两次失败。

完整检查第一次包装命令因输出目录尚未创建而未运行；创建目录并完成冲突处理后实际检查通过。日志只以真实执行结果为准。

## 交接与未完成

下一步由 A1/指定集成协调者审阅两处冲突处理，在正式分支集成 #27/#30 并复核最新源码；本批不自动合并 PR。A2 提供本组合证据和窄屏样式修复。正式同版长稳、目标核显、实物音画、第二机离线与最终包仍待完成。

四车型写实外观/内部/声学同车配准仍未完成：ICE 为已有原资产分组，BEV 无同等级分件，HEV/EREV 无各自已核实高质资产；车型布局契约和B组路径需按上层 `LAYOUT_HANDOFF.md` 共同定稿。不能将本次组合操作通过解释为完整产品或实车声学验收。
