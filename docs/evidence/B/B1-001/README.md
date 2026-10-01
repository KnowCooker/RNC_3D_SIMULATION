# B1-001 五算例完整数值对照

日期：2026-09-30；Role: B1；Identity-Source: local-config；执行者：Codex。
基线：`83ee77af207742ab88d03c2e353d6a13960a6006`。按用户要求从 GitHub main 快进同步，在原分支继续工作。核对开放 PR 仅 A2 #30；B2 #44 设计已合并，交接说明停止写入。验证完成后按用户授权发布：[PR #48](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/48)，实现/证据提交 `8402815109854f47a6e8fe61eb1823ca3ea7e256`，已推送、待合并。

## 范围与独立参考

本任务补齐 B 组任务表中的 **demo-v2 五算例**，不是 lab-v3 实录源、动态布局或目标设备验收。现有默认 640000 样本冻结回归保留，运行算法、共享接口、A 组及 `fixtures/reference/**` 均不修改。

`generate-reference.py` 只读加载冻结 `reference_mimo.py`，调用其原始 `simulate`，不转写 TypeScript 算法或复用其输出作为期望值。每配置调用 Python 两次，检查 x/u/d/a/e、P/S 的 Float64 数组严格一致，再将 x/u/d/a/e 输出为契约使用的 Float32。五配置均为 16 秒、2 kHz、4 路参考/输出/误差；从 2 秒开始自适应，S_hat=S，全部交叉路径保留。

`oracle/` 包含五份 gzip 压缩的小端 Float32 数组，每份顺序为 `signal × channel × sample = 5 × 4 × 32000`；信号顺序 x/u/d/a/e，通道 FL/FR/RL/RR，无逐路归一化。每份解压 2560000 字节，共 12800000 字节，压缩载荷共 10455590 字节。它们是测试证据，不导入浏览器生产包。`manifest.json` 记录来源版本、Python/NumPy 版本、配置、原始与压缩文件 SHA-256、Python Float64 指标及重复结果。`fixture-integrity.json` 记录冻结目录生成前后哈希。

`tests/helpers/engine-numeric-audit.ts` 检查参考文件身份、配置、数组长度与哈希，对每路计算误差，并以另一 runId 重跑 TypeScript，严格比较全部样本及指标。新增五配置测试和一项负例测试挂到现有 `tests/engine.test.ts`，`pnpm test:b` 与 `pnpm check` 都自动执行；日常测试不依赖 Python。符号翻转、样本错移、输出置零、NaN、空数组及近零超差负例均必须被对照器拒绝。

## 验收口径与结果

- 每路 `relativeRms = sqrt(sum((TS−Python)²) / sum(Python²)) ≤ 1e-3`。预先固定近零判定为参考 RMS ≤ 1e-12，该分支采用**最大逐样本绝对误差 ≤ 1e-6**，避免 0/0 和稀疏异常被平均掩盖。μ0 的 u/a 共 8 路走此分支。
- 逐样本比较对象是两端的 Float32 输出；指标另对照 Python 原始 Float64 结果。均取 12–16 秒、未计权、完整采样频带；四点总量先合功率再取比值，每点及总量差 ≤ 0.2 dB。
- μ>0 时每点均改善、总降噪 ≥3 dB；μ0 时严格 u=a=0、e=d，所有指标 0 dB。两个实现均对每个配置做精确重复检查，忽略 runId/计算耗时等非数值元信息。

| 配置 | 比较样本数 | 最大相对 RMS | 最大绝对样本误差 | 四点降噪 FL / FR / RL / RR（dB） | 合功率降噪（dB） | 最大指标差（dB，含总量） |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| 默认 seed11 / 64 / μ0.08 | 640000 | 0 | 0 | 28.899678 / 28.711029 / 28.961802 / 28.816193 | 28.847918 | 5.54e-9 |
| seed29 / 64 / μ0.08 | 640000 | 1.14e-14 | 2.84e-14 | 28.646455 / 28.715209 / 28.396953 / 28.725541 | 28.621812 | 9.26e-9 |
| seed47 / 64 / μ0.08 | 640000 | 0 | 0 | 28.669808 / 28.832784 / 28.658627 / 29.010857 | 28.791750 | 7.55e-9 |
| seed11 / 32 / μ0.08 | 640000 | 0 | 0 | 28.984393 / 28.995617 / 29.157188 / 29.032896 | 29.041614 | 5.85e-9 |
| seed11 / 64 / μ0 | 640000 | 0（非近零路） | 0 | 0 / 0 / 0 / 0 | 0 | 0 |

共 100 路、3200000 个逐样本比较通过，Python 与 TypeScript 各自五算例重复完全一致。seed29 的极小差异保留在报告中，不宣称全部跨语言逐位相同。原始逐路误差、最差样本位置、每路参考/实际 SHA-256、各点精确指标和运行源码哈希见 [comparison.json](comparison.json)，命令输出见 [comparison.txt](comparison.txt)。表中数值都是合成基准，不能解释为实车降噪效果。

## 复现

在仓库根目录执行；Node ≥22.12、pnpm 11.19.0，生成参考另需 Python 与 NumPy：

```text
pnpm exec tsx --test tests/engine.test.ts
pnpm test:b
pnpm check
pnpm exec tsx docs/evidence/B/B1-001/run-comparison.ts test-results/B1-001/new-comparison.json
python docs/evidence/B/B1-001/generate-reference.py --out test-results/B1-001/new-oracle
```

两个脚本均拒绝覆盖已有输出，也拒绝向冻结目录输出。独立复现 Python 时使用新目录，把新解压数组的 `rawSha256` 与已保存清单比较；Python 计算耗时及可能不同版本的 gzip 压缩字节不作为数值验收。若参考不一致，先调查环境/算法/文件身份，不覆盖 oracle 或放宽容差消除失败。

## 工程验证与交接

实际验证：`pnpm test:b` **61/61**；`pnpm check` **151/151**、类型、目录边界与生产构建全部通过。原始日志见 [test-b.txt](test-b.txt)、[check.txt](check.txt)、[python-generation.txt](python-generation.txt)。保留原有 viewer 大于500kB的构建提示。本轮检查结束后再次核对8个冻结文件哈希不变，详见 [final-integrity.json](final-integrity.json)；`git diff --check`与证据链接检查通过。没有运行源码变更，未追加浏览器/实物试听/设备性能验收。

B1-001 的五算例证据供 B2 核对后用于 B2-003 的 demo-v2 配方复算验收。本任务不批准 B2 的 API 提案，也不代替 lab-v3 布局身份、实录素材版本或实时状态续算验证。A1 提出的布局接口审查、B1-002～004、设备/听感与第二机离线验收保持各自待办。当前代码/证据已随 PR #48 上传。B2 从远端接班先核对该 PR 的实际合并/版本状态，再确认其余接口依赖；本次发布不代表自动批准或启动 B2-003。
