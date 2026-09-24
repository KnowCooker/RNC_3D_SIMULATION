# A1-FULL-008 固定候选20分钟长稳

运行源码为 `2512c471e51330d692da68344d0f06a04389b111`，生产构建在测试前冻结且前后逐文件SHA-256一致。测试使用实际 Worker、Web Audio 和 WebGL，脚本为本目录 `run-stability.ps1`、`stability-setup.js`、`stability-step.js`、`summarize-stability.mjs`；[原始配置](run-config.json)、[前后构建清单](build-manifest.json)、[源码清单](source-manifest.json)、[逐次采样](stability-samples.jsonl)、[最终汇总](stability-summary.json)、[截图](stability-finished.png)和控制台原文均已保存。

实际单调时间 **1204.22秒**，14个真实就绪实验（7预计算、7实时），含12次额外重算/重启；108次座位变化、108次d/e切换、39次播放/恢复/重播。首实时run持续产生385.4秒数据，16秒后1847个轮端源块均为新数据、重复0。15项既定稳定性门槛全部通过：快照4096样本、音频队列和源数有界，单一活动Worker，无页面/Worker/数值异常或WebGL丢失，抽样堆内存无明显持续增长。

本批音频队列抽样 **1.18–1.39秒**，活动音频源最多7个，首实时run及后续重启实验的补缓冲抽样最大值均为 **0**。同一测试协议下，[组合基线](../../../full-lab/integration-021/stability/README.md)运行1210.65秒、15项门槛通过，但首实时run有2次补缓冲；两次运行的持续时间和操作顺序相近，运行时负载不完全相同。另见[同脚本1.05秒阻塞与首次三维操作对照](../README.md)：基线累计2次，候选0次。

环境为 Windows 本机、Headless Chrome 153、NVIDIA RTX 4070 Laptop GPU，1920×1080视口。测试前半段对照用的两个其他浏览器会话仍开着，约640秒时关闭；因此不宣称机器完全独占。标签页切换时原页仍报告 `visible`，真实后台暂停未验证。产品按钮静音但Web Audio调度仍运行；0次抽样补缓冲不等于实物没有爆音或音画偏差≤100 ms，也不证明目标核显性能。

复跑时从仓库根目录复制本目录四个脚本到新的 `output/playwright/live-stability-a1-008`，其相对仓库根目录须为三级子目录；构建并启动不可变生产包，再运行 `powershell -NoProfile -File output/playwright/live-stability-a1-008/run-stability.ps1 -Url http://127.0.0.1:5187/ -Revision '<精确提交SHA>' -DurationSeconds 1200`。新运行目录不可已有证据，避免覆盖原始结果；可用 `-CliPath` 指定Playwright CLI入口。
