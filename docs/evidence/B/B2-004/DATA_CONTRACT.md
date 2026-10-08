# demo-v2 / lab-v3 数据契约核对

2026-10-01；Role: B2；Task: B2-004；Identity-Source: user-declared；执行者 Codex。版本/范围及实际结果见 [阶段报告](README.md)和 [audit.json](audit.json)。本批只读当前契约与运行入口。

## 维度、通道与时标

| 项目 | demo-v2 RunResult | lab-v3 LabResult / 批量导出包装 |
| --- | --- | --- |
| 配置与布局 | 固定教学4×4×4、2000Hz、16s、seed11/29/47、taps32/64、μ0/0.08、2s开始学习 | 四类教学SUV、2000Hz、可变时长、1～8参考、四输出/四麦；默认立即学习，兼容2s。当前仅teaching-fixed-v1支持复算 |
| 信号 | x/u/d/a/e各4路Float32Array，每路N=32000 | sources为q四路；x有R路；u/d/a/e各4路；每路长度=实际N，总20+R路 |
| 固定顺序 | FL/FR/RL/RR；order和units显式保存在RunResult | q/u/d/a/e按FL/FR/RL/RR；x按原references顺序，以reference.id构造稳定ID，不能按显示名称重排 |
| 来源字段 | result.source为computed-browser或reference-replay | 共享LabResult没有source字段；调用方必须在导出包装显式提供来源，导入后source在包装上 |
| 完整性 | 从样本0开始，固定完整32000点 | 从样本0开始；completed点数=duration×2000；diverged为更短有限前缀，divergence.sample=实际N |
| 时间 | 样本i时间=i/2000；[0,16)，最后15.9995s | [0,N/2000)，最后(N−1)/2000；N=0最后时间null。请求时长不替代发散前缀终点 |
| 原始信号载荷 | 20×32000×4=2560000字节 | (20+R)×N×4；16s/R4为3072000字节，R8为3584000字节 |
| 运行身份 | 结果导入保留原runId、来源和耗时；显式配方复算用新runId，保留originalRunId关联 | 同左；发散信息和原配置中的可选字段缺省状态保留，复算使用规范化配置 |

示例默认值并非所有实验的约束；正式输入范围由当前B验证器检查。LabResult的computeMilliseconds为数值；demo允许null。耗时是来源元信息，不用于判定相同信号是否确定。

| 信号 | 数组及单位 | 解释 |
| --- | --- | --- |
| q | lab.sources；合成为m/s2-equivalent-wheel-excitation，录音模式为relative-amplitude | 录音原始未标定V及读取规则另记asset；生成q不能称实測耳旁Pa |
| x | demo/lab signals.x，m/s2 | 教学参考振动；lab参考数动态 |
| u | 四路drive | 控制驱动量；允许真实有限幅度超过1，不能按PCM满幅裁剪 |
| d/a/e | 各四路教学Pa | 原声/反噪声/残余，e=d+a；耳旁试听使用这些压力及另行定义的公平增益 |

数据类型来自 [demo契约](../../../../src/shared/contracts.ts)和 [lab契约](../../../../src/shared/lab-contracts.ts)。调用方不得用as类型转换把实时快照冒充完整批量结果。LabLiveSnapshot的startSample/endSample是绝对索引，result数组索引是局部；当前批量格式拒绝快照、非零起点和状态续算。

## 分析接口的窗口与有效性

| API | 时间输入/输出 | 指标与频谱 |
| --- | --- | --- |
| analyzeAt | 输入endSampleExclusive整数，截断并限制到0～N；输出同一独占结束索引 | 最近1000点/0.5s，未计权；不足窗口warming-up，静音/非有限测量无有效收益。PSD为Hann1024、50%重叠、513单边bin，间隔1.953125Hz；不足1024点无谱 |
| analyzeLab | 输入局部秒，floor(time×2000)并限制到0～N；输出time=end/2000 | 四麦level窗口1000点；levelWeighting/spectrumWeighting独立，默认Z。声压谱可A/Z，q/x/u保持线性物理单位；波形默认末尾5s，可独立起点 |
| steadyMetrics | demo固定12～16s | 四麦分别取功率比；总量先合功率再取比值，不平均dB |
| lab原结果指标 | 实际末尾最多8000点 | Z/完整采样频帶，历史底限规则原样保留；不同于页面当前0.5s计权指标 |

分析与导出不存储另一套PSD或人为收益。本批在同一结果与其导入副本上核对分析对象完全一致。实验比较仍需同一配置/来源/布局/时间和计权口径；不能把12～16s原指标与任意0.5s A计权窗口直接比较。

lab的valid主要标示窗口已准备且原声有能量；调用方还须检查每个primarySpl/residualSpl/reductionDb的null，不能凭一个valid字段替无数据位置补0。导出原指标用标签保存NaN/±Infinity/负零；已知模型另给verifiedSteady或verifiedMetrics。lab有效摘要区分empty-window、warming-up、below-floor、nonfinite、raw-mismatch，无效value为null；有声μ0的0dB可有效。未知模型/布局的verifiedMetrics为null，仅保留严格只读结果。

## 文件与来源核对

结果容器为RNCRSLT1：16字节头、UTF-8 manifest、四字节对齐的零填充、连续Float32小端载荷。demo与lab独立入口，以modelSchema区分，互相拒绝；所有有限样本逐位保存，包括负零/次正规数，不缩放、不补零。解码通道独立于文件buffer和原结果。

结果容器硬上限64MiB；manifest/配方64KiB，可降低，不能提高。lab配方信号预算按请求点数计算。异步encode在首次哈希等待前捕获全部数据；decode先检查预算，再保存有界容器副本，SHA通过后分配输出。估算只给“原信号+文件”等驻留下界；异步decode还持有输入+副本+解码信号，实际峰值要另外测量。

模型身份为demo的5文件和lab的17文件UTF-8/LF SHA注册表，调用方sourceCommit只是声明，SHA只检查完整性。本报告另外核对源码与不可变提交，未把文件哈希当来源认证。recorded-noise必须匹配RNQ1完整1280016字节、SHA `c3bcc4ffcea96268032403eb01a0743f822701d6958bebc979752f93283d421a`、49/53/51/55通道、2000Hz、80000点、79600周期/400交叠与增益2.7035289248832903；缺素材/坏身份禁止替换为随机源。

读取结果不会启动计算、采样声场、播放或替换当前实验。A1负责文件/Worker/实验身份适配；B1负责新布局注册与路径。完整API错误语义、可信SHA适配器要求及用法见 [B模块说明](../../../../src/team-b/export/README.md)。
