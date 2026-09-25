# RNC 3D Simulation

目标是四类双排SUV的交互式RNC展示、调试与试听应用。当前lab-v3包含ICE/BEV/HEV/EREV、参考改制、四门扬声器启禁、FxLMS调参、信号图、空间SPL采样与逐部件剖面；提供**16秒预计算回放**和**实时连续仿真**两种方式。所有源/路径为合成教学模型，没有连接实车采集设备。

当前为**完整目标开发基线，尚非最终交付**。旧阶段A1/A2的PR #5/#6已合入原仓库main；完整目标的阶段分支已收拢到 fork 的[当前分支表](docs/coordination/CURRENT_BRANCHES.md)，由[A1/整合草稿PR #23](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/23)和[A2草稿PR #20](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/20)继续交接。原仓库main仍未包含完整目标。[组合验证](docs/evidence/full-lab/integration-021/README.md)包括67项工程测试、四车真实场/改制及1210.65秒长稳；A1最新[音频质量验证](docs/evidence/A1/A1-FULL-008/README.md)另有1204.22秒长稳。旧demo-v2报告仅作历史参照；模型精细度、目标设备与正式发布仍有缺口。

A组最终交付内容、责任与验收门槛统一见[A组最终交付清单](docs/coordination/A_FINAL_DELIVERY.md)。本机功能完成与最终设备验收分别记录。

## 每次开发从这里开始

A 组两个 Codex 的入口：[双端协作流程](docs/coordination/README.md)、[A1 任务与交接](docs/coordination/A1.md)、[A2 任务与交接](docs/coordination/A2.md)。B 组入口：[B1/B2共同任务与串行交接](docs/coordination/B.md)，只分任务，不拆源码。

**每位用户开始新的开发/调试会话，先明确本次身份 A1/A2/B1/B2；未主动说明时，AI 必须先询问。** 同一会话已明确身份则不重复问；本地配置和历史日志不能代替新会话确认。记录、调试日志、提交说明与 PR 均标注角色、执行者和任务 ID；未推送的聊天或本地文件不能被另一端读取。

当前分支与集成入口见[当前分支表](docs/coordination/CURRENT_BRANCHES.md)；完整目标以最新main及其记录为准。

1. 拉取当前分支和 main 的最新提交。
2. 先读根目录 [开发记录.md](开发记录.md)，了解当前状态、阻塞和下一步。
3. 再读 [AGENTS.md](AGENTS.md)、所属组 README/AGENTS、[完整目标](docs/plan/10_FULL_GOAL.md)与[最终交付标准](docs/coordination/A_FINAL_DELIVERY.md)。00～04两周计划仅维护历史基准时使用。
4. 只改自己的组目录。共享接口和装配变更由 A1 + B1 协调。
5. **每个可验证的代码改动批次都同步更新开发记录，与代码一起提交并推送。** 不把聊天记录当作项目状态源。

## 快速启动

推荐 Node.js 24 LTS（最低 22.12）与 pnpm 11.19.0；Git 用于协作。首次安装需要联网。

```bash
git clone https://github.com/lzhdai/RNC_3D_SIMULATION.git
cd RNC_3D_SIMULATION
npm install -g pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm setup
pnpm dev
```

上述 fork/main 当前含完整目标开发快照；原仓库 main 仍只含已正式合并的旧阶段，合并状态以开放 PR 与提交核对。

打开终端打印的本机地址。无需 Python 服务、数据库、外部模型、CDN 或 AI API。Python 只用于独立核对参考数据。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | lab-v3完整目标开发界面；计算当前实验启动Worker，`?legacy=1`进入旧版 |
| `pnpm dev:a` | A 组参考回放入口；锁定重算参数，不启动 FxLMS Worker |
| `pnpm test:b` | B组旧基准及lab-v3物理/声场数值验证，不加载Three.js |
| `pnpm check` | 类型、依赖边界、自动测试、生产构建 |
| `pnpm setup` | 给当前克隆安装 Git 提交钩子 |
| `pnpm build` | 输出 dist，包含打包依赖和默认参考数据 |
| `pnpm start` | 使用 Node 内置静态服务器运行 dist，默认 4173 端口 |

`dev:a` 是旧demo-v2参考回放入口；lab-v3开发使用 `pnpm dev`，A组无需修改算法核心。A源码不导入B源码，由integration注入批量、持续计算及声场接口。

## 源码分工

```text
src/
  team-a/              # A 组独占
    lab/               # A1：完整目标界面与信号流
    app/               # A1：页面、交互、状态
    charts/            # A1：绘制，不另定义指标
    player/            # A1：统一音频时钟、公平试听
    viewer/            # A2：车辆、点位、相机、道路
  team-b/              # B 组独占
    lab/               # 参数化源、车型路径、动态MIMO及空间场；B1/B2共用
    engine/            # FxLMS、合成源、FIR 路径；B1/B2按任务串行共用
    analysis/          # RMS、PSD、功率降噪；不按人员隔离文件
    index.ts           # B 组公共入口
  shared/              # A1 + B1 共管：冻结接口、默认配置、fixture 解码
  integration/         # A1 + B1 共管：装配、Worker 适配、入口
fixtures/reference/    # 原始数值基准，不覆盖
tests/                 # A/B 分文件维护
docs/plan/             # 原始 v2 计划与接口快照
docs/协作开发指南.md
docs/验收记录.md
开发记录.md             # 人与 AI 共用的唯一进度入口
```

新接口为 `src/shared/lab-contracts.ts`；旧 `contracts.ts`、原始快照和fixture继续作为demo-v2回归基准，不改写历史数据。shared/integration由指定协调者统一修改，两成员从同一已提交基线开独立角色分支。

## 完整目标开发版操作

1. 选择车型、工况和算法参数。默认“16秒预计算回放”点击“计算当前实验”；选择“实时连续仿真”后手动启动，信号持续产生，学习状态跨块保留，不循环16秒数据。
2. 旋转、透明、连续拆解或选择剖面；点Q/REF/OUT/MIC或原理图通道查看q/x/u/d/a/e和频谱。
3. 开启改制，在可见结构上加参考或删除所选参考，启禁门扬声器；这些变化要求重新计算，误差点固定。
4. 播放并切换原声/残余、座位、场与切片、波前和路径；八路d/e在同一时间使用共同防削波增益，实时模式的保护包络随输入降低，物理分析仍使用原始Pa数据。
5. 预计算支持定位；实时暂停停止产出、恢复接续原学习，停止/重新开始建立新实验。参数或拓扑改变后清除旧结果/场并重置学习；后台暂停，回前台手动恢复。
6. 车型切换后若参考所装部件不存在，页面列出缺失安装件并阻止计算；删除该参考后在有效结构重新安装。误差点固定，不提供删除入口。
7. 信号、场、图表读取同一播放时钟；实时界面只保留有界滚动历史，过去全部数据不可任意回看。波前/传播线是教学示意，场值来自空间路径计算；低于能量底限与数据准备中分别提示。

## demo-v2历史演示（仅适用于legacy/参考入口）

1. 默认载入参考算例回放。旋转车辆，切换透明 / 隐藏车身、分层展开和复位。
2. 点击 REF / OUT / MIC 标签，观察同角通道波形与PSD；MIC默认切换到该座位的残余e试听。SOURCE紫色虚线标签表示轮端激励示意，点击查看同角REF，不能当作另一组测量数据。
3. 点击播放。前 2 秒无控制，随后学习；曲线和道路读取同一音频时钟。
4. 选择四个座位之一，在对比原噪声和对比 RNC 结果间切换。时间不回退，共用增益和约 30 ms 交叉淡化。
5. 修改 taps、μ 或种子后点击计算新实验。计算在 Worker 中完成；来源变为浏览器计算。设 μ=0 可验证没有降噪。
6. 计算失败会显示错误并暂停。旧实验保留原 runId、来源和参数，仅在手动点击播放后继续，不冒充新结果。

查看REF x或OUT u仅切换图表，当前座位的d/e试听保持不变，图表上方分别显示两者；改变试听座位或d/e模式会回到对应MIC图表。RMS不足0.5秒、PSD不足0.512秒时显示准备中。窄窗通过页面纵向滚动访问四点指标和播放控件。

试听信号是误差点的 d/e，不是扬声器驱动 u。Pa 转音频的固定增益为 2，两路使用相同 16 kHz 重采样；音量默认为 25%。合成 SPL 参考 20 μPa，降噪为同窗功率比，四点总指标先合功率再求比值。

## 离线启动与历史演示包

`pnpm build` 后，分发 `dist/`、`scripts/serve.mjs`、`启动演示.cmd` 和本 README，保持相对目录。目标电脑安装 Node 后双击启动演示.cmd，打开 http://127.0.0.1:4173；也可在包目录执行 `node scripts/serve.mjs`。此服务器仅监听本机，无需 node_modules，无需联网。

不能直接双击 dist/index.html，ES 模块和 Worker 需要 HTTP。GitHub CI 成功后会提供 rnc-browser-build 下载工件。它不是已通过整体验收的正式发布版。

lab-v3第二轮候选包已从冻结dist制作，三次新浏览器本机网络隔离启动45项通过；[清单、包哈希及重建步骤](docs/evidence/full-lab/iteration-02/offline/README.md)随源码保存，仍非通过完整设备/视觉验收的正式发布版。第二台Windows真实断网仍待测。

旧demo-v2候选包验证代码为`838cdf3`，由A1 `45fe841`及A2 `2760f43`组成，见[历史本机交付验收](docs/evidence/A1/A1-004/README.md)。不能把旧包或单角色分支工件当成新版完整交付。

## 协作与验收

- 分支建议 a/app-*、a/viewer-*、b/engine-*、b/analysis-*，每天至少集成一个可运行变更。
- 提交钩子检查源码越界和开发记录是否同时暂存；GitHub CI 在 push / PR 上重复检查。
- 管理员可把 verify 检查设为 main 必须通过的分支规则；本工程没有修改远端仓库设置。钩子 / CI 不能保证记录真实，仍需评审。
- 参考文件不能覆盖；新实验写到 test-results/，复现错误附代码 SHA、runId、配置和实际结果。
- 当前验证证据及未验收项见 [验收记录](docs/验收记录.md)，多 AI 交接模板见 [协作开发指南](docs/协作开发指南.md)。
