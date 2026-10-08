# 注册候选的数据交付边界

2026-10-05；Role:B2；Task:B2-004；Identity-Source:user-declared；Executor:Codex。范围为候选795d909，实际核对见[本批报告](README.md)及[audit.json](audit.json)。[旧数据契约](../DATA_CONTRACT.md)仍对应其原93ed882教学基线。

| 候选注册layoutId | assetId | 注册动力类型 | 源/输出/误差点 | 座位排数 |
| --- | --- | --- | --- | --- |
| xpeng-p7plus-bev-v1 | xpeng-p7plus | bev | 4/4/4 | 2 |
| xpeng-x9-erev-v1 | xpeng-x9 | erev | 4/4/4 | 3 |
| xpeng-l03-bev-v1 | xpeng-l03 | bev | 4/4/4 | 2 |
| xpeng-m03-bev-v1 | xpeng-m03 | bev | 4/4/4 | 2 |
| xpeng-gx-erev-v1 | xpeng-gx | erev | 4/4/4 | 3 |

这些是仓库教学注册表的映射与坐标，不是实车传递函数或产品规格认证。X9/GX第三排只作空间查询，不能据座位数增加导出控制通道。`teaching-fixed-v1`仍支持四种教学动力类型；注册layoutId须与注册动力匹配，assetId别名不能传作layoutId。参考数合法范围1～8，x按references数组顺序与稳定ID保存；q/u/d/a/e仍FL/FR/RL/RR。

当前数值身份为 `lab-v3-registered-batch-recipe-2`，17项源码哈希。LabResult仍无source字段，导出包装由调用方显式提供computed-browser或reference-replay；decode包装返回原来源，不自动启动播放/场采样或换掉当前实验。源commit是调用方声明，文件SHA是完整性校验，均不认证发布者。

原配置的可选缺省保留；规范化规则仍lab-legacy-defaults-v1：无layoutId为固定教学布局，无sourceMode为shaped-noise，无levelOffsetDb为0。页面当前默认不能改写旧文件含义。本批默认注册配置仅levelOffsetDb未提供，其原缺省与规范化0均已验证。旧model-1文件不自动升级；新解码器可严格只读查看，modelSupported=false、verifiedMetrics=null，不能直接复算。

| 信号 | 机器单位 | 文件顺序/尺寸 |
| --- | --- | --- |
| q | shaped:m/s2-equivalent-wheel-excitation；recorded:relative-amplitude | 四轮源，FL/FR/RL/RR |
| x | m/s2 | R条参考，稳定ID为x:reference.id |
| u | drive | 四输出，不按PCM满幅限幅 |
| d/a/e | 教学Pa | 各四路，原声/反噪声/残余；e=d+a |

RNCRSLT1/lab-v3容器仍16字节头、UTF-8 manifest、四字节零对齐、连续Float32小端载荷。默认16秒/R4共24×32000×4=3072000字节；容器另含manifest，按实际文件估算。completed长度须等于请求点数，diverged仅保留真实有限前缀，结束时间N/2000、最后样本(N−1)/2000，N=0为null；绝不补齐发散数据。

原指标是末尾最多8000点/Z计权，默认16秒即[12,16)；分析摘要用末尾1000点/0.5秒并可选A/Z。q/x/u的频谱保留Z，不因选择A而变成声压；d/a/e频谱按选择计权。预热、低能量/空数据/自报不一致须保留valid及null语义，不能补0收益。不能把4秒原指标与任意半秒A计权读数直接比较。

未知模型、未知布局或动力错配可以同结构严格只读查看，不可送入当前引擎或自动播放。导出和显式配方复算独立检查实际布局/模型，在素材访问前拒绝不支持身份；字段、范围、预算、单位、规范化一致性和容器有限性校验不放宽。recorded-noise必须提供原RNQ1完整身份与字节，缺素材/坏哈希不能改用随机源。

容器64MiB、manifest/配方64KiB硬上限只能降低；配方信号预算按请求点数检查。异步入口复制输入以保证等待期间修改/转移不污染结果；需要真实SHA适配器。驻留下界不包括路径、权重、录音、临时数组和完整峰值；内存与性能必须同版实际测量。正式文件UI、产品Worker、取消、重复导入及实验身份仍由A1协调，不因本报告的纯B数据核对通过而自动签收。
