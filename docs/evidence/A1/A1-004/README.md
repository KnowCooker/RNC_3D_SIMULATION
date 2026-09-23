# A1-004：组合候选稳定性与本机离线包验证

本报告针对组合提交 **838cdf38503cb2a8dc7512ace28f7894d3f283c9**（A1 45fe841 + A2 2760f43；当时原仓库 main d4e191b）。它是独立组合候选，不能据此把两个角色 PR 写成已合入 main。产品代码在验证期间冻结。

可访问源码：[冻结候选分支](https://github.com/lzhdai/RNC_3D_SIMULATION/tree/a/candidate-20260923)。复现以完整提交 SHA 为准。

## 实际结果

- `pnpm check` 通过：类型检查、源码边界、22/22 工程测试、生产构建。现有约 525.5 kB 主 chunk 体积提示不影响构建。
- **I08 本机长稳通过**：2026-09-23T14:13:01.279Z 至 2026-09-23T14:33:05.662Z，驱动实际经过 **1203.85 秒**，浏览器单调时钟经过 1204.38 秒。未使用假时钟、强制 GC、替代引擎或音频增益修改。
- 完成 10 次真实 Worker 重算，使用三种子、32/64 taps、μ=0/0.08；每次核对新 runId、来源和请求配置。完成 102 次实际座位变更、26 次实际 d/e 变更、63 次重播；共 103 次分段采样。
- 未捕获到页面未处理错误、Promise 未处理拒绝或 WebGL context loss；所有重算完成，未观察到卡死或队列累积。控制台仅见既有 favicon.ico 404，不属于产品脚本异常。
- **本机生产包网络隔离启动 3/3 通过**：三个全新浏览器 context 分别载入默认参考并播放，再以 seed=11/29/47 真实重算并播放。非 loopback HTTP(S) 请求全部阻断；产品外网请求 0、请求失败 0、pageerror 0。系统网络没有关闭，因此这是同机浏览器网络隔离验证，不替代真正断网或第二台 Windows 的 I09。

## 资源趋势

Live DOM 始终 218 个元素，canvas 始终 4 个；Three 几何计数启动时 101，首次完整呈现后为 118，随后稳定；贴图计数 0。几何的首次变化是按需上传，未按单个峰值判断泄漏。

JS heap 在 8.31–42.21 MiB 间随自然 GC 回落。第 2–4 分钟窗口平均 30.11 MiB，最后 2 分钟平均 27.75 MiB；未观察到明显持续增长。CDP DOM 计数含未回收的脱离节点，不能和实际挂载 DOM 混为一谈。这些是诊断趋势，不是形式化内存泄漏证明。原始采样见 `stability-samples.jsonl`，完整汇总见 `stability-summary.json`。

## 真实环境与边界

Windows 11 家庭版 build 26200；Intel i7-12800HX（16 核 / 24 线程）；约 16 GB RAM；Node v24.13.1；pnpm 11.19.0；Chrome 153.0.8010.48。浏览器实际 GPU：ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU (0x00002820) Direct3D11 vs_5_0 ps_5_0, D3D11)。

这是 RTX 4070 Laptop 的同机结果，**没有验证基础核显或第二台 Windows**。没有测量实物听感、爆音、声卡输出或物理音画偏差≤100 ms。Web Audio 进度递增只证明浏览器传输流程可运行。目标设备项目仍须分别验收。

## 候选包与复跑

生产包仅含 dist、本地 Node 服务器、Windows 启动脚本、README、候选版本与验证说明；不包含 node_modules 或 Node 本体。目标机需要 Node≥22.12。通过 Node HTTP 服务运行，不可双击 dist/index.html。

`candidate-version.json` 给出构建组合 SHA、Node/pnpm 版本与每个 dist 文件的 SHA256。离线生产测试从独立包目录启动端口 5176。

复跑：在同一代码版本运行 `pnpm check`，复制 README 规定的包内容并执行 `node scripts/serve.mjs`（可用 PORT=5176），以 Playwright CLI 会话 `rnc-final-qa` 打开页面并 snapshot，然后运行 `run-stability.ps1`。驱动每约 10 秒通过真实 UI 选择座位/声音，每 120 秒重算，共持续至少 1200 秒；汇总使用 `node summarize-stability.mjs`。网络隔离脚本为 `offline-three-starts.js`，需在另一会话通过 CLI run-code 执行。

脚本中的 `__THREE_DEVTOOLS__`、错误监听和采样状态只注入测试浏览器。产品中没有新增 QA 全局变量或调试接口。

归档脚本按原执行位置编写：复跑前将脚本复制到新建的`output/playwright/final-qa/`目录，更新`run-stability.ps1`中的本机Playwright CLI路径；使用新的浏览器会话与空的采样输出，避免向旧JSONL追加。原始脚本保留，便于核对实际执行。

A1交互与生命周期恢复见[上一项证据](../A1-003/README.md)；A2性能与复位证据见[A2交接](../../../coordination/A2.md)。B2导出API尚未交付，UI接入另立任务。
