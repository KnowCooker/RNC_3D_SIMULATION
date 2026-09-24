# 有状态连续 RNC 内核

对应 `src/team-b/lab/stream.ts`。它延续 `lab-v3` 的源、空间路径和多通道归一化 FxLMS 数学模型，物理依据与局限见 [rnc-physics.md](rnc-physics.md)。持续运行不读取或循环16秒缓冲，也不会在每个块开始时重置自适应权值。

## 接口与状态

```ts
const stream = createLabStream(config, runId, 40000);
const chunk = stream.process(500); // 产生下一段0.25秒，持续推进同一个样本时钟
const view = stream.snapshot(4096);
const absoluteTime = stream.sampleCount / 2000;
const localTime = absoluteTime - view.startSample / 2000;
const analysis = analyzeLab(view.result, localTime, { signal: 'q', channel: 0 });
```

- `process` 返回的 `startSample`、只读 `sampleCount`、快照的 `startSample/endSample` 都使用同一个全局样本序号。
- `config.durationSeconds=16` 保持批量契约兼容，不限制流式运行时长。真正的停止条件是调用者暂停生成、数值错误，或计算机数值表示/资源限制。
- `q` 的四套 PRNG 状态、97点源 FIR 的前史、参考/初级/次级路径前史、全部控制权值、filtered-x 延迟及归一化能量全部跨块保留。更改工况应建立新实验；构造后修改原配置对象不改变已运行内核。
- 当前块可为1～1000000样本；不合法块长度不会推进时钟或改变健康状态。数值发散会明确报错并使该实例不能继续计算/读取快照，避免部分样本已经推进 PRNG 后冒充无缝恢复。需修改配置后新建实验。

## 历史与空间窗口

`historySamples` 默认40000，允许2048～2000000。内部保存固定长度环形历史，不随运行时长增长。`snapshot(maxSamples=32000)` 返回时间排序的最新 `min(maxSamples, historySamples, sampleCount)` 个样本，所有数组都是副本，修改快照不会修改内核。`result.sampleCount` 是局部数组长度；声场和分析函数的时间参数须转换成局部时间。

开始时 `startSample=0` 的负时间前史是真实零初始条件；前0.5秒按原规则准备窗口。环回后的 `startSample>0` 表示前段源历史被截去，这些局部开头数据不能当成零前史。

对组装状态 SUV 内的点，保留至少 `LAB_STREAM_CABIN_PREROLL_SAMPLES=64` 个源/驱动前缀，再取1000点 RMS 窗口：局部 `endSample >= 1064` 才可展示场。对于车体以外任意远处的位置，应按其初级/次级路径最大延迟保留更长前缀。建议 UI 取4096点快照，场计算 Worker 取8000或32000点，从尾部选同一物理时间；对外显示的 `frame.time` 应还原成绝对时间。爆炸图仍只改变显示坐标。

`snapshot.result.metrics` 按**返回窗口内最新最多4秒**计算。若只请求4096点，它统计2.048秒，不能标成固定的末4秒稳态指标；需要完整4秒指标时请求至少8000点。`analyzeLab` 和 `sampleField` 的瞬时显示均仍为0.5秒 RMS。

## 等价性与内存证据

`tests/b-live-stream.test.ts` 验证：

1. 默认前32000样本的四轮 q 和所有 x/u/d/a/e，与原批量实现逐样本位级相等；完整数值算法未因流式而改动。
2. 96000样本（48秒）的整块与随机块分割逐位相等，多次历史环回后仍一致；第16秒之后 q 不重播，u 不重新等待2秒。
3. 关闭 RNC、μ=0、关闭全部输出、8参考及部分输出禁用都保持批量语义。
4. 环回后快照的误差点及非误差点场窗，与保留全部64000样本独立计算的场相同；没有用误差点插值代替空间传播。
5. 2分钟推进后固定内部 TypedArray 容量保持不变，返回历史仍受上限约束；无效请求和数值发散明确区分。

2026-09-24 本机 Node 24.13.1 的一次内核测量（不包含浏览器、Worker消息、声场和音频输出）：每次处理1000样本即0.5秒，连续60块。

| 配置 | 生成时间 | 总计算时间 | 块均值 / P95 / 最大值 | 固定内部 TypedArray 字节 |
| --- | --- | --- | --- | --- |
| 默认4参考/64系数 | 30秒 | 594.15 ms | 9.90 / 12.27 / 18.33 ms | 4,176,696 |
| 8参考/128系数 | 30秒 | 1717.57 ms | 28.63 / 32.96 / 35.17 ms | 5,119,800 |

`storageBytes` 为内核分配的 TypedArray 总字节，`historyCapacity` 为历史样本容量，两者只读。它们不代表整个进程堆内存；调用者自行保留的块/快照、Worker消息副本、GPU和音频缓冲也占内存。实时音频连续性、浏览器长期资源、目标核显仍由集成验证，不以这组 Node 吞吐替代。
