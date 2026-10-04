# B2-003 注册布局导出兼容

角色 B2；执行者 Codex；身份来源 user-declared；日期 2026-10-04。用户指令为“继续 B2 任务”。认领提交 `68ef6f71c1fcce67fdf63013f99905eeb1c08f09`，原仓库 [PR #60](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/60)。

2026-10-05 发布：实现提交 `c2d6aa1bd72b58e6cdacf1b1fe2459e54b52fe67` 已推送 `hgyong:b/b2-003-registered-compat`，其源码与 comparison.json 哈希一致。本次后续提交只补发布交接；PR 最终检查以 GitHub 最新 head 为准，尚未合并。

本批基于 A2 #57 的 `5be0802beec22be171e36c5b0d754b3799e09e21`，PR base 为 `a/a2-driving-experience`。main `b968d926ce343cb4568e00bdb14da4e87bdd6fc6` 已合并 B2 报告准备 #55；注册布局仍在 A 候选中。#58/#59 的三项 B 失败由本批独立修复，不能把本 PR 验证写成这些分支已复验。

## 问题与修改

候选增加注册布局后，数值模型登记的六个哈希过期；核心配置校验开始拒绝未知布局，使原来可只读解析的文件在解析阶段失败。`before-fix.log` 保留复现输出：analysis 60 项中 57 通过、3 失败；文本已规范化 LF 并去除空白行的行尾空格。

- `lab-model.ts` 改为 `lab-v3-registered-batch-recipe-2`，逐一核对全部 17 项 UTF-8/LF 源码哈希；六项变化来自候选，B2 没有修改这些数值文件。
- 配方结构解析借用固定教学布局做字段、范围与内存限制检查，返回原布局身份。导出、复算和结果指标验证各自对实际配置执行布局/动力类型检查。未知布局不能因结构通过而进入引擎。
- 新增五车型导出和历史文件测试。既有断言、容差与 fixtures/reference 不变。API 说明同步新模型与旧文件兼容边界。

| 文件身份 | 解析/结果导入 | 导出或配方复算 |
| --- | --- | --- |
| 新模型 + 固定教学布局或匹配动力类型的五种注册 layoutId | 保留身份，已知结果可核对指标 | 支持 |
| 历史 model-1 | 保留原模型及历史缺省；modelSupported=false、verifiedMetrics=null | 复算在素材加载前拒绝 MODEL_MISMATCH |
| 未知 layoutId、assetId 别名或注册布局动力错配 | 保留原配置；layoutSupported=false、verifiedMetrics=null | 在素材加载前拒绝 UNSUPPORTED_LAYOUT |
| 字段/数值/规范化/素材/预算/容器不合法 | 严格拒绝 | 严格拒绝 |

注册模型仍是教学路径，不能视为实车声学标定。X9/GX 第三排没有新增控制通道，导出仍是四个源、四个输出、四个误差点，参考数量 1–8。

## 实际验证

| 命令/证据 | 结果 |
| --- | --- |
| 修改前 `pnpm exec tsx --test tests/analysis.test.ts` | 57/60，三项原兼容失败，见 before-fix.log |
| 修改后 analysis 专项 | 68/68，见 analysis-test.txt |
| `pnpm test:b` | 125/125，见 test-b.txt |
| `pnpm typecheck`、`pnpm check:boundaries` | 通过，见 typecheck.txt、boundaries.txt |
| 独立证据脚本 strict tsc | 通过，见 audit-typecheck.txt（成功无输出） |
| `pnpm check` | 295/295、类型/边界/构建通过，见 check.txt；既有大块构建提示保留 |
| `run-audit.ts` | 30 组注册布局，每种对照 1460000 个 Float32 值，三类对照均逐位一致 |

矩阵为 P7+/X9/L03/M03/GX × shaped-noise/recorded-noise × 1/4/8 参考；1 秒/2000 点，seed 11/29/47 与 taps 16/32/64，非零步长、声压 offset 3。每组比较从零配方复算、同步结果解码、异步结果解码，且同步/异步容器字节相同，原指标与身份、参考 ID、素材与输入所有权核对通过。录音使用原 RNQ1 全文件，SHA 保持不变。

`comparison.json` 保存每路小端 Float32 SHA、实际点数、素材请求次数、17 项模型登记、实现/测试脚本 UTF-8/LF 哈希、八份冻结基准原始字节哈希。数值源码相对候选无差异，八份 fixture 相对 main b968d92 无差异。候选 SHA 作为测试调用方的数值来源声明，不证明该提交已包含本批导出实现；本批实现由所列源码哈希及后续提交 SHA 绑定。

旧文件不是将新文件改成旧 modelId：`legacy-model-1.recipe.json` 和 `legacy-model-1.rncrs` 由 main b968d92 的独立源码归档与旧编码器实际生成。生成器先核对旧模型 17 个源码哈希，再用旧解码器自验。`legacy-model-1.provenance.json` 记录来源及文件 SHA；当前新解码器同步/异步只读导入成功，复算在 resolver/hash 调用前拒绝。历史 computeMilliseconds 原样保存；重新生成时该时钟字段可能不同，不能预期整个容器 SHA 一样。

## 复现

在仓库根目录执行：

```powershell
pnpm exec tsx --test tests/analysis.test.ts
pnpm exec tsx docs/evidence/B/B2-003/registered-compat/run-audit.ts
pnpm exec tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck docs/evidence/B/B2-003/registered-compat/run-audit.ts docs/evidence/B/B2-003/registered-compat/generate-legacy.ts
pnpm test:b
pnpm check
```

如需重新生成历史文件，先创建 `output/B2-003-registered-legacy`，运行 `git archive --format=tar --output=output/B2-003-registered-legacy/source.tar b968d926ce343cb4568e00bdb14da4e87bdd6fc6 src/team-b src/shared`，解包到该目录，再执行 `pnpm exec tsx docs/evidence/B/B2-003/registered-compat/generate-legacy.ts`。正常回归直接读取已提交历史文件，不依赖本机归档或 Git 历史。

## 交接与未完成项

本批完成 B 导出兼容验证；新注册布局的 B1 独立审查、A1 产品文件/Worker/取消/实验隔离、真实峰值内存/目标设备和第二台机器门槛仍各自待验。没有重新运行浏览器设备验收，不引用旧浏览器结果来签收新模型。本 PR 供维护者向 #57 集成，#58/#59 随后同步依赖并在各自最终 head 重新检查；本会话不合并 A 分支或 main。
