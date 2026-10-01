# B2-003 lab-v3 结果容器验收

2026-10-01；Role: B2；Identity-Source: user-declared；执行者Codex。接班基线main `33fbddca6b605b521f38a4bcfee7dc828f43fc04` 已合并#53，B1停止写入，开放另一个任务仅A2#30。分支 `b/b2-003-lab-result`；认领 `2d5271d` 先推送并建立[草稿PR#54](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/54)，复查无B重复后开发。

新增独立lab结果接口，复用既有配方身份/缺省规则，沿用RNCRSLT1容器布局，通过modelSchema区分。q4/x1～8/u/d/a/e各4路Float32小端保存；原配置、来源/runId、计算耗时、模型/录音身份、通道单位/稳定ID、请求及实际时长、完整或发散状态均往返。不改demo接口和文件编码，也不修改运行引擎/指标公式或共享契约。

| 验证 | 实际结果与证据 |
| --- | --- |
| 专项及既有分析 | 最终60/60，新增14项，含5秒窗口及999点warming-up，见[analysis-test.txt](analysis-test.txt) |
| B组 | 117/117，见[test-b.txt](test-b.txt) |
| 全仓 | 207/207，类型/目录边界/生产构建通过，既有viewer大块提示保留，见[check.txt](check.txt) |
| 矩阵与保真 | 四车型×两源×1/4/8参考24案例，加旧缺省μ0/RNC关闭/部分输出/发散/5秒指标窗，共29；同步与异步每项2789816个值逐位一致，两种编码完整文件逐字节一致，元信息/原指标保留且输入未改/数组独立，见[comparison.json](comparison.json)、[audit-run.txt](audit-run.txt) |
| 状态/有效性 | μ2请求6000实际2909，有限前缀保留；人工空前缀无最后样本时间和有效指标，999点短前缀按既有1000点分析门槛warming-up。NaN/±Infinity/负零原指标标签往返，自报不一致指标隔离；静音/空窗不可用，真实有声μ0可为有效0dB |
| 坏输入/竞态 | 身份/配置/通道单位和映射/重叠/长度/时间/状态/额外脚本/坏UTF-8/坏标签/非有限载荷拒绝；预算在复制或调用crypto前核对。encode等待期间修改配置/源/参考/指标不影响文件；decode原Buffer改写/转移不影响结果；失败原样传播 |
| 真实浏览器 | Windows Chromium154生产module Worker、Web Crypto15/15；四车型双源1/4/8参考776000值及指标/元信息一致，发散/非有限原指标/异步快照/坏哈希/预算通过，见[browser-report.json](browser-report.json) |
| 浏览器控制台 | 最终重载后error/warn为空数组，见[browser-console.json](browser-console.json) |
| 版本与冻结 | [source-integrity.json](source-integrity.json)绑定运行/测试/审计脚本、规范化报告文本及最终生产构建SHA。17项lab模型源码哈希仍匹配原注册表，8个冻结文件未改 |

第一次浏览器校验失败，见[initial-browser-failure.json](initial-browser-failure.json)：验证脚本用JSON字符串比较配置，将解码后的规范字段顺序差异当成数据差异。改为字段递归比较，保留数组顺序、所有值与严格信号/指标比较；最终重载15/15。仅修正证据脚本，不改变API或数值容差。没有将首次失败写作成功。

原指标以标签完整保存。已知模型/布局用B的meanPower和登记的末尾最多4秒/Z/历史底限语义核对；结果保持原raw指标，另给各点/合功率测量有效性及rawMetricsMatch。自报不一致指标不作为可信摘要，而以raw-mismatch或nonfinite隔离，不修改原样本/原指标；不拒整份可读信号是为保留诊断原始数据。未知模型/布局verifiedMetrics=null，禁止接当前声场/实验或自动重算。文件/素材哈希只查损坏，不认证来源。

## 复现

```text
pnpm exec tsx --test tests/analysis.test.ts
pnpm test:b
pnpm check
pnpm exec tsx docs/evidence/B/B2-003/lab-result/run-audit.ts
pnpm exec vite build --config docs/evidence/B/B2-003/lab-result/vite-audit.config.ts
pnpm exec vite preview --config docs/evidence/B/B2-003/lab-result/vite-audit.config.ts --port 5174 --strictPort
```

在仓库根执行，审计保存到忽略的test-results/B2-003-lab-result/comparison.json，拒绝覆盖已有结果；可在新检出目录复验，或传入test-results/B2-003-lab-result-新小写后缀/comparison.json（ASCII字母/数字/连字符），不写fixture。本批最终审计使用test-results/B2-003-lab-result-final/comparison.json保留先前输出。打开 `http://127.0.0.1:5174/docs/evidence/B/B2-003/lab-result/browser.html` 查看15项passed。浏览器只读取本机构建录音并移交Worker，不上传用户数据。API无文件、网络或DOM操作；验证页/Worker/config仅独立证据，不进入产品装配。

配方/文件sourceCommit注入已合并基线33fbddc，检验声明字段，**不是基线已含新接口的声明**；实际新版本由源码/产物哈希和交接实现提交定位。文本SHA按UTF-8/LF，与Git规范化一致；产物/素材/冻结文件按原始字节哈希。

## 未完成项与交接

本批完成lab结果接口验收，完整B2-003仍待A1正式文件UI/Worker/取消/实验身份隔离及峰值内存/目标设备/第二机验收，B1正式布局审查独立。64MiB容器/64KiB元数据限制不代表实际堆峰值；异步解码额外持有容器副本，原输入+副本+输出信号为下界，未测设备内存/耗时。拒实时快照和续算，不自动加载录音/复算/生成空间场。

范围只B export、B既有测试入口/帮助文件、B说明/证据及两日志；引擎、已登记数值模型、shared/integration/A/根配置/冻结fixture未改。本批推送可审查后停止写入，维护者合并再按B串行接续，B2-004未认领。不自动合并main。
