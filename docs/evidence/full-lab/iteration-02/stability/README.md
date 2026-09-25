# lab-v3 长稳结果与复跑协议

## 正式20分钟结果（2026-09-24）

**正式长稳15项门槛通过；真实前后台暂停仍未验证。两项结论分开，不把短测未通过写成长稳通过的一部分。**

运行源码对应提交 **`6e982b7dbb5220aa2dfbdc3395a60fb8cbc7c99a`**，已推送 PR #7。测试启动时源码尚未提交，原始配置保留认领基线 `79df17b` 加规范化 `sourceDigest=c2e43d7994ac8941ca7f820546010e1d28a23dc3d2590d5cd90fecb9ca7f90f1`；提交后以 `git diff --exit-code 6e982b7… -- src tests package.json pnpm-lock.yaml` 实际核对无差异。`frozen-version.json` 保存协调者的完整冻结清单，测试自己的清单哈希算法/包含范围另见 `run-config.json`，两种摘要不应直接混比。正式测试前后全部生产文件 SHA-256 一致；未修改运行源码、重建生产包或替换真实计算。

- 主机单调时钟实际 **1207.85秒**，106次采样；14个真实 ready 实验（7次批量、7次实时），其中主动重算/重启12轮；106次实际座位变化、106次 d/e 变化、39次播放/恢复/重播，观察到7560条真实 Worker 消息。
- 首个实时实验同一 runId 生成 **389秒 / 778000样本 / 1945块**，页面采样已看到377.41秒；16秒之后1865块轮端源指纹均与首16秒对应位置不同，重复0。块索引连续，无替换结果、循环录音或加速时钟。
- UI历史快照保持不超过4096样本；实时队列采样 **0.39–0.60秒**；活动音频源采样1–3个。JS heap采样 **15.0–55.4 MiB**；首连续段60–130秒平均40.6 MiB，260–335秒平均30.4 MiB，未见明显持续增长。此为有界资源和采样证据，不是无内存泄漏的形式证明。
- 脚本异常、未处理拒绝、Worker计算错误、无效声场、分块连续性违规和WebGL丢失均0。控制台仅记录浏览器自动请求 `/favicon.ico` 的404，原文保留。
- 正式长稳观察到 **2次补缓冲**，未宣称零断续：第1次在35.63秒首次切换实体车身/X剖面/场纵切片附近，最近最大帧间隔593.9ms；第2次在约353.8秒新标签页短暂抑制rAF附近。缺块时播放器冻结并接续实际样本；关联不等于已经证明唯一原因，首次显示准备造成的瞬态仍值得优化。
- 实际环境为 Headless Chrome 153、NVIDIA RTX 4070 Laptop GPU；视口1920×1080，三维绘图缓冲1588×618。该结果不替代指定核显、1280×720性能验收、实物听感/音画延迟或第二台Windows测试。音频通过普通产品按钮静音，真实调度仍在运行。

正式数据：`stability-summary.json`、`stability-samples.jsonl`、`stability-progress.json`、`stability-finished.png`、前后build清单、source清单和`browser-console.txt`。`smoke-*`为单独23.63秒脚本检查，不计入20分钟；其未达到长稳门槛的布尔值按原样保留。

校验说明：`run-config.json`的`buildManifestSha256`和`sourceManifestSha256`来自`Get-ManifestHash`对解析后的清单执行`ConvertTo-Json -Depth 8 -Compress`再取UTF-8 SHA-256，不是格式化JSON文件的原始字节摘要。按该方法复核两项均匹配；直接对格式化文件执行Get-FileHash会得到不同值。目录`.gitattributes`保留JSON/JSONL原始字节，跨平台读取时仍按上述语义核验。

## 独立真实可见性探测（未验证）

长稳保存并关闭后，另开 headed Chrome 153，会话`rnc-live-visibility`，运行同一冻结生产包：

- 真正新建/激活其他标签页后，原页 `document.visibilityState` 仍为`visible`、`document.hidden=false`，真实`visibilitychange`事件0。`real-visibility-results.json`的可见性门槛未通过，不能以无异常替代通过；独立标签页短测累计7次补缓冲。
- 随后使用`Browser.setWindowBounds`真正最小化Chrome窗口；`Browser.getWindowBounds`确认`windowState=minimized`，但文档仍报告`visible/hidden=false`、事件0。`real-window-visibility-results.json`同样保留`passed=false`；窗口在finally恢复，未注入可见性值或事件。
- 独立短测结束时累计9次补缓冲，详见`visibility-final-state.json`。这9次属于另一浏览器/另一实验，**不混入正式20分钟的2次**。源样本仍连续、实验身份保持、脚本异常0。
- 当前环境未产生待验的真实hidden条件，所以“后台暂停、返回等待手动继续”仍须在能够真实改变可见性的环境验证；不判成产品已通过，也不能据此断言产品隐藏事件处理失效。没有再扩大工具尝试，两个测试浏览器均已关闭。

可复跑短测为`real-visibility.js`和`real-window-visibility.js`，对应初始快照、截图、JSON和控制台均保留。原始长稳配置和summary参数未修改。

## Reproducible protocol

Prepared 2026-09-24. The recorded run above is complete; a new run only passes after its own result files exist and all declared gates pass.

Start only after the coordinator freezes a production build and supplies its URL and version. Keep that production directory unchanged until completion. Source/build manifests and hashes are recorded before the run; the complete build manifest is compared after it. The test observes the actual app, actual Worker messages and actual Web Audio node schedules without replacing calculations.

```powershell
powershell -NoProfile -File output/playwright/live-stability/run-stability.ps1 -Url http://127.0.0.1:5180/ -Revision '<frozen revision / source identity>'
```

If the CLI is installed elsewhere, add `-CliPath '<absolute path to playwright-cli.js>'`. Pass `-BuildRoot` if the production server uses a directory other than the repository `dist`. The session is exclusively `rnc-live-stability`; the runner never stops servers or other browser sessions. Existing evidence is protected against accidental overwrite. Archive a prior run to a separate directory before rerunning.

The runner starts its independent browser, samples every approximately 10 seconds and prints progress every sample. It uses a monotonic host stopwatch and real browser clocks for at least 1200 seconds after setup. A process/session handle remains available for periodic nonblocking status polling. Each individual UI operation uses bounded waits; no fake clock is used. A failing invariant preserves the sample and sets status `failed`.

Coverage:

- Preserve the first live experiment for over 330 seconds, verifying monotonically contiguous real sample indices and differing wheel-source block hashes after 16 seconds.
- Observe bounded 4096-sample UI snapshots, one live Worker, live audio source counts/bytes and UI queue depth. Record errors, rejected promises, field failures and WebGL context loss.
- Then make 12 real experiment starts/recomputations through UI controls, alternating batch/live, all four vehicle types, taps/step/speaker variations. At least 20 actual seat changes, 20 d/e changes and 20 play/resume/replay actions are required.
- Exercise body/section/explosion/field slice views throughout; record viewport, drawing buffer, actual GPU, renderer resources, heap/DOM and recent real frame intervals.
- Try a real tab background/foreground transition after 345 seconds. If headless Chromium never hides the tested document, preserve that fact as unverified rather than faking visibility.
- Retain final screenshot, JSONL samples, summary, setup, progress, source/build manifests and console output. The summary separately lists every gate and limitation.

Preparation smoke can be run by the coordinator using `-SmokeOnly -DurationSeconds 15`; outputs are prefixed `smoke-` and never qualify as final stability evidence. This protocol has no claim about target integrated graphics, actual audible sound, physical AV latency, or a second machine. Audio is muted using the ordinary product UI while its real transport continues.
