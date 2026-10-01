# A1-FULL-011 案例证据导出与导入复核

执行者：Codex 代 A1；Identity-Source: user-declared。分支 `a/a1-full-011-case-evidence`，[PR #34](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/34)，基线原仓库 main `3d81ebc`。认领先于运行代码修改；A2 #30 和 B2 #33 独立。

## 结果与复现

预计算实验先保存 A，修改路面并运行 B。展开“保存案例证据 / 导入复核”，填写观察和下一步核查后导出 JSON。文件含 A/B 运行 ID、完整配置、四座末尾 0.5 秒 A 计权原声/残余/改善、来源边界和人工备注；导入后重新计算可比条件及差值，只读展示。不同车速等条件下仍可保存事实摘要，但导入不展示不成立的 A/B 数值差值。格式 `rnc-case-v1`，最大 64 KiB；拒绝不支持版本、失配时窗、非法车型、无效维度/数值及边界文本。输入仅经 `textContent` 输出，不写回当前运行状态。

本机执行 `pnpm check`：TypeScript、源码边界、106/106 全仓测试、生产构建通过。新增 3 项单元测试覆盖往返、条件不匹配、畸形/过大/伪造输入。真实 Chromium 使用 [`qa-case-evidence.playwright-cli.js`](qa-case-evidence.playwright-cli.js) 跑实际 Worker：10 秒实录声源预计算 A、路面 0.6→1.2 重算 B、下载、刷新、导入和拒绝错误文件。样例 [`example-case.json`](example-case.json)；后排 RL/RR 残余均为 B−A `+3.0 dB`，导入后仍可复核；导入时基线已清除，不改变当前实验。桌面和 390px 截图见 [`desktop-imported.png`](desktop-imported.png)、[`narrow-imported.png`](narrow-imported.png)：页面无整体横向溢出，窄屏表格在内部横向滚动。浏览器页面脚本异常 0、应用外网请求 0。`invalid-case.json` 版本错误被拒绝，旧导入展示被清除。

命令：

```powershell
pnpm check
pnpm dev --host 127.0.0.1 --port 5173
npx --yes --package @playwright/cli playwright-cli --session a1full011 open http://127.0.0.1:5173/ --headed
npx --yes --package @playwright/cli playwright-cli --session a1full011 run-code --filename docs/evidence/A1/A1-FULL-011/qa-case-evidence.playwright-cli.js
```

## 边界与后续

JSON 是由文件提供者自报的教学仿真摘要，无数字签名、原始信号、音频、模型源码哈希或实车标定；导入验证结构，不能认证真实性，也不能重算录音。当前 A/B 基线仍只在页面内存，刷新后通过导入只读复核。实车方案审查需另外附带已校准原始采集、精确模型/资产版本和物理测量；A2 同车坐标与四车同版验收、目标设备试听/第二机离线仍未完成。
