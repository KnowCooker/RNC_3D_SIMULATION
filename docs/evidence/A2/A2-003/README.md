# A2-003：四轮源示意与通道区分

2026-09-23，交付版本见 [PR #6](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/6)。用户扩大本轮范围后，A1明确批准使用现有点选接口。

新增4个紫色轮端圆环及SOURCE FL/FR/RL/RR虚线边框标签，坐标分别为(±1,0.1,±1.45)，表示轮端激励位置。标签说明“查看同角REF参考，不是新增测量信号”；点击调用原onSelect('x',corner)，高亮对应REF。源点不加入原12个data-viewer-*硬件通道，使用独有data-source-corner。没有新增算法输入/测量值/声学路径，也没有宣称源信号与传感器信号相同。

16个标签共用防重叠布局；源码样式仅viewer。新增16个投影重合时的窄视口行为测试。

[43项浏览器断言](browser-result.json)通过：默认、展开、390px窄窗下16标签可见且互不重叠，原12通道保留；每个SOURCE调用同角x并高亮REF，键盘可操作。

复现：参考回放启动后，Playwright CLI独立session打开页面并snapshot，运行 `run-code --filename docs/evidence/A2/A2-003/browser-check.js`。

截图：[默认](default.png)、[展开](expanded.png)、[窄窗](narrow.png)。完整20轮结构验证包含新增源点，见[A2-002](../A2-002/README.md)。
