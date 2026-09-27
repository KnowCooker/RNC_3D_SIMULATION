ICE 写实车在切换透明、隐藏、剖面或整体拆解时，原先会离开写实模式并切回另一辆教学车。本批让这些操作留在同一 GLB，增加可见表面点选、键盘部件选择、所选部件拆装和复位。外壳材质与内部隔离，剖切只绘制实际网格截线；尚未核实的机械实体不伪造封口。

范围为 A2 viewer、测试、证据和交接。A1 #27 的主舞台/路面接线、B 数值、shared/integration、原 GLB 和冻结 fixture 均未修改。

验证：A2 25/25；pnpm check 94/94、类型、边界、生产构建通过。真实 ICE GLB 解码验证 30 组完整回装坐标与 74,127 三角形不变，材质/几何恰好释放一次。Node 解码测试不含纹理渲染；当前浏览器、目标核显和第二机验收未执行。构建既有大块提示保留。

保持草稿直到补真实浏览器操作/截图；四车型最终视觉和同车声学配准仍未完成。证据：docs/evidence/A2/A2-FULL-017/README.md；接口请求：同目录 LAYOUT_HANDOFF.md。

Role: A2
Task: A2-FULL-017
Identity-Source: user-declared
Executor: Codex on behalf of A2
