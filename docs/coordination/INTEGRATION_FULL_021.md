# 完整目标组合交接：INTEGRATION-FULL-021

状态：A1 作为本轮单一集成协调者已将两个角色的源码组合并在本机验证；[草稿 PR #22](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/22) 保留为统一交接入口。本分支 `a/integration-full-021` 从 A2[草稿 PR #20](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/20) 的已提交 `5d3bafa7a83a356ad66b7f8c8a47539ab9bbba72` 建立，合入 A1[草稿 PR #21](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/21) 的已提交 `42095d2b84d4f6a5129565f9b7b0cf40854d0359`。两条角色分支继续独立，不反向改写任何一方的历史。

本轮只负责解决共同开发记录合并冲突、验证两个源码分支的组合行为，并保存可从仓库恢复的集成结果。A1 负责页面场请求，A2 负责 viewer 采样点/几何，B 数值与 shared/integration 协议保持现状。只有发现实际组合缺陷时才由对应角色范围修复，不能用集成分支悄悄改写对方源码。

验证：[本批原始证据与脚本](../evidence/full-lab/integration-021/README.md)记录了 `pnpm check` 67/67、四车型新剖面真实场、BEV四种车身/展开状态、禁用/恢复扬声器、步长归零/恢复、移除参考及实时暂停后同时间重查；页面异常和GL context loss均为0。[组合版20分钟长稳](../evidence/full-lab/integration-021/stability/README.md)实际1210.65秒、15项门槛通过，首实时run仍有2次补缓冲。根开发记录冲突保留双方条目。此次未增加新运行逻辑，A1/A2接口不变。本机组合候选不等于最终视觉、目标核显、实物音画、第二台 Windows 离线或正式发布。

下一步：审查并按依赖顺序合入 #7～#22；A1在独立[草稿PR #23](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/23)处理试听补缓冲并为后续最终运行版重新做长稳/实物音画，A2继续四车型参照视觉和目标核显；单一集成协调者完成第二台Windows离线包、同版说明/哈希/录像。未验项目保持待验收；两端继续独占各自源码目录。
