# 当前分支与备份（2026-09-24）

本页是 A1/A2 下一次接续时的分支入口。**原仓库 `KnowCooker/main` 仍为 `1bb8a23`，完整目标成果尚未合入原仓库。** fork `lzhdai/main` 是当前 A1+A2+B 同版整合快照；原仓库开放草稿 PR 仅保留 [A1/整合 #23](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/23) 和 [A2 写实看车 #24](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/24)。#24 尚未进入 fork/main，接续 A2 时须检出其角色分支。

| 用途 | fork 分支 | 当前远端提交 | 接续方式 |
| --- | --- | --- | --- |
| 可运行整合快照 | `main` | `cac96a41c922315dffa8ab0e33f8b2d7519d4c82` | 从 fork 拉取；与原仓库 main 分开比较。#24 的写实外观尚未在此 |
| A1 页面/音频及集成协调 | `a/a1-full-008-audio-buffer` | `cac96a41c922315dffa8ab0e33f8b2d7519d4c82` | A1 继续独占 lab/app/charts/player，负责后续整合；先读 A2 #24 的改动与交接 |
| A2 viewer | `a/a2-full-016-showroom` | `cc055329e164704bd4e74d6fd601f6e59f83de28` | A2 只在此分支接续 viewer，先读 [A2交接](A2.md) 和 [本批证据](../evidence/A2/A2-FULL-016/README.md)；不在旧 #20 分支继续开发 |

旧阶段草稿 PR #7～#22 已关闭为**被当前整合分支包含的历史批次**，不是在原仓库 main 合并；#5/#6 已真正合入原仓库 main。A2 #20 提交 `5d3bafa` 经祖先关系核实已包含于 fork/main 与 #24，故在 #24 推送且 verify 通过后关闭 #20 并删除其 fork 远端分支。fork 仅保留上表三条分支。原仓库 PR 关闭状态和 fork/main、原仓库 main 的提交祖先关系才是准确信息，不把“关闭”写成“已合并”。后续 viewer 源码只由 A2 写。

清理前已做双层备份：fork 标签 `backup/pre-consolidation-20260924` 指向清理前 `250f6f3` 快照；本机 `D:\lzh\Desktop\RNC_3D\backups\2026-09-24-branch-consolidation\all-refs-before.bundle` 保存清理前全部 62 个 Git 引用，SHA-256 为 `1102a1fee741098514bec11fcd6265ada002f1f348434c4d6c8668454b1429b5`，并经 `git bundle verify` 通过。同目录保存原远端分支/PR 清单、A2 四个未跟踪文本和本机离线候选目录。bundle 是**本机备份**，另一台机器不能只凭此路径恢复；远端快照标签可供另一位成员访问。新 #24 提交保存在其远端分支与 PR，不在旧 bundle 内。

恢复某个清理前分支时，在本机备份可用的环境中先核对上述哈希，再用 `git clone all-refs-before.bundle <新目录>` 或 `git fetch <bundle路径> refs/heads/<原分支>:refs/heads/<恢复分支>`；不要在活动工作树直接覆盖当前分支。旧阶段所有 fork 分支的已提交内容在清理前均核对为当前整合提交的祖先，且 bundle 保留了原始引用。旧工作树目录仍在，但除 A1/A2 两个当前角色工作树和根 `main` 外均为 detached 历史工作树，不作为新开发入口。

目标仍见[最终交付标准](A_FINAL_DELIVERY.md)：视觉参照、指定核显、物理音画、第二机真实断网及最终同版包/录像尚未验收。当前整合成果和本机候选包不等于最终交付。

集成协调者已对当前完整页面补充[1080p渲染基线](../evidence/full-lab/current-performance/README.md)：RTX4070上六种状态无异常，但实际绘图缓冲为1588×618，未按1280×720等效像素预算限制；rAF读数不算目标核显帧率。#24 新写实 GLB 按需加载，未在指定核显测帧率或第二机断网。A2下一批继续负责外观数量/视觉、渲染预算与目标核显；A1继续页面和真实信号联动并在整合后做同版包，不代写 viewer。
