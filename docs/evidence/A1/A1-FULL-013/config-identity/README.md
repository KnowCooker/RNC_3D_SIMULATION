# A1-FULL-013：实验完整配置身份

- 身份：A1；执行者 Codex 代 A1；用户在本会话明确声明。基线为 `2bc3504`，本目录与本批源码在同一提交中固定。
- 原因：已有 `runId` 和 `layoutId` 保护，但同一教学布局下另一车型、路面或参考位置的 Worker 返回仍可能进入本次实验。预计算结果、实时启动回执和流式快照现核对完整启动配置；不一致终止该实验。正式 Worker 的实时 `ready` 增加配置回显。
- 实时 RNC 例外是合法的配置变更，不是身份绕过：仅在匹配请求的开关回执后更新期望 `rncEnabled`，随后数据包仍核对其余配置。旧配置缺省布局仍先规范化为 `teaching-fixed-v1`。没有改变 B 组数值实现或 A2 模型。
- `pnpm check`：类型、A/B 边界、136/136 全仓测试和生产构建通过。伪 Worker 测试覆盖同布局不同车型、路面、参考位置的批量/实时错配，及正常 RNC 开关后继续收包。
- [生产 Chromium 脚本](verify.playwright-cli.js)、[原始结果和构建文件哈希](result.json)、[恢复 RNC 后的页面截图](live-rnc-restored.png)：BEV 10 秒预计算就绪，实时从 ON 切 OFF 再切 ON，实验继续约 3 秒并显示 2.82 秒教学布局声场；页面脚本错误 0。截图为本机生产构建，未做指定核显、实物听感和 20 分钟长稳。
- 共管接口影响：`src/integration/lab.worker.ts` 的实时 `ready` 增加 `config`，`lab-engine` 严格核对回显和结果；B1 仍需审查 PR #38 的 shared/integration 接口。A2/B 新布局安装锚点、传播路径和数值入口边界未由本批完成。
