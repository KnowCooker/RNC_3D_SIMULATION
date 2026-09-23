# RNC 3D Simulation

一辆程序化纯电 SUV、固定 4 路振动参考 / 4 个车门扬声器 / 4 个头枕误差点，演示真正的 4×4×4 FxLMS。所有路径与数据都是**合成教学模型**，运行方式是**先计算 16 秒，再同步回放**。

当前为**A组候选演示版**。页面/图表/试听、12硬件点与四轮源示意、透明/展开/复位已在各自任务分支实现；未合并成果以开放PR和角色交接为准。候选组合22项自动测试及同机生产包3次无外网启动已通过，真实20分钟长稳已通过（10次重算、102次换座位、26次d/e切换、63次重播）。第二台Windows、指定核显及实物音画仍待验证，不能视为两周计划整体验收完成。

A组最终交付内容、责任与验收门槛统一见[A组最终交付清单](docs/coordination/A_FINAL_DELIVERY.md)。本机功能完成与最终设备验收分别记录。

## 每次开发从这里开始

A 组两个 Codex 的入口：[双端协作流程](docs/coordination/README.md)、[A1 任务与交接](docs/coordination/A1.md)、[A2 任务与交接](docs/coordination/A2.md)。每端只需首次确定角色，后续从仓库和开放 PR 恢复工作；未推送的聊天或本地文件不能被另一端读取。

1. 拉取当前分支和 main 的最新提交。
2. 先读根目录 [开发记录.md](开发记录.md)，了解当前状态、阻塞和下一步。
3. 再读 [AGENTS.md](AGENTS.md)、所属组 README/AGENTS 和 [开发计划](docs/plan/00_两周开发总计划.md)。
4. 只改自己的组目录。共享接口和装配变更由 A1 + B1 协调。
5. **每个可验证的代码改动批次都同步更新开发记录，与代码一起提交并推送。** 不把聊天记录当作项目状态源。

## 快速启动

推荐 Node.js 24 LTS（最低 22.12）与 pnpm 11.19.0；Git 用于协作。首次安装需要联网。

```bash
git clone https://github.com/KnowCooker/RNC_3D_SIMULATION.git
cd RNC_3D_SIMULATION
npm install -g pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm setup
pnpm dev
```

打开终端打印的本机地址。无需 Python 服务、数据库、外部模型、CDN 或 AI API。Python 只用于独立核对参考数据。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 完整联调；先载入参考算例，可点击计算新实验启动 Worker |
| `pnpm dev:a` | A 组参考回放入口；锁定重算参数，不启动 FxLMS Worker |
| `pnpm test:b` | B 组无界面数值和 PSD 验证，不加载 Three.js |
| `pnpm check` | 类型、依赖边界、自动测试、生产构建 |
| `pnpm setup` | 给当前克隆安装 Git 提交钩子 |
| `pnpm build` | 输出 dist，包含打包依赖和默认参考数据 |
| `pnpm start` | 使用 Node 内置静态服务器运行 dist，默认 4173 端口 |

`dev:a` 使用已实现的 B 组纯分析 API 读取参考结果；A 组无需运行或修改算法核心。A 源码不导入 B 源码，由 integration 注入 DemoEngine。

## 源码分工

```text
src/
  team-a/              # A 组独占
    app/               # A1：页面、交互、状态
    charts/            # A1：绘制，不另定义指标
    player/            # A1：统一音频时钟、公平试听
    viewer/            # A2：车辆、点位、相机、道路
  team-b/              # B 组独占
    engine/            # B1：FxLMS、合成源、FIR 路径
    analysis/          # B2：RMS、PSD、功率降噪
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

相对原计划仅增加 team-a / team-b 层级明确归属；接口字段、数组顺序、单位、数值基准保持原样。活跃契约是 `src/shared/contracts.ts`，`docs/plan/contracts-demo.ts` 是原始快照。

## 五分钟演示

1. 默认载入参考算例回放。旋转车辆，切换透明 / 隐藏车身、分层展开和复位。
2. 点击 REF / OUT / MIC 标签，观察同角通道波形与PSD；MIC默认切换到该座位的残余e试听。SOURCE紫色虚线标签表示轮端激励示意，点击查看同角REF，不能当作另一组测量数据。
3. 点击播放。前 2 秒无控制，随后学习；曲线和道路读取同一音频时钟。
4. 选择四个座位之一，在对比原噪声和对比 RNC 结果间切换。时间不回退，共用增益和约 30 ms 交叉淡化。
5. 修改 taps、μ 或种子后点击计算新实验。计算在 Worker 中完成；来源变为浏览器计算。设 μ=0 可验证没有降噪。
6. 计算失败会显示错误并暂停。旧实验保留原 runId、来源和参数，仅在手动点击播放后继续，不冒充新结果。

查看REF x或OUT u仅切换图表，当前座位的d/e试听保持不变，图表上方分别显示两者；改变试听座位或d/e模式会回到对应MIC图表。RMS不足0.5秒、PSD不足0.512秒时显示准备中。窄窗通过页面纵向滚动访问四点指标和播放控件。

试听信号是误差点的 d/e，不是扬声器驱动 u。Pa 转音频的固定增益为 2，两路使用相同 16 kHz 重采样；音量默认为 25%。合成 SPL 参考 20 μPa，降噪为同窗功率比，四点总指标先合功率再求比值。

## 离线演示包

`pnpm build` 后，分发 `dist/`、`scripts/serve.mjs`、`启动演示.cmd` 和本 README，保持相对目录。目标电脑安装 Node 后双击启动演示.cmd，打开 http://127.0.0.1:4173；也可在包目录执行 `node scripts/serve.mjs`。此服务器仅监听本机，无需 node_modules，无需联网。

不能直接双击 dist/index.html，ES 模块和 Worker 需要 HTTP。GitHub CI 成功后会提供 rnc-browser-build 下载工件。它不是已通过整体验收的正式发布版。

本轮组合候选包验证代码为`838cdf3`，由A1 `45fe841`及A2 `2760f43`组成；代码与main的合并状态、原始验证及设备边界见[本机交付验收](docs/evidence/A1/A1-004/README.md)。独立分支的CI包只包含该分支，完整组合包需使用同一候选快照，不应把单角色工件当成完整组合。

## 协作与验收

- 分支建议 a/app-*、a/viewer-*、b/engine-*、b/analysis-*，每天至少集成一个可运行变更。
- 提交钩子检查源码越界和开发记录是否同时暂存；GitHub CI 在 push / PR 上重复检查。
- 管理员可把 verify 检查设为 main 必须通过的分支规则；本工程没有修改远端仓库设置。钩子 / CI 不能保证记录真实，仍需评审。
- 参考文件不能覆盖；新实验写到 test-results/，复现错误附代码 SHA、runId、配置和实际结果。
- 当前验证证据及未验收项见 [验收记录](docs/验收记录.md)，多 AI 交接模板见 [协作开发指南](docs/协作开发指南.md)。
