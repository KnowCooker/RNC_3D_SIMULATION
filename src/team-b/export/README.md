# demo-v2 结果与配方 API

本模块只支持从样本 0 开始的完整 demo-v2 批量结果，固定 2000 Hz、32000 点、x/u/d/a/e 各四路。同步与异步结果 API 使用相同格式；lab-v3、发散前缀、实时快照和状态续算均未实现。无 DOM、文件读写、网络或 A/integration 依赖，不修改引擎公式或共享契约。

```ts
import {
  encodeResult, decodeResult, estimateExport,
  encodeRecipe, decodeRecipe, recomputeRecipe,
} from './index';

// 由调用方注入真实源码 commit 和同步 SHA-256 函数。
const context = { sourceCommit: buildCommit, sha256 };
const input = { mode: 'batch' as const, originSample: 0 as const, result };
const estimate = estimateExport(input, context);
const bytes = encodeResult(input, context, { maxContainerBytes: 4 * 1024 * 1024 });
const imported = decodeResult(bytes, sha256);

const json = encodeRecipe({
  mode: 'batch', originSample: 0, config: result.config,
  originalRunId: result.runId, source: result.source,
}, context);
const recipe = decodeRecipe(json); // 仅解析，不运行计算。
const repeated = recomputeRecipe(recipe, 'a-new-run-id');
// repeated.originalRunId 关联原运行；新结果 source 为 computed-browser。
```

同步 `sha256(bytes)` 必须返回 64 位小写十六进制，且不得修改字节。Node 验证使用 `createHash('sha256')`；B 运行模块不导入 Node crypto。浏览器可调用 `encodeResultAsync` / `decodeResultAsync`，向其注入返回 `Promise<string>` 的 Web Crypto 适配器：

```ts
import { encodeResultAsync, decodeResultAsync } from './index';
const asyncSha256 = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
};
const file = await encodeResultAsync(input, { sourceCommit: buildCommit, sha256: asyncSha256 });
const restored = await decodeResultAsync(file, asyncSha256);
```

异步编码在调用哈希前捕获配置、运行身份、指标和全部信号，后续输入修改不会改变该次文件。异步解码先核对预算/容器边界，再复制输入视图；等待期间调用方修改或转移原 buffer 不影响校验和还原，Node Buffer 同样会复制。先验证元数据/有限性，再调用哈希，哈希通过才分配输出通道。哈希适配器不得改写提供给它的内部字节；适配器拒绝会原样传播，错误摘要或校验失败均不返回部分结果。预算也在开始时复制。

异步解码额外持有一个容器副本，其信号驻留下界约为“输入容器 + 副本容器 + 解码信号”；`estimateExport` 的下界只针对编码，不用于声称异步解码峰值。同步采样捕获阶段仍占用执行线程，建议在 Worker 中运行；不能把异步函数解释为整段编解码都不阻塞线程。配方编码及字节估算仅需 `{sourceCommit}`，不依赖哈希函数。真实生产浏览器 Worker 验证见 [异步 API 证据](../../../docs/evidence/B/B2-003/async-api/README.md)。本批未修改产品 Worker 或页面。

结果容器采用 `RNCRSLT1`、16 字节头、UTF-8 manifest、零填充至四字节对齐，再按 x/u/d/a/e 和 FL/FR/RL/RR 顺序保存 2560000 字节 Float32 小端载荷。通道描述记录单位、稳定 ID、偏移、样本数与字节数；读取严格核对顺序和连续偏移。最后样本时间 15.9995 秒，覆盖 `[0,16)`；声压为教学 Pa，x 为教学 m/s²，u 为 drive，不表示实车标定。PSD 未存储，可从独立结果使用现有 B 分析 API 计算。

`DEMO_MODEL` 是本地支持的数值版本，保存 core/data/analysis/contracts/defaults 的 UTF-8、LF 规范化 SHA-256；B 测试会核对源码，数值实现变化后必须重新审计并登记版本。`sourceCommit` 是调用方声明的源码来源，不凭这个字符串自动验证构建。原配置与规范化配置均逐字段验证，demo 没有隐式缺省。原 runId、来源和计算耗时保留，reference-replay 导入仍为 reference-replay。

所有原始信号必须是长度一致的有限 Float32，不缩放、不补零、不限幅，负零、次正规数和有限极值逐位保留。编码不修改输入；解码分配独立通道，不共享文件或原结果 buffer。`estimateExport` 返回准确文件字节数，以及“原信号 + 文件”的驻留字节下界，不能解释为浏览器峰值内存。

原指标窗口固定 12–16 秒、未计权。NaN、±Infinity 和负零采用显式标签往返，不让 JSON 自动丢失。已知模型导入后用 `steadyMetrics` 重算核对，有限指标绝对差允许至多 **1e-6 dB**，仅兼容冻结参考回放的 Float64→Float32 差异；原指标仍原样保留，不修改 B1 的独立 Python 验收容差。`verifiedSteady` 另给出各点及合功率的测量值/有效性/原因，复用现有功率与指标函数；低功率、零分母和非有限指标均不可用，合法 μ0 的 0 dB 与负改善可有效显示。

同一 demo 数据结构下，未知模型身份的结果可严格解析为只读数据：`modelSupported=false`、`verifiedSteady=null`。调用方必须检查这些字段，不能把 rawMetrics 当成已验证摘要或自动接入当前播放/声场。未知模型配方的 `recomputeRecipe` 会拒绝；复算前会重新校验内存对象、配置和模型，要求新 runId，不信任“曾经解析过”的对象。

容器硬上限 64 MiB，manifest/配方分别 64 KiB；调用方可以进一步降低预算，不能提高硬上限。导入先验证头部、实际长度、预算、通道、哈希及全部样本有限性，再分配输出通道。非零 byteOffset 的输入视图按自身范围读取。截断、尾随字节、非零填充、无效 UTF-8、未知格式、重复/错位通道、额外配置字段、异常指标或来源、坏哈希、过量及非有限数据均抛出 `ExportError`；哈希仅用于完整性检查，不认证来源。

验收及复现见 [B2-003 demo API 证据](../../../docs/evidence/B/B2-003/demo-api/README.md)及上述异步证据。A1 后续负责独立文件流程、错误展示、实验身份隔离、产品 Worker 接入和峰值内存验收；lab-v3 仍需 B1/指定集成者核定布局、素材及版本清单后接续同一任务。
