# B2-001 合成源、路径与复现核对

- 日期：2026-09-26；用户角色B2；Identity-Source: user-declared；实际执行者Codex。
- 接班：用户明确“B1是停止的，B2继续”。B1 #28已合并；本次从原仓库main `a300d1631bc502c76ee6dd4f0b16990b071175dd`新建`b/b2-001-source-path-audit`，初始工作区干净；远端开放PR仅A1 #27。
- 范围：demo-v2的源/路径说明及验收证据；lab-v3只澄清版本边界。运行算法、共享接口、A组、原始fixture均未修改。不是B1完整五算例算法验收、B2-002指标边界、设备验收或最终交付的替代。
- 认领记录提交：`b51161e`。当前远端状态以[B组共同交接](../../../coordination/B.md)为准；本报告不把尚未发布的本地工作写成远端占用。

## 证据与数值结论

`reference-audit.py`只读导入冻结的`fixtures/reference/reference_mimo.py`，调用其`data(seed)`，不运行或重写控制器，也不输出到fixture目录。`reference-audit.json`记录Python生成的三种子x/d每通道Float32小端SHA-256、Float64 RMS、完整P/S非零tap、65系数整形频响与带内功率占比。源码基线和参考文件SHA-256在JSON中固定。

新增5项测试已接入现有`tests/engine.test.ts`，因此`pnpm test:b`与`pnpm check`都会执行：

1. 用BigInt无符号运算独立核对Xorshift32、3种子×4通道种子偏移、开区间(-1,1)及通道序列不同。
2. 3种子×8路x/d×32000，共768000个样本转换Float32后的哈希与Python完全一致，Float64 RMS差小于1e-12。该项不声称完成三种子的u/a/e独立对照；默认完整640000样本对照由原有测试保留。
3. 全部16条P与16条S逐tap对照Python；两类矩阵各保留12条交叉路径，分别长度24/16。第7样本单位脉冲的输出完整匹配移位核，无提前响应。
4. 用不同循环顺序逐样本重建P*x，再确认d中的独立扰动为指定种子及幅度；最大允许残差1e-15Pa，实测扰动RMS接近0.001Pa。
5. 核对输出schema配置、模型版本、来源、FL/FR/RL/RR、信号单位、32000样本和15.9995秒最后样本。

三种子12路参考的40～350Hz功率占比约98%，不是100%。此值来自完整32000样本、矩形窗的单边DFT并包含起始瞬态；它是源审计摘要，不代替产品的Hann1024/50%重叠Welch PSD或降噪指标。精确各路数值见JSON。整形核100/200Hz幅频响应约3.2431/3.2487，40/350Hz约1.6153/1.6177；0Hz约0.1923，500Hz约0.00229，说明有限65系数Hamming整形的过渡带与泄漏真实存在。理论`sum(h²)=3`与均匀源方差1/3对应单位输出RMS，有限片段不单独归一化。

`S_hat=S`通过源码核对：`engine/core.ts`从`createData`取得唯一secondary矩阵；`filtered`由它与x卷积，实际a由同一矩阵与u卷积。没有另一套隐藏估计系数；现有默认Python全信号回归同时保留。此结论只针对理想教学路径，不证明失配鲁棒性或真实车辆性能。

路径、信号单位与源映射详见[B组说明](../../../../src/team-b/README.md)。lab-v3使用实录的归一化谱形、独立R/H/S、默认0秒学习及可变时长，与这里冻结的demo-v2不可混称；lab模型现状见[模型说明](../../../research/LAB_V3_SIGNAL_PATH_MODEL.md)。

## 复现

在仓库根目录，Node >=22.12、pnpm 11.19.0：

```text
pnpm install --frozen-lockfile
pnpm setup
pnpm test:b
pnpm check
```

日常测试无需Python。独立重算源审计需要Python与NumPy，PowerShell示例（只写新的临时目录）：

```powershell
New-Item -ItemType Directory -Force test-results/B2-001 | Out-Null
python docs/evidence/B/B2-001/reference-audit.py | Set-Content -Encoding utf8 test-results/B2-001/reference-audit.json
```

将新JSON与已提交JSON按字段比较，换行风格不影响数值；勿直接覆盖已提交oracle来消除测试失败。若源码改变，应先调查模型/种子/单位差异，而不是放宽冻结回归容差。Python脚本禁止生成字节码到fixture，原始基准始终只读。

## 实际验证与限制

本机Windows、Node 24.19.0、pnpm 11.19.0；基线完整检查83/83通过。新测试首次执行有一处新增测试的括号笔误，修正后engine测试9/9通过。沙箱内tsx曾因`uv_os_get_passwd`失败，正常本机权限执行成功；不是产品数值失败。

最终`pnpm test:b` **36/36通过**，见[test-b.txt](test-b.txt)；`pnpm check` **88/88测试、类型、边界、生产构建通过**，见[check.txt](check.txt)。原有593.26kB viewer chunk提示保留。全部原始fixture在本批验证前后SHA-256不变，见[fixture-integrity.json](fixture-integrity.json)；`git diff --check`通过。三种子参考的带内功率比例范围为0.9803536711～0.9824249243。

无运行源码变化，因此没有重做浏览器截图、声学设备/音画延时、目标核显、第二机离线或最终版长稳；这些保持待相应角色/设备验收。B2下一项为B2-002，不在本批自动认领；B1/B2继续串行交接。后续远端状态在B.md及根日志追加，不改写此次验证的源码基线。

交付提交为`5d49370`，Git钩子边界/进度检查通过。首次推送因缺少GitHub凭据失败（`could not read Username`）；用户完成登录后，原仓库直接写入仍返回403，因此按协作规则创建`hgyong/RNC_3D_SIMULATION` fork并成功推送。已发布[原仓库PR #29](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/29)，目标main，尚未合并；发布前fetch确认main仍`a300d163`，未出现重复B组任务。最新CI状态以PR最新提交为准，不能用本机日志冒充云端结果。
