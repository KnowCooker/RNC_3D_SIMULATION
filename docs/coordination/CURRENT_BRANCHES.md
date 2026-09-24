# 当前分支与备份（2026-09-24）

本页是 A1/A2 下一次接续时的分支入口。**原仓库 `KnowCooker/main` 仍为 `1bb8a23`，完整目标成果尚未合入原仓库。** fork `lzhdai/main` 是当前 A1+A2+B 同版整合快照；原仓库开放草稿 PR 仅保留 [A1/整合 #23](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/23) 和 [A2 #20](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/20)。

| 用途 | fork 分支 | 本轮收拢前提交 | 接续方式 |
| --- | --- | --- | --- |
| 可运行整合快照 | `main` | `250f6f3768df3263baae3b5013d4ceedd579d4c7` | 从 fork 拉取；与原仓库 main 分开比较 |
| A1 页面/音频及集成协调 | `a/a1-full-008-audio-buffer` | `250f6f3768df3263baae3b5013d4ceedd579d4c7` | A1 继续独占 lab/app/charts/player；下一批从该分支开新任务，结束后更新整合快照 |
| A2 viewer | `a/a2-full-015-side-continuity` | `5d3bafa7a83a356ad66b7f8c8a47539ab9bbba72` | A2 先读取整合快照与自己的交接页，再从最新整合快照开下一批 viewer 分支；不要在旧分支混写 A1 |

旧阶段草稿 PR #7～#19、#21、#22 已关闭为**被当前整合分支包含的历史批次**，不是在原仓库 main 合并；#5/#6 已真正合入原仓库 main。fork 旧阶段分支已删除，只保留上表三条。原仓库 PR 关闭状态和 fork/main、原仓库 main 的提交祖先关系才是准确信息，不把“关闭”写成“已合并”。A2 #20 仍是独立 viewer 进度入口，后续 viewer 源码只由 A2 写。

清理前已做双层备份：fork 标签 `backup/pre-consolidation-20260924` 指向上述整合快照；本机 `D:\lzh\Desktop\RNC_3D\backups\2026-09-24-branch-consolidation\all-refs-before.bundle` 保存清理前全部 62 个 Git 引用，SHA-256 为 `1102a1fee741098514bec11fcd6265ada002f1f348434c4d6c8668454b1429b5`，并经 `git bundle verify` 通过。同目录保存原远端分支/PR 清单、A2 四个未跟踪文本和本机离线候选目录。bundle 是**本机备份**，另一台机器不能只凭此路径恢复；远端快照标签可供另一位成员访问。

恢复某个清理前分支时，在本机备份可用的环境中先核对上述哈希，再用 `git clone all-refs-before.bundle <新目录>` 或 `git fetch <bundle路径> refs/heads/<原分支>:refs/heads/<恢复分支>`；不要在活动工作树直接覆盖当前分支。旧阶段所有 fork 分支的已提交内容在清理前均核对为当前整合提交的祖先，且 bundle 保留了原始引用。旧工作树目录仍在，但除 A1/A2 两个当前角色工作树和根 `main` 外均为 detached 历史工作树，不作为新开发入口。

目标仍见[最终交付标准](A_FINAL_DELIVERY.md)：视觉参照、指定核显、物理音画、第二机真实断网及最终同版包/录像尚未验收。当前整合成果和本机候选包不等于最终交付。
