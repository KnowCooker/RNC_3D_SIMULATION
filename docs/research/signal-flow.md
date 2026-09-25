# 多通道 FxLMS 信号流说明

新增组件：`src/team-a/lab/signal-flow.ts`、`signal-flow.css`。读取调用方的统一回放时间，只展示信号拓扑与选择状态，不计算声压、降噪量或权重，也不启动独立计时器。

## 依据与符号

2026-09-24 校核的一手来源：

- [MathWorks：Active Noise Control Using a Filtered-X LMS FIR Adaptive Filter](https://www.mathworks.com/help/audio/ug/active-noise-control-using-a-filtered-x-lms-fir-adaptive-filter.html)：主动控制需考虑扬声器到误差传感器的次级路径；参考经过估计次级路径参与控制适应，误差传感器观测的是叠加后的残余声。该示例引用 Kuo 与 Morgan 的 *Active Noise Control Systems: Algorithms and DSP Implementations*（1996）。
- [MathWorks：dsp.FilteredXLMSFilter](https://www.mathworks.com/help/dsp/ref/dsp.filteredxlmsfilter-system-object.html)：明确区分实际次级路径系数、估计次级路径系数和控制器系数，步长决定更新尺度。这里只参考算法角色与路径关系，没有移植 MATLAB 示例数值。

本项目采用实际声压相加的符号约定，对误差点 m、参考 r、扬声器 j：

```text
d_m = Σ_i H_mi * q_i
u_j = Σ_r W_jr * x_r
a_m = Σ_j S_mj * u_j
e_m = d_m + a_m
xFiltered_mjr = S_hat_mj * x_r
W_jr 的梯度方向包含 Σ_m e_m · xFiltered_mjr
```

`*` 表示卷积；更新方向在上述 e=d+a 约定下为负梯度。界面不展示简化更新量或把固定反相作为计算结果；正规化、泄漏、步长等仍以引擎实现为准。某些文献把控制输出的负号放在求和器中，从而写作 e=d-y；不能直接混用两种符号。

参考可为 1–8 路，输出与误差点固定各 4 路。因此控制器有 `4 × Nref` 组滤波器，次级通道保留 16 条交叉路径。显示扬声器禁用时仍允许查看其零驱动信号；多个启用扬声器共同影响所有误差点，a 不是单个扬声器的局部读数。

四轮源 `q` 也有四个可选择通道，单位为本教学模型约定的等效轮端激励 m/s²。它来自计算结果的 `sources` 数组，与结构上的参考传感器 `x` 不是同一信号。q 的选中状态、说明与图表回调独立更新，不将源点冒充同角参考测量。

## 集成约定

```ts
const flow = createSignalFlow(host, (signal, channel) => selectSignal(signal, channel));
flow.setChannels(referenceNames, enabledSpeakers); // 必须来自当前已生效实验
flow.setSelected('e', 0);                          // 外部选择同步，不触发回调
flow.render(playbackTime, playing, controlActive); // 不传待重算的 UI 开关
flow.dispose();
```

- `setChannels` 要求 1–8 个非空参考名称和 4 个布尔扬声器状态；无效配置抛出 RangeError。删除已选参考后本组件将选择回到第 1 路，页面应同时同步自己的图表选择。
- `render` 的控制布尔量表示当前生效的控制状态。若实验有前置基线，应传 `config.rncEnabled && time >= adaptationStartsSeconds`。不要因仅切换原声/残余试听而改变控制状态。
- 控制未生效 / 全部扬声器禁用时，显示 `u=a=0, e=d`；控制侧虚线静止、变暗。驱动关闭后的瞬态若由未来引擎保留滤波器尾音，此布尔 API 需扩展，不能继续声称瞬时 a=0。
- 箭头虚线移动仅表示方向，偏移直接取自统一时间；同一时间调用任意次数均相同。暂停时回放时间固定，拖动回放位置会更新图示。它不表示声速、测量值或实时学习进度；系统偏好减少动态时保持箭头静态。
- 容器窄于 650px 时使用可读的等价文字路径，通道按钮保留全部功能；HTML 按钮、SVG 框图均可用键盘操作。自定义参考名使用 `textContent`，不注入 HTML。

此组件没有自动判定步长和收敛阶段；权重更新框注明 μ=0 时权重不变。准确的实验状态、信号数组与参数仍由父页面/计算引擎负责。

## 本机组件验证（2026-09-24）

- 独立 TypeScript 严格编译通过；A/B 源码边界检查通过。
- Chromium 中的独立组件页面 45 项断言通过：8 路参考及另外四类各 4 路信号逐个选择、SVG Enter/Space、禁用扬声器选择、统一时间推进/暂停后静止、RNC 关闭与全部扬声器禁用状态、1 路/8 路拓扑、非法维度拒绝、自定义名称作为纯文本、减少动态偏好和幂等销毁。
- 1440 / 800 / 650 / 390 / 320px 视口均无页面横向溢出；390px 切换为可读文字路径，所有通道和说明仍可访问。已查看桌面与窄窗截图。
- 独立浏览器验证无 JavaScript 页面异常；页面初始 favicon 请求 404 是既有资源缺失，不作为无网络错误的证明。
- 在整页接入实际源信号后扩展 `q` 选择：固定四个 SOURCE 通道，回调和 API `setSelected` 均支持 q；其它信号保持原有语义。新增行为已由整页 90 项断言验证，其中包括全部 24 个信号按钮、四路 q 的图表/单位/说明/高亮清除及试听保留；原始结果位于 `output/playwright/full-lab-flow/results.json`。
- 原始组件测试入口、脚本、结果、截图在本机 `output/playwright/signal-flow/`（忽略目录），由集成负责人封存。该验证证明组件行为，不替代整页选择联动或实际算法数值验收。

复测时启动 Vite，通过独立测试页导入组件，依次调用 API 并检查通道回调、样式偏移及状态文本；避免在正在热更新的主页面中替换 DOM 作为长期测试入口。集成后还需核对模型点选与本组件的通道编号一致。
