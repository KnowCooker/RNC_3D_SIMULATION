# A1-003 交互、图表与布局

日期2026-09-23；实现`45fe841`，基线`2cd4bee`；[PR #5](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/5)，先合并#4。用户随后要求本轮完成A1/A2最终目标，本PR同时承载A1-004本机验收，运行时源码限A1的app/charts。

## 实测问题和修复

- 基线选择“对比原噪声”再点MIC RR：图表`RR · e / Pa`，试听仍`d`。现在MIC默认e、试听同步e；切d时保留MIC高亮。查看x/u不会更换试听座位，界面明确分别显示图表和试听内容、单位。
- 基线390px窗口产生792px页面，四点指标被CSS隐藏。现在320/390/800/801/900/1440px页面无横向溢出，指标与播放控件均可滚动访问。
- d波形不再重复叠画两次；图例按信号更新，小声压刻度保留有效数字。没有降噪指标的收敛区间留空，不补成0dB；RMS与PSD准备状态分别按实际返回值显示。
- 前台恢复立即从播放器唯一时钟刷新；d在传给viewer时映射到同角MIC的e标记，不改viewer接口或数值含义。

## 验证与复跑

- `pnpm check`独立19/19通过（新增2项绘图真实性测试）；组合A2后22/22通过，构建成功。A1功能提交[CI成功](https://github.com/KnowCooker/RNC_3D_SIMULATION/actions/runs/35872494503)。
- 独立[26项浏览器断言](browser-results.json)，组合[26项复测](combined-results.json)均通过。[脚本](browser-check.js)在真实应用运行，检查点选/座位/单位、0.49/0.50/0.52秒准备边界、16秒结束、六种宽度、图表与播放UI时间。
- 组合四轮源[43项断言](sources-results.json)通过；复用A2源码分支中的`docs/evidence/A2/A2-003/browser-check.js`，不复制另一角色测试。四轮SOURCE为示意，点击查看同角REF，不增加测量信号。
- [恢复测试4项](recovery-results.json)通过，[脚本](recovery-check.js)使用真实AudioContext、浏览器CDP冻结2秒/恢复和暂停后恢复，时钟无替换；观察音频与UI前进量一致，暂停时不跳转。Playwright自身启用focus emulation，普通切tab/最小化仍报告visible，因此没有将该环境冒充未受控浏览器的真实后台测试。显式visibility事件检查了恢复处理器；实物端到端音画延迟仍待测。
- [窄窗指标](narrow-metrics.png)、[窄窗播放](narrow-player.png)已目视核对。原有favicon404和构建大于500kB提示不影响本轮断言，未声称清零这些提示。

启动`pnpm dev --port 5173`，Playwright CLI独立session打开页面并snapshot，再`run-code --filename docs/evidence/A1/A1-003/browser-check.js`。组合冻结版本`838cdf3`可用5175端口同法复跑；恢复脚本会reload并仅在测试页面观测AudioContext。前台时间样本差≤100ms只是UI时钟检查，不能替代麦克风/屏幕实测。

本机长稳与独立离线包记录归[A1-004](../A1-004/README.md)。数据、B组算法、shared/integration和音频增益未改变；源码与A2分支互不混入。

组合[完整界面截图](combined.png)已目视检查；冻结源码可从[候选分支](https://github.com/lzhdai/RNC_3D_SIMULATION/tree/a/candidate-20260923)获取，两个角色继续保留独立PR。
