# B2-003 结果与配方导出设计提案

Role: B2；Identity-Source: user-declared；执行者Codex；2026-09-29。
代码审计基线：`842bec8197a61df9d849e60e86504292de7846d0`。本文件是设计交付，API和文件格式均未实现或批准。B1-001完整数值证据仍为正式实现/整项验收前置；本批不替代该验收。

## 1. 本批决定与依据

推荐把“结果保存”与“配方复算”分开：结果保存原Float32采样值和来源；配方仅描述从零开始的预计算。两者都使用显式版本。A1的`rnc-case-v1`继续承担小型评审摘要，不能当成完整结果或配方导入。

| 数据 | 基线现状 | 本提案范围 |
| --- | --- | --- |
| demo-v2 `RunResult` | 固定32000点、x/u/d/a/e各4路；来源computed-browser/reference-replay | 完整结果往返；默认/29/47/32tap/μ0配方验收仍等B1-001 |
| lab-v3预计算 `LabResult` | q4路、x1～8路、u/d/a/e各4路；返回可能只有发散前缀 | 完整结果或明确发散前缀；完整配置和素材身份；配方从零复算 |
| `LabLiveSnapshot` | 有绝对起止样本、有限历史，缺历史权重和此前RNC切换序列 | 首版明确拒绝，不把滚动快照包装成完整运行或可续算配方 |
| 实时中途恢复 | 仅保存config不能恢复W、卷积历史、录音相位和RNC事件 | 不在首版；未来独立checkpoint协议和B1验证 |
| A1摘要/空间场 | A1已有JSON摘要和采样点证据 | 不复制其格式，不把有限场点推断为整个空间；A1后续自行接UI |

源码依据：`src/shared/contracts.ts`、`src/shared/lab-contracts.ts`、`src/team-b/engine/core.ts`、`src/team-b/lab/index.ts`、`src/team-b/lab/recorded-noise.ts`、`src/team-a/lab/case-evidence.ts`。均只读审计。

## 2. 无DOM API提案

预期实现目录`src/team-b/export/`，按功能组织。以下名称和类型为待协调草案，不是可调用接口：

```ts
encodeResult(input: BatchExportInput, context: ExportContext): Uint8Array
decodeResult(bytes: Uint8Array, limits: ImportLimits): DecodedResult
encodeRecipe(input: BatchRecipeInput, context: ExportContext): string
decodeRecipe(text: string, limits: ImportLimits): Recipe
recomputeRecipe(recipe: Recipe, context: RecomputeContext): RunResult | LabResult
estimateExport(input: BatchExportInput): ExportEstimate
```

`BatchExportInput`以`demo-v2`/`lab-v3`判别，只接受从样本0开始的批量运行；不使用结构相似的快照自动推断批量身份。`DecodedResult`保留文件来源、原runId、模型身份和状态，不自动接入当前实验。导入不会触发计算；复算必须显式调用，并传入新runId及依赖。原runId作为关联字段保留，避免冒充正在播放的运行。

B实现只消费类型、字节、字符串及注入的哈希函数/素材解析器；不导入DOM、Three、A组、integration、Node fs，不自行下载素材或读取文件。A1负责选择文件/下载/用户确认/错误展示，integration按明确协调范围注入素材与版本身份。模块内定义新增类型即可，暂不要求修改共享接口或依赖。

错误码提案：`INVALID_FORMAT`、`UNSUPPORTED_VERSION`、`INVALID_DATA`、`SIZE_LIMIT`、`INTEGRITY_MISMATCH`、`MISSING_ASSET`、`MODEL_MISMATCH`、`UNSUPPORTED_LAYOUT`、`UNSUPPORTED_MODE`。解析失败不得返回部分成功对象或影响当前实验；既有引擎错误保持原义。

## 3. 结果容器提案：rnc-result-v1

推荐单文件二进制容器，UTF-8 JSON manifest加Float32小端载荷；避免把全量信号转成JSON数字数组、数字键对象或base64。首版不压缩、不做单通道归一化，不导出PCM作为原始声压替身。

布局：前8字节ASCII `RNCRSLT1`；第8～11字节uint32 little-endian为manifest UTF-8字节数M；第12～15字节uint32 little-endian为payload字节数P；随后M字节manifest、0～3个零填充字节至4字节对齐、P字节载荷。不允许尾随字节。总体长度为`16 + ceil(M/4)*4 + P`。编码/解码均使用显式小端读写，不能假定主机端序；校验非零byteOffset的输入视图边界。

manifest最低字段：

| 字段 | 语义及校验 |
| --- | --- |
| format/modelSchema | 固定rnc-result-v1；demo-v2或lab-v3。未知主版本拒绝，不猜测兼容 |
| modelIdentity | 数值模型、路径、分析口径、规范化配置版本与对应SHA-256清单；另记源码commit。实现时固定本地支持清单，不接受文件自报为已支持 |
| config/normalization | 原始配置与规范化配置并列，说明缺省补齐规则；二者须重算一致，不能静默换用今日默认值 |
| run | 原runId、mode=batch、source、sampleRateHz、requestedSampleCount、实际sampleCount、originSample=0、completed/diverged状态及divergence详情 |
| provenance | demo保持原source；lab来源由导出调用方显式提供。生成q、参考x、教学Pa与实录未校准V分别说明，不能标成实车声压测量 |
| channels | 每路signal、index、stableId、unit、payloadOffset、sampleCount、byteLength；偏移相对payload，长度必须为4*N，顺序固定且无重复/重叠/空洞 |
| rawMetrics | 保留引擎返回指标及窗口/计权/单位；非有限标量用带种类的标签对象表示，不能让JSON自动变null后丢失原因 |
| integrity | payload SHA-256及其覆盖的字节长度；这是损坏检查，不是来源认证。manifest字段仍须全部验证，不因hash匹配信任其中结论 |

通道存储顺序：demo为x,u,d,a,e，每种按FL/FR/RL/RR；lab为q,x,u,d,a,e，q/u/d/a/e仍各4路，x严格按`config.references`的数组顺序及唯一ID映射，不按名称或位置重新排序。所有通道长度等于实际sampleCount。

单位：d/a/e为教学Pa，u为drive，x为教学m/s²；lab q在recorded-noise为相对幅值，在shaped-noise为教学等效m/s²。录音原始V不等于生成q的量纲，不附会V/Pa标定。记录共同声源增益/levelOffset和模型版本，不对每路另行缩放；音频安全增益不写回信号。

时间严格定义为样本n的`n/fs`；最后样本时间`(N-1)/fs`，记录覆盖半开区间`[0,N/fs)`。N=0的发散前缀无最后样本。`requestedSampleCount=durationSeconds*fs`只适用于批量，不能套用实时模式。发散sample、有效前缀N与引擎实际契约一致；禁止用配置时长补零或假装完整结果。

## 4. 数值保真与指标有效性

- 有限Float32样本逐位保存，包括负零；NaN/Infinity样本拒绝，绝不归零、限幅、插值。发散运行只允许保存引擎返回的有限有效前缀和发散状态。
- 引擎已有number指标可能非有限：wire标量提案为有限number或`{kind:'nan'|'positive-infinity'|'negative-infinity'|'negative-zero'}`。标签只有这些键和值；解码还原raw值，展示层不得直接把它们当作有效测量。
- 有效性单独保存/重算，使用`{value:number|null, valid:boolean, reason:string, window, weighting, unit}`。不得把静音、短窗、零分母、非有限指标变成0dB改善。真实μ0且存在有效原声的0dB是正常值。
- demo稳态窗口12～16s，与analyzeAt的末尾0.5s分开。lab返回的metrics基于最后最多4s未计权功率，A1摘要基于末尾0.5s A计权；两者不能混用。lab旧reduction函数有底限/原声过低返回0行为，必须保留为raw计算值并另行标注有效性，不能据其有限性宣称测量有效。
- 导入重算派生量时复用现有B分析函数；不另写一套RMS/PSD/计权公式。派生指标与文件自报值不符时明确报错/隔离自报摘要，不能改变原始信号以让结果吻合。未知分析版本只允许只读原始数据检查，不产生“已验证”指标。
- PSD可从结果重算，首版不存PSD以免重复占用内存及引入Float32/Float64混淆；如后续导出PSD，必须声明FFT/Hann/重叠/单位平方每Hz、计权、窗口和dtype，不把spectrumDb当PSD。

## 5. 配方提案：rnc-recipe-v1

UTF-8 JSON只含format、模型/路径/分析身份、原始及规范化配置、原运行关联、mode=batch/start-from-zero、声源素材依赖、预期采样数和可选验证摘要；不含信号数组、权重或任意可执行脚本/URL。独立schema，不兼容解析rnc-case-v1。

复算流程：校验schema/字段/大小 → 校验本地模型身份 → 校验布局 → 解析外部素材并校验哈希 → 校验配置 → 用户显式调用下进入现有B计算 → 校验结果及状态。耗时和新runId不参与确定性比较。算法正确性证据与导出/复算一致性是两项验收；后者不能代替B1-001。

旧lab配置缺sourceMode表示shaped-noise，不使用页面当前默认recorded-noise；缺layoutId表示teaching-fixed-v1，缺levelOffsetDb表示0。只补契约明确的缺省，其余缺字段拒绝。同时保留原始缺省记录和规则版本。

实录模式必须记录素材SHA-256、格式版本、2000Hz、4路顺序49/53/51/55、80000样本、共同归一/增益与39.8s循环/0.2s衔接算法版本；哈希覆盖完整`recorded-primary.f32`字节。配方不内嵌原始采集文件，素材通过调用方提供；缺失/哈希错误直接报错，不退回随机源。同一个seed不能替代素材身份。文件中的素材hash不能绕过本地许可/支持清单。

结果解码和复算能力分开：参考回放结果保持reference-replay，不冒充浏览器新计算；复算产生computed-browser的新运行并关联原运行。未知模型版本结果可以经严格结构校验后只读查看，但不能交给当前引擎复算或自动产生声场。

## 6. 布局与跨组接口门槛

已合并A1 #38只在装配层封住未知布局，B纯函数仍有直连缺口，见[审查包](../../A1/A1-FULL-013/B1_REVIEW_PACKET.md)。导出方案不能把文件声明的未知layoutId带入B重算：配方复算入口必须独立校验支持的布局。首版只支持teaching-fixed-v1；未知布局结果只读，不重算、不生成场，不自动换成教学坐标。

建议模型身份清单覆盖engine/data、lab源/路径/NFxLMS/计权/录音读取/声压增益、相关shared配置与坐标；不是仅记录一个Git SHA就声称不同构建可复算。未来写实布局需资产/尺度/坐标轴/安装锚点哈希与B路径版本一起加入注册表，绝不只放宽layoutId字符串白名单。

请求A1：确认完整结果下载/只读导入和显式复算是独立于案例摘要的UI流程，维持原runId与新实验隔离。请求B1：补齐B1-001证据，核定#38直连门禁与版本清单、发散前缀和指标有效性语义。请求指定集成者：提供可信构建/素材身份及字节解析器，决定Worker中执行导出的位置，避免主线程一次构造巨大JSON。本页是请求记录，未发送跨会话消息、未获得批准。

## 7. 内存与大小预算提案

仅计信号载荷：demo为`20*N*4`；lab为`(20+R)*N*4`，R为参考数，20包含q4路及u/d/a/e16路。以下为精确字节算术，不是实测峰值内存或设备验收：

| 情况 | Float32载荷字节 | MiB |
| --- | ---: | ---: |
| demo 16s/4参考 | 2,560,000 | 2.44140625 |
| lab 16s/4参考 | 3,072,000 | 2.9296875 |
| lab 90s/8参考 | 20,160,000 | 19.22607421875 |

格式提案上限：manifest及recipe各64KiB、结果容器64MiB；这不是现有程序已实现限制。导入先检查实际字节长度/头部/整数运算/总和上限再分配，禁根据恶意sampleCount预分配巨量数组。配置限制、格式限制和当次导出预算同时满足才继续。

非流式编码至少同时持有原信号P和输出P+头部，约2P加元数据；解码复制通道同样至少输入P+输出P。若调用方预复制/Worker structured clone又增加P，转Blob或下载还可能有额外副本，GC/浏览器/字符串成本不可从这个下界推成峰值。建议Worker利用转移所有权且UI已释放引用时避免副本，但不能detach播放器仍使用的buffer。预算不足就明确拒绝，不静默截断；原labDurationLimit的256MiB估算不包含新导出峰值，集成验收必须实测。

JSON数字数组的体积取决于数据；base64为`4*ceil(P/3)`字符，字符串内存实现相关。配套[核算脚本](measure-storage.ts)在真实demo及lab16s输出上记录二进制/JSON字节、位级编解码试验和素材hash，结果见[storage-audit.json](storage-audit.json)。试验只验证字节策略，不构成产品导入/导出API或完整协议验收。

## 8. 正式实现验收矩阵（均待执行）

| 范围 | 验收判据 |
| --- | --- |
| 结果往返 | 所有通道Float32逐位相同、负零保留、不修改输入、不共享可变输入buffer；配置/runId/来源/单位/顺序/状态正确；指标按原口径重算 |
| 配方确定性 | 五demo配置与四lab车型、1/4/8参考、开关/禁用、两种声源；同模型同素材重算与原结果逐样本一致，独立B1参考误差另行验收 |
| 坏输入 | 截断/尾随/头部及长度溢出/重复ID/重叠offset/未知版本/哈希错/非法配置/超预算/非有限样本被拒；超预算在大分配前拒绝 |
| 有效性 | 静音、短窗、NaN/±Infinity标量、真实0dB、负改善、发散N=0/有限前缀均保留真实语义；不把不完整结果纳入完整A/B比较 |
| 版本/布局/素材 | 旧配置缺省可解释；未知布局/模型或缺素材不能复算；reference-replay身份保留；模型/素材hash匹配不是实车验收 |
| 时间与模式 | 首末样本及半开窗口正确；拒实时滚动快照/恢复状态；不能因结构相似自动升级为完整批量 |
| 集成及资源 | A1另行接UI；Node无DOM往返、浏览器Worker、最大合法配置下导出/导入内存与取消、第二机复算分别记证据 |

实施顺序：依赖和接口决定落库 → 实现B纯函数及坏输入测试 → 完整往返/复算验证 → A1/指定集成者接UI与内存验收 → B2-004报告。当前只完成设计和字节策略核算，不标B2-003已完成。
