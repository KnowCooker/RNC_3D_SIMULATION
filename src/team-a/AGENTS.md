# A 组边界

- 每次新的开发/调试会话先执行根规则的身份确认；本会话已明确 A1/A2 可直接继续，未声明先问，不能用 rnc.role 代替。日志与新提交注明角色、执行者和任务 ID。

- A1：lab / app / charts / player；A2：viewer。完整目标与最终标准分别见 `docs/plan/10_FULL_GOAL.md`、`docs/coordination/A_FINAL_DELIVERY.md`；旧单车型回放是历史基线。
- 开始前读取 `docs/coordination/README.md` 和 A1/A2 两份交接页；仅更新自己角色的任务状态和证据。每个角色同时只运行一个写代码的 Codex 会话。
- `app/style.css` 和现有 `tests/player.test.ts` 由 A1 维护；A2 新增样式放在 viewer 内并限定三维容器，新测试使用 `tests/a2-*.test.ts`；A1 新测试使用 `tests/a1-*.test.ts`。不顺手格式化或修复对方目录。
- 旧 viewer 接口保持兼容。lab viewer的配置/时钟/选择/空间帧、安装物理坐标与mountPart回调按lab-contracts对齐；接口需求写入角色交接，由指定协调者统一修改，不同时改共管文件。
- 通过 AppPorts / DemoEngine 使用接口，不导入 team-b 或 integration。
- 图表只绘制 B 组分析结果，不另写 SPL、RMS、降噪公式。
- `pnpm dev:a` 在不运行 FxLMS 核心时用冻结参考数据工作。
- 所有视图使用播放器 currentTime；爆炸不改变计算坐标或声学路径。
- 必须显示数据来源和预计算回放；播放 d/e 共用增益与时间。
- 每批改动同步根目录开发记录，执行对应检查；UI 改动截图或人工复现。
