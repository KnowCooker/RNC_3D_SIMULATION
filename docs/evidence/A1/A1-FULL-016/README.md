# A1-FULL-016：空间改善与变差的同帧证据

Role: A1；Identity-Source: user-declared；执行者 Codex 代 A1。任务由[原仓库草稿 PR #42](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/42)认领。该批只改 A1 页面展示，不改 A2 viewer、B 数值、shared/integration 或旧基准。

三维场已有原声 d 和残余 e 的 280 点 SPL 及固定色标，但只看绝对颜色容易把四座 MIC 的改善外推成“整个车厢都改善”。本批直接读取**同一有效 `FieldFrame` 的 B 计算 `reductionDb`**，在三维舞台场图例旁显示实际可比采样点中改善、接近持平、变差的数量、改善量中位数及范围。`d−e` 为正表示该采样点变安静，为负表示变吵；绝对值不超过 0.05 dB 归为接近持平。条形长度只描述本帧采样点数量比例，**不是非均匀采样的车厢体积占比**，也不是实车结论。无效、错位、非有限或旧实验帧不会产生该判断。

## 实际验证

- A1 专项测试覆盖正/负/近零、中位数、无效帧、数组不匹配和非有限点；`pnpm check` 包含类型、源码边界、全仓测试及生产构建，最终结果以本 PR 最新提交的日志与 CI 为准。
- [真实生产页脚本](qa-field-evidence.js)和[原始返回](browser.log)：ICE、HEV、EREV、BEV 各完成 10 秒真实 Worker 预计算，末尾同一 0.5 秒 A 计权窗口各有 280/280 有效空间样本，改善/持平/变差计数逐车相加均为 280。BEV 为 124 / 2 / 154，改善量中位数 −0.3 dB；四座 MIC 指标同时为正改善，说明目标点与空间其他位置不可混为一谈。页面脚本错误和失败资源请求均为 0。
- 生产构建 `dist/index.html` SHA-256 为 `715ebd0f11f87bdb7bca7fd1732ffbcd513c537b436dca4cd888a1677cbcb17c`，主页面脚本 `dist/assets/index-3cGj1Tld.js` SHA-256 为 `cfe8ccb34763736c9f783b4051104214fea4096dc7b8459fda15fbe5259d635c`。候选运行源码与本证据在同一功能提交中固定；这是本机生产构建，不是最终同车交付包。
- 切掉声场后立即隐藏空间判断；A→Z 计权先清旧值再显示新 `Z` 场；移动真实采样剖面及改变路面参数时都先清旧值。390 px 视口实际网页宽度 375 px、文档滚动宽度 375 px，证据条可见且无横向溢出。
- [桌面三维舞台与同帧证据](stage.png)、[窄屏证据条](narrow-evidence.png)。本机截图与浏览器流程只说明该版本的教学布局，不证明四车型写实同车坐标、目标核显或实物声学效果。

复现：在仓库根目录执行 `pnpm check`，设置端口后 `pnpm start`，用 Playwright CLI 打开页面，并执行 `run-code --filename docs/evidence/A1/A1-FULL-016/qa-field-evidence.js`。源代码/构建版本与提交 SHA 在 PR 中固定；后续运行代码变更须重验。
