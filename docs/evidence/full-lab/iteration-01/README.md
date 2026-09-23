# 完整目标：第一轮实现与局部验证

日期：2026-09-24。分支 `a/full-rnc-lab`，认领基线 `af98743`；运行代码对应引入本目录的提交（用 `git log -- docs/evidence/full-lab/iteration-01` 定位），不是该认领基线。[开发PR #7](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/7)。

## 实现及实际检查

- lab-v3已实现四架构、连续爆炸/轴向裁剪、参考改制/输出启禁、动画框图、工况/算法参数、动态MIMO、空间采样、统一回放及共用增益试听。默认入口为新版，`?legacy=1`或`pnpm dev:a`保留旧版。
- 根协调者在源文件冻结后执行 `pnpm check`：类型、A/B边界、38/38单元测试、生产构建通过，仍有约544kB脚本块提示。保留旧640,000样本不可变基准对照，新增物理11项、模型2项、音频3项。
- [整页QA](flow/README.md)：[最终90项结果](flow/results.json)，含6次真实Worker摘要、24通道、四车型、RNC关闭、旧状态清理、播放/试听及320～1440px布局。[源码哈希](flow/version.json)、脚本、初次失败记录及截图保留。
- [三维附着QA](attachment/README.md)：13锚点、32线路及移动点、12波前、禁用输出、玻璃透明、安装物理坐标及隐藏/剖去命中排除。**常值场仅作附着夹具，不证明声学效果**。
- [四车型](vehicle/four-solid.png)、[结构](vehicle/four-structure.png)、[爆炸](vehicle/four-exploded.png)截图及夹具脚本；44,508～47,300三角形不代表已达到最终视觉精细度。
- 物理测试检查同位置/同窗场值与误差指标一致，非误差点由源和路径重新卷积；无四麦克风插值、无强制收益。来源和假设见[物理资料](../../../research/rnc-physics.md)、[车型资料](../../../research/vehicle-architectures.md)。

## 复跑及边界

执行 `pnpm install --frozen-lockfile`、`pnpm check`。启动 `pnpm dev --port 5177 --strictPort` 后按子目录README运行浏览器脚本；原脚本保留采集时的 `output/playwright/...` 路径，需要时先创建输出目录。某些夹具直接加载模块，不能当成生产应用全链路验证。

仍为16秒预计算回放。持续实时运行、模型最终视觉质量、剖面表现、完整组合场景、新版20分钟长稳、指定核显、实物听感/延迟、第二台Windows离线、新版分发包/录像均未完成最终验收。旧838cdf3证据不可挪作本版本通过证明。最终标准见[A组交付](../../../coordination/A_FINAL_DELIVERY.md)。
