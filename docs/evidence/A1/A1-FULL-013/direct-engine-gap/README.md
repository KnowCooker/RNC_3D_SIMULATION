# A1-FULL-013 / B 组直连数值入口的布局断点

2026-09-29；Role: A1；Identity-Source: user-declared；执行者：Codex 代 A1。固定 PR #38 源码 `9b4952eba13efadf9f1a7fcb95131838e699281f`。本批是**只读诊断和跨组交接**，没有修改 B 源码、共享契约或正式页面。正式页面/Worker 的未实现布局门禁仍有效。

从仓库根目录执行 `pnpm exec tsx docs/evidence/A1/A1-FULL-013/direct-engine-gap/audit.ts`。脚本只改同一默认 BEV/随机声源配置的 `layoutId`，以相同运行 ID 分别调用 B 组公开的 `calculateLab`、`sampleField`、`analyzeLabPath`，并直接用未知布局启动 `createLabStream`。[原始输出](result.json)显示：未知 `showroom-unverified-v1` 被批量与流式数值入口接受；全部 x/u/d/a/e 通道 Float32 字节哈希与教学布局逐路相同，指定教学 MIC 点的 A 计权场值同为 `62.3857536315918`，初级 H 脉冲响应逐值相同。流式入口还返回了 400 个样本。此结果证明**只换身份不改变物理几何或路径**，不能把“入口接受”解释为写实车计算完成。

已定位的 B 组接入点：`src/team-b/lab/validation.ts` 不检查布局；`index.ts` 和 `stream.ts` 读取全局 `MIC_POSITIONS`；`paths.ts` 读取全局 `SOURCE_POSITIONS`、`SPEAKER_POSITIONS`，录音初级路径的局部权重还依赖全局 MIC；`path-analysis.ts` 直接使用全局 MIC。A1 正式 Worker 先调用 `supportedLabLayoutId`，所以当前应用不会触发上述误算；但是 B 纯函数若被后续入口直接调用，或以后只放宽 Worker 白名单而没有替换 B 几何，就会产生“新布局身份、旧教学数值”。

交接给 B1/B2 的验收条件：数值公开入口先拒绝未注册布局；已核实的新布局注册后，批量、流式、路径分析和任意点场必须从**同一版本布局**取四轮、四 MIC、四扬声器及参考坐标，保持 16 条 S 和完整交叉影响；同位置同时间窗场与 MIC 结果一致。A2 需先提交带资产版本、安装部件 ID 和可复核物理坐标的布局。只给当前固定数组加一个新 `layoutId` 白名单不算通过。旧缺省布局需继续解释为 `teaching-fixed-v1` 并保持现有回归。

本诊断使用 1 秒合成教学源，不是实车标定或目标设备测试。它只证明该源码版本的直连缺口，不能外推为正式页面允许未知布局。下一步由 B1 复核 PR #38 的共管契约，并在 A2 安装点具备后由 B 组实现上述数值入口和按布局几何。
