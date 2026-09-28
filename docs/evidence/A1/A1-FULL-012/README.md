# A1-FULL-012 案例评审卡与判断边界

执行者：Codex 代 A1；Identity-Source: user-declared。基线原仓库 main `6a5a71b`，分支 `a/a1-full-012-review-card`，[PR #35](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/35)。先推送认领与草稿 PR，A2 #30 继续独立维护 viewer。

## 改动与复现

预计算 A/B 完成后，工程评审卡从实际快照整理车型/实验 ID、各自末尾时间与 A 计权口径、配置变化、后排残余 B−A 和判断边界。可比条件不一致时不输出差值；多变量时明确不能单因子归因；无方案变化与缺失读数也单列限制。自动部分只陈述计算事实，不生成实车因果结论或方案批准。工程师另填人工观察、待验证解释、临时行动和待补测事项。四项内容随原 `rnc-case-v1` 摘要导出、刷新后只读导入；新增两项为可选字段，旧文件导入显示“未填写”。导入时自动事实仍由 A/B 快照重新计算，不信任文件中的人工解释为测量。

`pnpm check` 完成：类型检查、源码边界、全仓测试与生产构建通过。新增 A1 单测覆盖单变量读数方向、多变量/工况不匹配的限制、人工字段往返、旧版 JSON 兼容和超长拒绝。

真实 Chromium 运行 [`qa-review-card.playwright-cli.js`](qa-review-card.playwright-cli.js)：实录声源、10秒预计算基线，路面 0.6→1.2 候选，RL/RR 残余各 `+3.0 dB`；填写四项记录、下载 [`example-review.json`](example-review.json)、刷新后导入，检查事实/人工字段分离、基线未恢复；再导入[上批旧样例](../A1-FULL-011/example-case.json)验证可读；车速不一致时不显示差值，路面+步长同时改变时提示不能归因。桌面与390px窄屏截图见 [`desktop-review.png`](desktop-review.png)、[`narrow-review.png`](narrow-review.png)；无整页横向溢出，表格在面板内滚动。页面脚本异常0、应用外网请求0。

```powershell
pnpm check
pnpm dev --host 127.0.0.1 --port 5173
npx --yes --package @playwright/cli playwright-cli --session a1full012 open http://127.0.0.1:5173/ --headed
npx --yes --package @playwright/cli playwright-cli --session a1full012 run-code --filename docs/evidence/A1/A1-FULL-012/qa-review-card.playwright-cli.js
```

## 未完成

人工解释/行动由文件作者自报，JSON 未签名，不代表工程审批；教学模型未经实车标定且不含原始信号。A2 #30 提出的同车物理布局仍缺核实的安装件/锚点，B路径和四车型同版物理回归尚未完成。目标核显、实物试听与第二台 Windows 离线包仍须按最终交付清单另验。
