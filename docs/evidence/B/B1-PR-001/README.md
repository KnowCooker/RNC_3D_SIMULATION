# B1-PR-001 当前版本发布

日期：2026-09-25。Role: B1；Identity-Source: local-config；执行者Codex。

用户明确要求将当前版本推送到PR。复用b/b1-coordination，目标origin/main；fetch确认origin/main=0fb68a7已包含在本地3c43a99内，未发现同分支开放PR。

范围：B1-UI-001/002、B1-DATA-001、B1-ANALYSIS-001及B组串行协作记录。原始DAT、MATLAB、分离录音NPZ均不在提交范围；个人本地规则和override入口保持排除。上传的是源代码、派生频谱统计/合成证据、测试和开发记录。

提交前再次执行pnpm check：83/83测试、typecheck、check:boundaries、build通过，日志见check.log。旧fixture保持不变；构建仅有既有大chunk提醒。

跨组影响：按用户明确功能授权适配A1图表/试听、A2声场单位、shared/integration接口；A/B无互相导入。下一步：推送后创建main方向PR，记录链接与发布状态，等待审核；不自动合并。
