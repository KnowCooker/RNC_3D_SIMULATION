# B2-004 注册模型候选交付报告增补

2026-10-05；Role:B2；Task:B2-004；Identity-Source:user-declared；Executor:Codex。认领 `3d8bdb17157acd32479e8876a56f4d7550d79614`，交付 [PR #62](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/62)，base 为 A2 `a/a2-driving-experience`。

本报告绑定候选 `795d9095eb8996da2938a7513bbcaa435a18d8e8`，已经包含 B2 #60 注册模型兼容和 #61 真实浏览器证据。正式 main 仍为 `b968d926ce343cb4568e00bdb14da4e87bdd6fc6`，已包含 #55 旧教学报告。**这是候选数据报告增补，完整B2-003/最终B2-004没有签收。** 本批不改运行源码、原测试、旧报告或冻结基准。

## 版本与证据

| 证据 | 不可变提交 | 适用范围 |
| --- | --- | --- |
| [#55旧阶段审计](../audit.json)、[旧报告核验](../verification.json) | main b968d92 | 基线93ed882，lab model-1；旧demo数值与固定教学数据结论保留，不拿旧哈希验证新模型 |
| [#60注册模型Node矩阵](../../B2-003/registered-compat/comparison.json) | #60合并3821009 | model-2、30组短案例，每种对照1460000个Float32值 |
| [#61真实Worker报告](../../B2-003/registered-worker/browser-report.json)、[源码/构建/报告绑定](../../B2-003/registered-worker/verification.json) | #61合并795d909 | Windows内嵌Chromium154，218检查、30组与Node逐路哈希一致；独立生产Worker，不是正式产品文件流程 |
| [本批16秒审计](audit.json) | 当前实现由审计源码哈希及后续提交绑定 | 10组默认长度、数据维度/时标/单位、文件往返、配方复算和A/Z分析；Node实际执行 |

`run-audit.ts` 将前五份报告的UTF-8/LF内容与所列Git提交逐份比对，再核对旧报告自己的文件哈希和新Worker的源码/报告哈希。新注册模型17项源码登记及demo登记均与当前文件一致。旧源码模型改变的事实保留，旧报告仍独立有效，未重新生成或改写它。

## 实际数据核对

五种注册布局×合成/录音两声源，使用各自 `defaultXPengConfig`：16秒、2000Hz、四参考、四输出、四误差点、seed11、taps64、步长0.08、四输出开启；其他固定输入完整保存在audit.json。10组全部完成32000点，无发散。每组三类对照均逐位一致：同步结果导入、异步结果导入、从零配方复算；每种对照总计 **7680000个Float32值**。同步/异步容器逐字节一致。

| 项目 | 本批实际结果 |
| --- | --- |
| 信号维度 | q/x/u/d/a/e各4路，总24路，每路32000点 |
| 原始载荷 | 每文件3072000字节，Float32小端 |
| 实际容器 | 3079412～3079864字节；manifest随布局、配置和来源元信息变化，不设虚假固定长度 |
| 时标 | [0,16)，最后样本15.9995秒；计算耗时不参与确定性判定 |
| 原指标 | 24000～32000点、4秒末窗、Z计权；与0.5秒A/Z分析窗口分别记录 |
| 配方身份 | 原runId关联保留，新复算runId独立；原levelOffsetDb缺省保留，规范化值明确为0 |
| 模型/布局 | 当前model-2及匹配动力类型layoutId；modelSupported/layoutSupported为true |
| 分析 | 0/.4995/.5/16/16.5秒 × A/Z × 六信号，每组60帧；600帧在同步、异步导入上均与原结果完全一致，时间夹紧/预热/单位/频谱计权核对 |
| 录音 | 原RNQ1完整长度与SHA不变；只有录音复算请求素材，无随机替代 |
| 旧model-1 | 实际旧结果只读，verifiedMetrics=null，复算在resolver访问前拒绝 |

各路小端SHA、通道ID/单位、实际容器长度、原指标与分析帧见audit.json。算法数值正确性独立审查仍由B1负责；本批相同引擎的复算/往返证明数据交付一致，不等于实车效果验证。B01～B06的demo独立Python判据沿用[旧报告矩阵](../README.md)，不扩张到五车新路径；B07的B数据入口已有证据，产品生命周期仍待A1同版验证；B08目标设备性能仍待测。

`estimateLabExport` 的本批下界为原信号+文件，约6151412～6151864字节；异步编码快照、解码副本、路径/权重、录音及临时分配会增加实际驻留。该估算不是峰值内存测量，也不是最大配置验收。

## 检查与复现

`pnpm test:b`125/125；`pnpm check`295/295，类型/边界/构建通过；独立审计strict tsc通过。命令日志保存在本目录。首轮脚本误用估算字段名，strict tsc检出；仅脚本改为实际 `minimumResidentSignalBytes` 后通过，原诊断保存在initial-typecheck-failure.txt，B接口没有改变。

运行 `pnpm exec tsx docs/evidence/B/B2-004/registered-candidate/run-audit.ts test-results/B2-004-registered-recheck/audit.json` 可重新核对五份历史绑定并计算十组默认16秒数据；脚本拒绝覆盖已有输出。再执行 `pnpm test:b`、`pnpm check`，并按[候选第二机步骤](SECOND_WINDOWS.md)保存真实设备记录。文件语义见[新模型数据说明](DATA_CONTRACT.md)，最终源码/报告/链接核验见verification.json。

## 未完成项

本批未重新运行已保存的浏览器矩阵，没有生成新离线包，也没有第二机、物理断网、真实峰值内存或目标设备性能数据。A1 #59最新43b1dae报告313项与视觉证据属于其独立版本，本批不据此验收正式B文件回读/取消/身份隔离或A组合。新布局B1独立数值/物理审查、A1正式产品流程、最终同版设备证据和004最终签收继续待办。维护者审查#62后可集成至#57；main发布仍由原集成流程负责。
