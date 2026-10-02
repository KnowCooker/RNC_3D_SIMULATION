# B2-003 lab-v3 批量配方验收

2026-10-01；Role: B2；Identity-Source: user-declared；执行者 Codex。用户授权继续；基线 main `181952687d6fb303e540e9f1b3981d228b52e744` 已合并 #52，B1 最新交接停止写入，开放另一任务仅 A2 #30。分支 `b/b2-003-lab-recipe`；先推送认领 `efdc0d8` 和[草稿 PR #53](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/53)，复查无 B 重复后开发。

新增 B 纯 TypeScript 配方编码、严格解析和异步从零复算。沿用已经合并的教学布局/算法；记录原配置与历史缺省规则、数值源码哈希、完整录音 SHA/读取规则、请求样本数、参考稳定身份及运行来源。复算入口单独拒绝未知布局/模型，录音全字节验证后使用原读取器；不回退随机源，不恢复实时状态，发散只返回有限前缀。

| 验证 | 实际结果与证据 |
| --- | --- |
| 专项与既有分析 | 46/46，新增13项，见 [analysis-test.txt](analysis-test.txt) |
| B 组 | 103/103，见 [test-b.txt](test-b.txt) |
| 全仓 | 193/193；类型、目录边界及生产构建通过，既有 viewer 大块提示保留，见 [check.txt](check.txt) |
| 配方矩阵 | 四车型 × 两类源 × 1/4/8路参考，共24配置，加1发散配置；25案例、2405816个Float32值哈希一致，配置/素材未改，指标和发散元信息严格相等，见 [comparison.json](comparison.json)、[audit-run.txt](audit-run.txt) |
| 行为边界 | 旧配置省略模式/布局/偏移，RNC关闭、μ0、全部/部分扬声器关闭、seed29/47、taps16/128，负改善和发散；缺素材/错误长度/坏哈希/错误身份、未知布局/模型、脚本/额外字段、实时模式、预算、异步配置/素材快照及失败传播，见专项测试 |
| 真实浏览器 | Windows Chromium154，secure context；生产 module Worker / Web Crypto 15/15；四车型双源768000值逐位一致，录音完整SHA、发散、坏哈希/缺素材、未知布局先拒及原buffer转移验证，见 [browser-report.json](browser-report.json) |
| 浏览器控制台 | 最终构建重载后 error/warn 返回空数组，见 [browser-console.json](browser-console.json) |
| 源码/素材/冻结版本 | [source-integrity.json](source-integrity.json)绑定本批运行/测试/验证脚本、报告和最终生产构建的SHA；17项模型源码哈希匹配，素材SHA匹配，8个冻结基准未改 |

μ2、3秒 shaped 配方实际在2909处发散，请求6000点只返回2909点；不补齐剩余数组，不把状态写成 completed。验证是对现有教学引擎的确定性复算；不是 lab 独立数值正确性/物理标定证明，不替代 B1 的正式布局审查。demo 冻结回归及此前 B1 对照仍通过。

首次单独类型检查发现 ReferenceSensor.position 的数组推断问题，修正为明确三元组；成功日志见 [typecheck.txt](typecheck.txt)，后续全仓检查成功。未改正常计算公式、A/shared/integration/根配置/冻结fixture。测试接到已有 analysis 入口，错误类移至同一 B export 模块并原名重新导出，既有 demo 测试持续通过。

## 复现

在仓库根目录执行：

```text
pnpm exec tsx --test tests/analysis.test.ts
pnpm test:b
pnpm check
pnpm exec tsx docs/evidence/B/B2-003/lab-recipe/run-audit.ts
pnpm exec vite build --config docs/evidence/B/B2-003/lab-recipe/vite-audit.config.ts
pnpm exec vite preview --config docs/evidence/B/B2-003/lab-recipe/vite-audit.config.ts --port 5174 --strictPort
```

审计脚本只在忽略的 `test-results/B2-003-lab-recipe/comparison.json` 保存新结果，若已存在则拒绝覆盖，应在新的检出目录复验；不写冻结fixture。浏览器打开 `http://127.0.0.1:5174/docs/evidence/B/B2-003/lab-recipe/browser.html`，检查15项passed=true。页面只在本机读取构建包含的录音文件，将字节移交独立Worker，不上传/下载用户数据。构建及原始页报告已记录；浏览器报告由工具读取并保存，非脚本伪造。

测试配方 sourceCommit 注入已合并基线1819526，用于检验来源字段，**不宣称基线已经包含新API**；本次真实代码版本由 source-integrity 的规范化源码哈希和最终提交绑定。computeMilliseconds 不要求一致；所有信号、配置和指标不得用耗时差异豁免。

## 未完成项与交接

本批仅实现教学 lab 批量配方，不宣称完整 B2-003 完成。lab 完整结果二进制容器、原指标无效值/单位/动态通道的导入验收仍待接续；A1 文件 UI/正式 Worker/取消/实验隔离、峰值内存/目标设备性能/第二机单列待测。64MiB预算只限制返回信号，不包含引擎/素材/中间数组，因此不代表堆峰值。未知写实布局仍由 B1/指定集成者审查；无共管接口修改或布局签收。

提交推送及将#53转可审查后，本批停止写入；维护者审查合并，再按B串行流程接续。B2-004仍未认领；不自动合并main。
