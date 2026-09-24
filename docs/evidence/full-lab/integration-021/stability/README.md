# INTEGRATION-FULL-021 组合版20分钟长稳

本次运行的组合源码为 `d45c469224ed08abd271f8434c16963bdd0fe2c8`，测试开始时文档提交为 `e87753d98ec8ca5108be4833f5080e0713a35ab7`；期间未改运行源码或 `dist`。测试使用冻结的生产构建和实际 Worker、Web Audio、WebGL；复现入口为本目录 `run-stability.ps1`、`stability-setup.js`、`stability-step.js`、`summarize-stability.mjs`。原始[配置](run-config.json)、[前后构建清单](build-manifest.json)、[源码清单](source-manifest.json)、[逐次采样](stability-samples.jsonl)和[汇总](stability-summary.json)均已保存。

实际单调时间 **1210.65秒**，110次采样；14个真实就绪实验（7次预计算、7次实时），包括12次额外重算/重启；110次座位切换、110次d/e切换、39次播放/恢复/重播。首个实时run连续生成387.4秒，16秒后1857个对应轮端源块均是新数据、重复0。15项长稳门槛均通过：前后生产文件哈希一致、4096样本快照与音频队列有界、单一活动Worker、无页面异常/未处理拒绝/数值违规/Worker错误/WebGL丢失，抽样堆内存无明显持续增长。控制台原文见[browser-console.txt](browser-console.txt)，结束画面见[stability-finished.png](stability-finished.png)。

首个实时run仍有**2次补缓冲**：约34.6秒首次空间视图操作附近观察到最长约520 ms主线程帧；约353.5秒脚本切换标签页附近观察到约1000 ms调度停顿。二者仅为时间上的关联，未证明唯一原因；播放器等待缺块并接续真实样本，不能据此声称无可感知音频断续。其他重启实验的补缓冲计数各自归零；汇总最大值2不代表全场仅抽样了两次以外的每个音频事件。

环境：Windows本机、Headless Chrome 153、NVIDIA RTX 4070 Laptop GPU，1920×1080视口；非目标核显。浏览器切换标签页时原页仍报告 `visible`，因此真实后台暂停未验证。测试通过普通产品按钮静音，真实音频节点仍调度；不证明实物听感、爆音或≤100 ms物理音画偏差。该结果只覆盖此组合运行版本，后续A1音频或A2模型源码改变后须重新验收最终版。

复跑：从仓库根目录把本目录的四个脚本复制到新建的 `output/playwright/live-stability-021`，保持其相对仓库根目录为三级子目录；构建并启动不可变生产包后，运行 `powershell -NoProfile -File output/playwright/live-stability-021/run-stability.ps1 -Url http://127.0.0.1:5186/ -Revision '<精确提交SHA>' -DurationSeconds 1200`。新运行目录不得已有结果，以免覆盖原始证据。Playwright CLI路径可用 `-CliPath` 指定；运行器会自行创建独立浏览器并保存新清单及结果。
