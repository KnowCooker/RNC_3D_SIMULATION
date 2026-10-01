# B2-002 指标与频谱边界

日期2026-09-28；Role: B2；Identity-Source: user-declared；Executor: Codex。用户沿用B2继续；B1交接明确实现结束，#31已合并，接班时无B组活动PR。基线main `3d81ebc84c5b79c561917d86bdea30b2517d6374`；分支`hgyong:b/b2-002-analysis-boundaries`；认领提交`17974b9`；[PR #33](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/33)。B2-001 #29已合并为`8724b09`。

## 问题与最小修复

基线分析API对坏样本和非法窗口没有完整校验：NaN声压会生成NaN降噪，但`NaN !== null`使帧错误标为valid；反向功率窗口返回−0；PSD读取越界/非有限样本时返回513个NaN。直接传入Infinity游标还可能使窗循环无法前进。

只修改`src/team-b/analysis/index.ts`的边界处理：功率非法区间/非有限和返回NaN；PSD有限游标夹到真实长度，拒绝非有限游标/非法采样率/坏样本/非有限结果；无效声压字段为null且帧无效；负/非有限RMS转SPL返回NaN。FFT、Hann、功率公式及正常信号结果保持不变，未改A组、shared/integration、控制器或冻结fixture。

保持旧契约：低能量及非有限测量都走`below-floor`不可用分支，不新增状态枚举；`steadyMetrics`仍为数值接口，静音的0/0是NaN，不能当作0dB。`syntheticSpl`对非负RMS保留1e-12Pa显示底限，零输入约−146.02dB是数值下限而非实测声级。lab共享PSD获得同样边界保护；本批不重定义lab计权、空间场或静音稳态策略。

## 实际验收

| 项目 | 独立证据与结果 |
| --- | --- |
| 0.5秒RMS/首尾 | 999/1000/1001点、最后32000点、浮点/越界/非有限end；插入边界脉冲验证当前样本被计入、未来样本被排除，1000点RMS就绪而PSD仍等待 |
| 功率降噪 | 常量四通道d=[1,2,3,10]、e=[2,1,1,1]；逐点包含−6.0206dB，总指标精确对应10log10(114/7)，与平均四点dB不同 |
| SPL/静音/坏值 | 20μPa=0dB SPL、1Pa≈93.9794dB；静音/近零不显示有效0dB收益；NaN/±Infinity测量为null，其他健康通道仍保留0dB |
| PSD窗与归一 | 使用直接三角函数DFT而非FFT作为oracle，核对1024/1535/1536/2048/2301点的全部513频点，覆盖50%重叠、非对齐末窗及不完整尾窗；保留原正弦/DC验证 |
| 单边/单位 | DC及Nyquist积分功率为1而非2；幅度3倍→功率9倍，fs翻倍→每Hz密度减半；x/u/d/a/e、lab q和A/Z计权单位保持对应 |
| 非有限游标 | 单独子进程设置5秒硬超时，NaN/±Infinity/负游标返回null，防止回归时挂住测试进程 |
| 正常结果不变 | 对冻结fixture的10个时刻×5种信号×4通道共200帧，与基线实现deep strict equal；PSD数组、RMS、降噪及元数据逐值一致；稳态指标和非负SPL值也一致 |
| 原始基准 | 所有fixture SHA-256与B2-001冻结记录一致，见[fixture-integrity.json](fixture-integrity.json) |

Windows，Node24.19.0、pnpm11.19.0，实际命令：

```text
pnpm exec tsx --test tests/analysis.test.ts
pnpm test:b
pnpm check
pnpm exec tsx docs/evidence/B/B2-002/compare-valid.ts
git diff --check
```

- 分析专项12/12通过：[analysis-check.txt](analysis-check.txt)。
- B组54/54通过：[test-b.txt](test-b.txt)；全仓113/113、类型/边界/生产构建通过：[check.txt](check.txt)。原有viewer大chunk提示保留。
- 正常输入对照脚本：[compare-valid.ts](compare-valid.ts)；结果：[valid-equivalence.json](valid-equivalence.json)。脚本从git读取固定基线，临时模块只写被忽略的`test-results/B2-002/`；浅克隆若缺基线须先fetch该提交。无需Python、网络服务或fixture改写。
- 修复前首轮[before.txt](before.txt)有4项失败，其中1项是新测试对比数据的功率平均/算术平均差不足1dB；将末通道设为10后，[修正夹具后的基线](before-corrected-fixture.txt)明确剩3项产品失败（7/10通过）。没有放宽现有数值容差。
- 全量首轮[check-first-attempt.txt](check-first-attempt.txt)在新lab测试的readonly四元组赋给可变x列表处报类型错误；改为复制x列表后完整检查通过。两次测试代码修正与产品缺陷分别记录。

## 交接与未测

本批无UI修改，未做浏览器截图、真实音频、目标核显、第二机离线或最终版长稳，不以单元测试替代这些验收。源/控制器数值未变，已有完整默认640000样本和新版录音/流式回归随54项B组测试通过。代码提交/云端CI及远端同步结果在[B.md](../../../coordination/B.md)与根日志登记；本机通过不等于云端通过。

下一项B2-003结果/配方导出须先核对B1-001依赖与共享接口协调；其序列化必须保留无效/缺测语义，不把NaN转为0dB。本批不自动认领下一项；交接后B1/B2继续串行。

发布：运行修复/证据提交`f6aff07`、日志行尾空白整理`dfa1365`已推送个人fork，PR #33已转可审查，目标原仓库main，未自动合并。日志仅清除行尾空白，失败内容保持；整批`git diff origin/main --check`通过。云端CI以PR最新提交为准。

云端：`dfa1365`的[Engineering checks](https://github.com/KnowCooker/RNC_3D_SIMULATION/actions/runs/36367204599)已成功；包含本次113项回归的Ubuntu检查通过。后续交接文档提交仍需查看最新PR检查。

最新main同步：发布期间A1 #34合入main `5f1fa26`，仅共同根日志产生冲突。已保留双方记录并合入main；A1/shared/integration与main完全一致。合并后完整检查**116/116、类型/边界/构建通过**，见[after-main-check.txt](after-main-check.txt)。B2运行源码未变，原113项/200帧证据仍绑定原基线；新合并提交的云端检查须单独核对。
