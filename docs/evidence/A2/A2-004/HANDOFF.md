# A2 本机交付与后续接续

本次接续由用户明确指定本端完成A2；上一位A2代理已停止写入。功能源码冻结于`2760f434dd7b86f7d8b724319f9c77902d3f89bc`，本轮仅补复测工具、演示与交接。后续以PR最新HEAD取文档，以此冻结SHA定位功能。

## 版本与验收事实

| 内容 | 可恢复位置 | 状态 |
| --- | --- | --- |
| A2独立代码 | [PR #6](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/6)，分支`a/a2-002-viewer-stability` | 已实现，依赖#3，尚待合并 |
| A1+A2完整候选 | [组合分支](https://github.com/lzhdai/RNC_3D_SIMULATION/tree/a/candidate-20260923)，运行代码`838cdf38503cb2a8dc7512ace28f7894d3f283c9` | 可演示，不等于main |
| A2功能验证 | [20轮复位](../A2-002/README.md)、[四轮源](../A2-003/README.md) | 223项稳定性、43项源点、90项原硬件断言通过 |
| 完整组合验收 | [固定版本QA报告](https://github.com/lzhdai/RNC_3D_SIMULATION/blob/d52bace9d1f80ab3d78e17ac6691408ec242620e/docs/evidence/A1/A1-004/README.md) | 22项测试、实际1203.85秒/10次重算/102次换座位/26次d-e/63次重播、3次同机浏览器网络隔离启动通过 |
| 目标核显 | 同下方性能流程 | 待实际目标设备；RTX4070结果不能替代 |

原演示包`rnc-a1-a2-candidate-838cdf3.zip`的SHA256为`b449e1a107de0b66d65edce1ca0e8f070a8bd2ec380e6d767ab51d976a8b259b`。本轮不修改其运行时；后续补充资料单独保存，不把旧包改名冒充新构建。

## 在另一台电脑恢复A2开发

先查看原仓库#3/#6是否已合并，并检查有无其他正在执行的A2任务。已有工作目录先`git status`，不要重置或覆盖未提交工作。下面只用于**新的独立克隆**，避免worktree共享角色配置：

```powershell
git clone https://github.com/KnowCooker/RNC_3D_SIMULATION.git RNC_3D_A2
cd RNC_3D_A2
git config --local rnc.role A2
git remote add fork https://github.com/lzhdai/RNC_3D_SIMULATION.git
git fetch fork
# #6尚未合并且用户明确要求接续时：
git switch -c a/a2-002-viewer-stability --track fork/a/a2-002-viewer-stability
pnpm install --frozen-lockfile
pnpm setup
pnpm check
pnpm dev:a
```

若#6已经合并，从最新main新建A2任务分支，不再延续已关闭PR。没有fork写权限时推送自己的fork并提交PR，不强推已有分支。独立A2分支没有A1 #4/#5，**不能把它的构建称为完整组合包**；完整演示使用候选分支的单独克隆或原演示包。

## 可移植性能复测

前提：Node≥22.12、Chrome；从源码构建还需pnpm11.19.0。运行生产包的`node scripts/serve.mjs`后，另开PowerShell，进入仓库根目录：

```powershell
pwsh -NoProfile -File docs/evidence/A2/A2-004/run-performance.ps1 -Url http://127.0.0.1:4173/ -CodeCommit 838cdf38503cb2a8dc7512ace28f7894d3f283c9 -Headless
```

`CodeCommit`必须填写**所测服务实际构建代码**，脚本不会从URL猜测版本。无`pwsh`时可用`powershell -NoProfile -File`。默认通过npx调用固定`@playwright/cli@0.1.21`，首次准备测试工具需联网；这与产品离线启动是两回事。离线环境可用`-CliPath '已安装的playwright-cli.js绝对路径'`。结果写入新的`output/playwright/a2-perf-*`目录，不覆盖旧证据。

脚本记录实际WebGL GPU、浏览器、代码版本、默认/展开各15秒的帧率、三角数和截图；强制**测试浏览器**内部缓冲1280×720、视口1920×1080，不改产品源码。尺寸不符、任一场景低于30fps、三角数超预算都会失败并保留JSON。`-Headless`适合自动化；省略时打开窗口，测量期间需保持前台、可见，不最小化或遮挡，否则可能受到浏览器节流。两种测量方式分别记录，不混为同一环境。

目标机接续时，记录CPU/系统/供电模式，并核实结果里的实际GPU确实是约定核显。先判定尺寸和环境有效，再判定帧率；不达标才在viewer内调整像素比/材质/几何。之后复跑同条件性能及A2功能回归。不要用软件渲染或CPU限速冒充核显测试，不更改算法、播放速度、声学路径或比较增益。

## 结束与下一步

后续Codex先读`docs/coordination/A2.md`、本页与开放PR。A2-001～003无需重写；本机交付记录优先于历史段落的“未测”。剩余动作是目标核显实测、维护者按#3→#6合并、合并后核对版本并冒烟运行。实物音画/听感与第二台Windows由A组整体协同验收，不等待这些设备而重复修改已通过的viewer。

A2只写`src/team-a/viewer/**`、`tests/a2-*`及自身证据/交接；A1继续独占app/charts/player。冻结接口未变，无需迁移数据或改B组。
