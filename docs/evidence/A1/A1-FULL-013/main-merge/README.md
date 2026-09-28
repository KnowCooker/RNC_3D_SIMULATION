# A1-FULL-013：并入空间改善证据后的组合验证

2026-09-29；Role: A1；Identity-Source: user-declared；执行者 Codex 代 A1。[PR #38](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/38) 原 HEAD `83466ee2cf5830df0e7cf2fca1bb1ebf163b51f9` 合入原仓库 `main` `b1d07cc41e363a5867988629b3fd0913e3b7ab12`（已含 [PR #42](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/42)）。A1 页面冲突按语义消解：保留布局身份拒绝与末尾残余、A 计权同窗引导门禁，同时接入同帧空间改善统计。有效场的采样点必须与当前剖面一致，否则清除旧场并拒绝显示；共同开发记录保留双方历史。

- 合并态 `pnpm check` 通过：类型、代码边界、全仓测试与生产构建。A1 专项测试 64/64 通过。
- 生产构建在本机 `http://127.0.0.1:5192/` 运行；[四车型与失效复核脚本](../../A1-FULL-016/qa-field-evidence.js)的[原始运行日志](field-evidence.log)记录 ICE、HEV、EREV、BEV 各 10 秒正式 Worker 场，均 280/280 有效点。BEV 124 点改善、2 点近零、154 点变差；A/Z 切换、剖面移动与路面变化后旧结论立即隐藏，390px 视口无横向溢出，页面错误及失败请求均为 0。
- [引导复核脚本](qa-guide.js)与[原始运行日志](guide.log)记录两轮 10 秒正式 Worker：10.00 秒原始场、10.00 秒 Z 计权残余场、[3.00 秒 A 计权残余场](early-field.png)均停留“声场”步骤；[10.00 秒 A 计权残余场](terminal-field.png)才解锁“公平试听”。页面错误及失败请求均为 0。

上述验证属于同一教学固定布局的 A1 分支集成；#38 仍待 B1 对 shared/integration 共管接口的实际审查，未并入 main。A2 #30 仍是草稿，写实车辆安装锚点、B 按布局计算以及目标设备、第二台 Windows 真断网和实物音画验收仍待完成；此证据不能称为四车写实同车声学交付。
