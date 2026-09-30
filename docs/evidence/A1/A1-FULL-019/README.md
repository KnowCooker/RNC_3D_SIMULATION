# 最终展示基准入库验证

日期：2026-09-30。Role: A1；Task: A1-FULL-019；Identity-Source: user-declared；执行者 Codex 代 A1。

审计基线为原仓库 main `fa805e2da2ec16ce7e17a087b202ec3380a48ba2`；任务[PR #49](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/49)。本批只增加设计/原型/计划和入口文档，不修改生产运行代码或冻结 fixture。

## 验证结果

- `pnpm check`：类型、边界、151项测试和生产构建通过，原始输出见 [check.txt](check.txt)。现有viewer大块构建提示仍存在。
- [verify-design.py](verify-design.py)：核对18个设计快照文件、批准首页SHA和本地文档链接；加 `--index` 核对Git暂存字节，防止Windows换行转换破坏清单。结果见 [design-verification.json](design-verification.json)。
- 批准首页 SHA-256：`b23f83da43c8ce8976a4cc2495ad438b0ce069961fc6fda0e871c983e57c366b`。
- E-FINAL-1.0文件保持原样；目录内 .gitattributes 禁止快照换行转换，并识别存档清单的CRLF及Markdown原有硬换行/结尾空行，不改写快照字节。完整发布包 SHA-256 为 `da348486398b89ea2566fef1536106fa007e12d69e178d67777eb6eb80a0b91c`。
- 本地复制与清单一致，因此沿用相同原型的[桌面/手机/状态/导出检查](../../../design/champagne-final/QA.md)及其浏览器截图；本批没有重复测试未改变的原型全部流程。
- `git diff --check` 通过；提交前核对没有生产源码或他组交接变更。

复现：在仓库根执行 `python docs/evidence/A1/A1-FULL-019/verify-design.py`。核对暂存内容时先仅暂存本批设计文件，再追加 `--index`；Python是该设计核验工具的依赖，不是产品运行依赖。

## 范围限制

没有把新设计作为可运行三维产品验收。批准图的车辆没有对应的最终三维资产；同车物理配准、四环境、B按布局计算、目标设备、实物音画与新版第二机离线仍待实施。数值基线通过不代表这些交付项完成。

首次认领提交被现有钩子因缺少新工作树依赖拒绝；随后 `pnpm install --frozen-lockfile` 从本机缓存安装固定依赖，再通过钩子提交，没有跳过检查。
