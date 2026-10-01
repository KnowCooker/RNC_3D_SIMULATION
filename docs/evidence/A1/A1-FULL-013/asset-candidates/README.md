# A1-FULL-013 / 同车布局的可下载资产初筛

2026-09-29；Role: A1；Identity-Source: user-declared；执行者：Codex 代 A1。此项只读核查服务于 A2→B 的同车物理布局接入，不修改 A2 模型、B 数值或当前资产选择；**没有候选达到可导入/可配准结论**。

按 UID 从 Sketchfab 官方 `GET https://api.sketchfab.com/v3/models/<uid>` 读取作者、页面许可证、可下载标记、面数、材质数与动画数，保留[查询结果](sketchfab-api-snapshot.json)。模型页面与 API 元数据只能证明页面自报信息，不能证明上传者拥有原始版权、真实车门/座舱/机械部件已分层，或坐标可用。未登录的官方下载端点对候选返回 HTTP 401，本次没有取得 GLB，因此没有哈希、实际渲染、网格节点或内部几何验收。

| 候选页面 | API 所示情况 | 本阶段判断 |
| --- | --- | --- |
| [通用电动 SUV](https://sketchfab.com/3d-models/high-poly-3d-model-of-modern-game-render-ready-51c9dbcbfb924acaba71871d2789aeb6) | CC Attribution；250,383 三角；1 材质；0 动画；作者文字称有完整内外饰 | 可让 A2 **优先检查原包**，但单材质、未见节点层级与安装点，不能按文字宣传直接替换现有 BEV，更不能假定可拆四门或声学配准 |
| [Ford Escape Hybrid](https://sketchfab.com/3d-models/ford-escape-hybrid-e4e909bda4ea4656b1980786c2e935d6) | CC Attribution；40,852 三角；27 材质；0 动画 | 可作为 HEV 外观备选，页面未说明五座内饰、独立车门和动力结构；视觉质量与部件层级都待实物核验 |
| [Li Auto L7](https://sketchfab.com/3d-models/li-auto-l7-0203b32240124b228168de2e89a2f4f2) | CC Attribution-NonCommercial；149,945 三角 | 不按当前项目避用 NC 资产的选材口径纳入可分发包；除非权利人另行授权，也不能据此声称 EREV 资产已解决 |
| [2021 RAV4 Hybrid](https://sketchfab.com/3d-models/2021-toyota-rav4-hybrid-de74fe4e98004c92b1103947597d1b53) | 页面标 CC Attribution；172,455 三角；说明写明 “REUPLOAD” | 原始授权链未核实，暂不纳入。页面许可证不能替代原作者来源核查 |

对 A2 的可执行交接：如取得通用 SUV 或 Ford 原始下载包，先固定页面、作者、许可、下载文件哈希和真实渲染；再审查车身/四门/四轮/两排五座/方向盘/扶手箱/动力部件的**实际网格**、分件可逆性、米制尺度和坐标轴。缺失部件可在同一最终车型资产内补建，但须有公开结构依据且回装后仍是一辆车。最后才可提出 `assetId`、版本/哈希、四轮源、四 MIC、四门扬声器及参考安装件与物理坐标；B 按该布局重算 H/S/任意点场，A1 再开放实验。仅发现一个“可下载且面数多”的外观模型，不会解除 [B 直连数值断点](../direct-engine-gap/README.md)。
