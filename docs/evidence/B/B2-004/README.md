# B2-004 数值与数据交付报告准备

2026-10-01；Role: B2；Task: B2-004；Identity-Source: user-declared；执行者 Codex。

本批把已合并的 B 组数值、分析和导出证据整理成可复查报告，并在当前代码上核对数据契约。基线是原仓库 main `93ed882861e07f23a604cb446fe6dce391f892c7`，已包含 #54。认领提交 `ef311386ac6fd0e4c61b3191d824221a5c10a141`，交付 [PR #55](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/55)。接班时开放 PR 仅 A2 #30，B1交接明确停止写入；认领后仅 #55/#30，无重复 B 任务。

**报告准备可单独审查；完整 B2-003 和最终 B2-004 尚未签收。** A1 正式文件流程、产品 Worker/取消/实验隔离、B1新布局审查、目标设备性能、实际峰值内存及第二台 Windows 真实断网仍待验。最新展示方向按 [云境香槟实施方案](../../../plan/12_CHAMPAGNE_IMPLEMENTATION.md)，旧 demo 数值证据和当前教学布局导出均不能签收新版资产或物理布局。

## B01～B08 证据矩阵

编号与判据来自 [B 组原独立需求](../../../plan/02_B组独立需求.md)。这是 demo-v2 的验收矩阵；lab-v3 的结果保存/复算另外列出。

| 验收 | 固定输入与判据 | 真实证据 | 当前结论与缺口 |
| --- | --- | --- | --- |
| B01 | seed11、64 taps、μ0.08；数组有限，max\|e−d−a\|≤1e-5 Pa | [B1-003](../B1-003/README.md)12配置全部有限；本批默认全32000点最大叠加误差 `1.234002411365509e-8` Pa | B核心通过；当前审计记录在 audit.json，不把人工非对称路径的较小误差混成默认值 |
| B02 | seed11/29/47，12～16s未计权；合功率改善≥3dB，四麦均改善，与Python每麦差≤0.2dB | [B1-001](../B1-001/README.md)：三个种子的合功率改善28.847918/28.621812/28.791750dB，五配置最大指标差约9.26e-9dB | 合成基准通过；这些数值不表示真实车辆效果或当前lab新布局收益 |
| B03 | 全部x/u/d/a/e；相对RMS≤1e-3，近零最大绝对误差≤1e-6 | B1-001五配置、100路、320万样本；最大相对RMS约1.14e-14，最大逐样本差约2.84e-14；近零门槛预先固定为参考RMS≤1e-12 | 完整Python对照已合并；本批全仓检查重跑现有对照测试，不重新生成或覆盖oracle |
| B04 | μ0，u=a=0、e=d，无假收敛 | B1-003六个μ0配置；本批默认μ0逐样本恒等，导入前后分析一致；[lab结果证据](../B2-003/lab-result/README.md)区分有效0dB与无效测量 | B数值/分析通过；最终页面展示随A1产品组合版本另验 |
| B05 | 32/64 taps；同配置重复及独立参考匹配 | B1-001五配置两端精确重复；B1-003覆盖3种子×两档×μ0/0.08共12配置 | B核心通过；runId/耗时不参与信号确定性比较 |
| B06 | 输出脉冲及单条非对角S置零，保留16条S/12条交叉影响 | [B2-001](../B2-001/README.md)逐tap/脉冲；[B1-002](../B1-002/README.md)非对称P/S、16条W通路、因果递推及11种错误变体均检出 | demo矩阵与时序通过；不把测试输入当实车参数。lab新物理布局仍待B1/A2同版审查 |
| B07 | 坏tap、负μ、NaN和引擎异常须明确错误；页面不得把旧数据当新结果播放 | B1-003：128坏配置×两入口、7数值故障、成功→失败→成功隔离；B2导出拒绝坏身份/格式/预算/哈希 | **B入口通过，产品生命周期待验。** A1须在最终文件/Worker流程核对失败、取消、旧响应、重复导入身份 |
| B08 | 默认16s核心计算+数据发送，目标设备争取≤5s；记录实耗时/进度/取消/回放 | B1-004尚未提供约定目标设备报告 | **待测。** 本机Node、历史Python耗时和独立Worker功能检查不替代此门槛 |

## 已交付版本及适用范围

下表只列 GitHub 已合并事实。每个链接对应不可变合并提交；历史报告中的“待合并”是当时状态。

| 交付 | 合并提交 | 证据与范围 |
| --- | --- | --- |
| B2-001 / #29 | [8724b09](https://github.com/KnowCooker/RNC_3D_SIMULATION/commit/8724b098838f158359e4167a05399512e7cbba26) | 合成源、单位、路径和复现说明；三种子x/d哈希核对 |
| B2-002 / #33 | [6a5a71b](https://github.com/KnowCooker/RNC_3D_SIMULATION/commit/6a5a71bfb7953bea7ad829980b1968184dd7b222) | [分析边界](../B2-002/README.md)，无效窗口、非有限值和PSD |
| B1-001 / #48 | [fa805e2](https://github.com/KnowCooker/RNC_3D_SIMULATION/commit/fa805e2da2ec16ce7e17a087b202ec3380a48ba2) | 五配置Python全信号对照，原报告基线83ee77a |
| B1-002/003 / #50 | [67387f6](https://github.com/KnowCooker/RNC_3D_SIMULATION/commit/67387f68c6a6c1d9ad0826794f61ebde74aa649c) | 矩阵/时序/错误验证；源码仅增加拒绝数组配置，正常递推未改 |
| B2-003 demo / #51 | [c2b0f4](https://github.com/KnowCooker/RNC_3D_SIMULATION/commit/c2b0f43abff449e25a87eb3dba35ce188ff1057f) | [demo API](../B2-003/demo-api/README.md)，五配置往返及显式配方复算各320万值 |
| B2-003 async / #52 | [1819526](https://github.com/KnowCooker/RNC_3D_SIMULATION/commit/181952687d6fb303e540e9f1b3981d228b52e744) | [异步API](../B2-003/async-api/README.md)，历史生产浏览器Worker20/20，快照与转移所有权 |
| B2-003 lab配方 / #53 | [33fbddc](https://github.com/KnowCooker/RNC_3D_SIMULATION/commit/33fbddca6b605b521f38a4bcfee7dc828f43fc04) | [lab配方](../B2-003/lab-recipe/README.md)，25案例2405816值；四车型×两源×1/4/8参考及发散 |
| B2-003 lab结果 / #54 | [93ed882](https://github.com/KnowCooker/RNC_3D_SIMULATION/commit/93ed882861e07f23a604cb446fe6dce391f892c7) | [lab结果](../B2-003/lab-result/README.md)，29案例同步/异步各2789816值；历史生产Worker15/15、776000值 |

lab 的往返与确定性复算证明保存的全部信号可还原、原配置/身份/指标可保留，未提供独立物理oracle。已知教学模型只有 `teaching-fixed-v1` 布局；源码模型注册表和录音身份必须同时匹配。详见 [数据契约核对](DATA_CONTRACT.md)。

本批 `run-audit.ts` 把8份历史JSON与其合并提交中的文件逐字节核对（文本统一UTF-8/LF），确认相应提交均为基线祖先；检查#54记录的14个源码/测试/夹具哈希、demo的5项和lab的17项模型哈希、RNQ1录音哈希及8个冻结文件。B1-001早期core哈希不能直接替代#50数组形状修复后的core身份；当前以已注册模型和重新运行的测试为准。

## 本批实际审计与复现

新增审计调用当前公共计算/导出/分析入口，未另写控制器或指标公式。2个demo配置（默认/μ0）和3个lab配置（shaped单参考、recorded八参考、真实发散四参考）共 **1545816个Float32值**往返一致，导入数组独立；单位、稳定通道ID、来源、半开时标和导入前后分析均一致。默认lab发散测试仍停于2909/6000点，未补零。0/999/1000/1024点、片段终点及越界时间核对通过；1000点可以有有效RMS，而FFT不足1024点仍无谱。

原始结果见 [audit.json](audit.json)，命令输出见 [audit-command.txt](audit-command.txt)。`checkoutHead` 是运行时的认领提交；实际计算源码来自上述main基线，新增审计源码另外记录UTF-8/LF SHA。这避免将注入的 `sourceCommit` 字符串当成整个构建已经自证。

从仓库根目录、Node≥22.12、pnpm11.19.0及已安装依赖运行：

```text
pnpm exec tsx docs/evidence/B/B2-004/run-audit.ts test-results/B2-004-reproduction/audit.json
pnpm test:b
pnpm check
```

审计拒绝覆盖现有输出，只接受 `test-results/B2-004[-小写字母数字后缀]/audit.json`；再次运行换新后缀。它核对固定报告基线，不自动把未来模型变更签收为本报告版本。独立Python重生成步骤仍按B1-001 README写入新目录。

本批工程验证：`pnpm test:b` **117/117**、`pnpm check` **207/207**及类型/目录边界/生产构建全部通过，原始日志见 [B测试](test-b.txt)和 [全仓检查](check.txt)。新增审计不在根tsconfig的include中，另以严格TypeScript命令检查通过，见 [审计类型检查](audit-typecheck.txt)。既有viewer大于500kB提示保留；历史浏览器Worker报告仅作带版本索引，本批没有重跑浏览器或测量峰值内存。第二机步骤与记录表见 [Windows离线复现](SECOND_WINDOWS.md)。

## 联调与签收顺序

A1按 [B导出模块用法](../../../../src/team-b/export/README.md)接文件读取/下载和正式Worker；导入先检查模型/布局/有效摘要，未知身份仅只读。导入原runId与当前实验隔离，显式复算才创建新runId；旧任务响应、哈希失败、取消及重复导入均不得替换有效实验。验收须使用同一源码commit、资产/布局身份、配置和时间窗口，提交真实操作及内存记录。这是依赖请求，未代A1修改接口或认领。

B1按原主责完成新布局直接B入口审查及B1-004目标性能；A2交同车物理锚点。B2在模型/布局注册完成后补相应保存和复算验证，并汇总第二机记录。届时更新本报告的实际版本和待测行，再由协作者签收完整003/004；不沿用旧A组浏览器证据代替新组合。
