# A1-002 实验请求状态验证

日期：2026-09-23；分支 `a/a1-002-experiment-state`；[PR #4](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/4)。基于 A1-001 的 `f06c07e`，与 A2-001 分支独立。代码版本由 PR HEAD 及本目录 git 历史定位。

## 问题与修复

真实 Worker 基线复现：选择 taps32 / seed29 计算后载入参考，诊断已是 seed11 / taps64，但选择框仍是32 /29。现在成功载入结果时同步三项配置。

计算与参考加载各有请求身份。取消立即恢复界面、保持旧实验暂停；迟到的成功、失败和 finally 均不能覆盖新请求。参考模式也可以取消加载。计算返回必须匹配本次 runId、来源和完整配置，否则提示失败并保留原实验。参考加载失败不会将已有浏览器计算标为参考数据。

取消参考加载仅停止应用其结果，现有 AppPorts 没有 AbortSignal，底层 fetch 可继续完成。本轮不改变共享接口。

## 实际验证

- `pnpm check` 通过：类型、A/B 边界、17/17现有自动测试、生产构建。未改变数值核心、fixture 或容差；已有主脚本大于500kB提示仍存在。
- [注入式浏览器结果](injected-results.json)：23项通过。测试注入可控 Promise，覆盖先后交错、重复提交、错误身份、初次失败、取消和参考模式。它只验证真实 app 的状态行为，注入的计算结果外壳不作为数值验证证据。
- [真实 Worker 结果](worker-results.json)：8项通过。真实取消、seed29/taps32/μ0.08、seed47/taps64/μ0（总降噪0.00dB）、参考HTTP503失败保留旧实验、参考恢复参数与时钟。两次Worker耗时136ms与100ms，仅本机单次观察。
- 无未捕获 pageerror；HTTP503场景的浏览器网络error是主动注入且符合预期。
- 已目视检查[取消状态](cancelled.png)和[HTTP失败保留计算数据](http-failure.png)截图。

## 复跑

Node 24.13.1、pnpm 11.19.0、Chrome153、Playwright CLI0.1.21；不需要给项目增加浏览器依赖。

1. 在本分支执行 `pnpm install --frozen-lockfile`、`pnpm check`、`pnpm dev --port 5173`。
2. 独立CLI会话打开 `http://127.0.0.1:5173/`，读取snapshot。
3. `playwright-cli -s=rnc-a1-state run-code --filename docs/evidence/A1/A1-002/harness-setup.js`，再snapshot，然后以同方式执行 `browser-check.js`。
4. 导航回 `/`，读取snapshot，执行 `worker-check.js`。结果JSON来自CLI的Result段，截图先写入`output/playwright/`。测试运行页面使用测试专用路由，产品入口不包含它。

## 后续与边界

本轮只完成A1-002。A1-003的选择语义、图表/窄窗/后台恢复与A1-004长时间、第二机、听感/真实延迟验收仍待完成。两角色开发分支不互相合并，组合结果见下节。
## A1 + A2 组合验证

A1源码`a89130a`（同步main后的分支提交`3f0214b`）、A2最终`30af787`、main `d4e191b`组合在第三个worktree验证，本地组合提交`d1fac4e`。后续A1提交仅补本节证据和交接，不改运行时源码。原仓库PR #1/#2已由维护者合并；本轮PR #3/#4仍分别交付。

- `pnpm check`通过：19/19自动测试、类型/边界/生产构建。
- [联动结果](integration-results.json)：22项通过，12标签逐点联动图表/硬件、4座位传播、键盘点选、复位保留暂停时间和结果身份、真实Worker取消后仍可点选。
- [组合Worker结果](integration-worker-results.json)：8项通过，复跑`worker-check.js`，含两种真实配置、取消、失败与参考恢复。
- [组合截图](integration.png)已目视检查；无未捕获页面异常。favicon404是已有资源缺失，HTTP503为主动注入场景，均没有算作功能成功请求。
- 两分支相对main的改动文件仅`开发记录.md`重合。源码、各自交接、测试及证据文件不重合；shared/integration/B组无变更。合并时仅根日志两行状态表发生文字冲突，保留A1新行及A2新行，双方历史均保留。共享日志仍需合并者核对，不能承诺文字永不冲突。

复跑组合：在临时分支从main `d4e191b`合入A1 `3f0214b`和A2 `30af787`，按上述规则解决根日志；执行`pnpm check`并以5175端口启动。CLI导航至5175、读取snapshot后运行[integration-check.js](integration-check.js)；导航回首页后运行`worker-check.js`。本地组合分支只作验证，未推送为第三个功能PR，也未混入任何角色的开发分支。

远端A1功能提交CI：[a89130a / Engineering checks](https://github.com/KnowCooker/RNC_3D_SIMULATION/actions/runs/35868327856)成功。后续文档提交的最新CI以PR HEAD为准。
