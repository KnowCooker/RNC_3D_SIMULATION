# 完整实验室端到端 QA

2026-09-24，独立 headless Chromium，开发服务 `http://127.0.0.1:5177/`。采集时源码哈希见 `version.json`。本目录由根协调者从本机输出封存；脚本仍使用原 `output/playwright/full-lab-flow` 输出路径。

- 最终 `results.json`：**90/90 通过**；默认、四车型切换和 RNC 关闭共 6 个真实 Worker 结果。
- 24 个 q/x/u/d/a/e 通道逐个点选，核对图表标题、单位、试听保持或座位/比较同步；q 更换说明并清除旧 MIC 高亮。
- 四车型切换后禁止播放/重播/seek，要求重算；真实 Worker 返回配置与车辆类型一致。
- `8s → 改配置` 清除旧实验时间、图表标题与声场说明；首次实测存在残留，根协调者修复后此项通过。
- RNC 关闭后，测试附加的只读 Worker message 监听遍历全部返回样本：`max|u|=0, max|a|=0, max|d-e|=0`，整体降噪为 0。该测试没有替换计算、修改消息或注入结果。
- 1440、950、680、390、320px 页面无横向溢出；12 个关键字段通过 accessible role/name 唯一性检查。
- 播放启动、暂停时间保持通过。测试不证明实物声音、音画物理延迟或目标核显性能。
- 浏览器 JS error/unhandled rejection 为 0；初始 favicon 404 是既有资源项，不声称无 HTTP 错误。

复测顺序：使用新 Playwright CLI 会话打开 about:blank，运行 `setup.js`（注册只读监听后载入 URL 并等待默认结果），读取 DOM 快照，再运行 `check.js`。`check.js` 会改变该会话的实验配置和视口；服务由主任务启动，此测试不启动第二个服务。主页面源码热更新会重载实验，因此最终复测需要短时间源码冻结。

`results-initial.json` 保留修复前原始观察，不能作为当前验收：当时 8 个下拉框断言用 `getByLabel` 的精确查询失败；复核 accessible tree 发现字段有正确名称，改用 `getByRole('combobox', {name, exact:true})` 后通过。这 8 项属于 QA 定位方式问题，不是应用缺陷。旧时间/标题/场状态的实测残留才是本轮修复的问题。

截图：`desktop.png`、`mobile-390.png`、`mobile-320.png` 为整页；`mobile-viewport.png` 为390px视口，已目视检查。
