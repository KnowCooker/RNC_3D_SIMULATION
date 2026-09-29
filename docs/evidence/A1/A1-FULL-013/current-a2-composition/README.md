# A1 #38 + A2 #30 当前提交的隔离组合验证

2026-09-29；Role: A1；Task: A1-FULL-013；Identity-Source: user-declared；执行者：Codex 代 A1。此目录只记录本地隔离工作树的组合检查，不改变 A2 分支，也不表示 PR 已合并或写实车已完成声学配准。

## 固定输入

- 原仓库 main：`cb3d84316a4b9906d490f17d684de006c51532c1`。
- A1 [PR #38](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/38)：`1bed62d8b2982afcd166f85dcf8b0cfdfc372a04`。
- A2 [草稿 PR #30](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/30)：`d8e27178ca634c75e17448a2bb98fd1f1a7f85f7`。
- `git merge-tree --write-tree HEAD origin/pr-30` 生成 `7c3ccb79692e4c0baa9d026920f1c0b21a7d7b2f`，无文本冲突；隔离工作树中从 A1 提交执行 `git merge --no-commit --no-ff origin/pr-30`，未提交或推送合并结果。
- Windows、Node `v24.13.1`、pnpm `11.19.0`、Playwright CLI Chromium `153.0.8010.53`；浏览器视窗 `1280×720`。本机浏览器检查不是指定核显验收。

## 实际检查

锁定依赖安装成功。组合版 `pnpm check` 的 TypeScript、A/B 边界、**139/139** 全仓测试及生产构建通过。Vite 仍提示 viewer 分块超过 500 kB；本批没有把提示隐藏。构建文件 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| `dist/index.html` | `7BA7A165E4EA3860983F6BAACCB247BE5A380D4C72CAD92C9C09AAD6BBA5D77A` |
| `dist/assets/viewer-Crt6eMbq.js` | `9E8A75A0437CF1D3D58FB4CA9B9B8D1E519D7C98F6E8918B8FBB691CD1947E0D` |
| `dist/assets/index-B1RB_RK6.js` | `8D0B646D61B1786D36F5856B757ACF66BB24CF5268AA70A789730B1E4B7B371D` |

生产版在本机端口 5186 运行。用 [`qa-current.js`](qa-current.js) 从首页选择 ICE 写实车，展开同资产检视，拆出左前座椅与头枕，切车间、透明和纵剖，再切道路、回装并返回教学实验。随后 10 秒预计算、定位末尾、显示声场；[原始 CLI 结果](qa-current.log) 中页面异常和失败请求均为 0。对应[车间截图](current-ice-workshop.png)与[教学声场截图](current-ice-field.png)。

用 [`qa-four-live.js`](qa-four-live.js) 从首页分别完成 ICE/BEV/HEV/EREV 10 秒预计算和末尾教学声场，四次结果都显式标记 `teaching-fixed-v1`。随后 BEV 实时场到约 2.06 秒，状态显示缓冲 1.21 秒、补缓冲 0 次；[原始 CLI 结果](qa-four-live.log) 中页面异常和失败请求均为 0，[实时截图](current-bev-live.png)。浏览器控制台只有既有 `favicon.ico` 404，未见应用脚本异常。

这些检查证明**当前两个 PR 的特定提交可在本机工程和所列页面流程中组合运行**。它们不证明每个四车型写实资产已存在，也不证明写实车与教学声场共用物理坐标。写实模式仍明确不投影教学声场；ICE 写实资产只有已辨认的 30 组几何，HEV/EREV 尚无同等级资产。A2 需提供各资产核实的安装锚点；B 组需按该布局重算 H/S/声场并验证；A1 才能开放新布局并做完整同车回归。A1 #38 仍待 B1 共管接口审查，A2 #30 仍为草稿。最终版 20 分钟长稳、目标核显、实物音画、第二台 Windows 断网与正式发布包未在本批检查。

复现：从上述 A1 提交建立隔离工作树，合入上述 A2 提交但不提交，运行 `pnpm install --frozen-lockfile`、`pnpm check`；在 PowerShell 设置 `$env:PORT='5186'` 后运行 `pnpm start`，再按 Playwright CLI 会话运行本目录两份 `run-code --filename` 脚本。脚本中的固定端口仅供本次本地证据复现，端口不同时替换 URL。
