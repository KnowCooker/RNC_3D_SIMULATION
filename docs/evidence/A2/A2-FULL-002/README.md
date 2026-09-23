# A2-FULL-002 — 原创模型、逐部件剖面、安装件回归

日期：2026-09-24。工作区 `RNC_3D_SIMULATION_FULL`，PR #7 的 `79df17b` 后本轮未提交变更。仅证明下述测试和截图对应的范围，不宣称最终视觉目标已验收。

## 可复现范围

独立 Chromium 页面调用生产 `createLabViewer` 与模型工厂，使用 Vite 5177 服务；无测试替代模型。`viewer.html` 是隔离夹具，`final-screens.js` 是 Playwright CLI `run-code --filename` 脚本。可将本目录夹具复制到 `output/playwright/visual-v4/` 并打开相应 URL，再执行脚本。截图与数据存在该目录路径，便于与原始脚本一致。

渲染：ANGLE / NVIDIA GeForce RTX 4070 Laptop GPU / D3D11，视口 1500×1000，DPR 1。四车型各完成完整外观截图；HEV 完成 X/Y/Z 剖面和隐藏车壳座舱。截图是实际 WebGL 输出，没有后期改绘。

- [ICE 外观](ice-solid-front.png)
- [BEV 外观](bev-solid-front.png)
- [HEV 外观](hev-solid-front.png)
- [EREV 外观](erev-solid-front.png)
- [HEV X 剖面：独立截面与空气间隙](hev-section-x-visible.png)
- [HEV Z 剖面](hev-section-z-visible.png)
- [HEV 座舱](hev-cabin.png)

`screens-result.json` 记录静态剖切：X=0 的 45 个封口/47 条轮廓组，Y=1.06 的 42/46，Z=0.1 的 14/23。数量按部件网格计，不是封闭连通区域总数。BEV→HEV→EREV 切换中，装在 `charge-system` 的 REF 依次有效/报告缺失/恢复有效；未展开物理坐标始终为 [-0.99,1.08,-1.88]。

## 组合和瞬时耗时

`performance.js` 对 HEV 无剖面、X=0、Y=1.06 各预热 140 个 RAF，然后采样爆炸动画期间 200 帧；同时更新车轮转动。每帧以 `performance.now()` 测量一次真实 `viewer.render` 调用，不能等同 GPU 定时器或最终应用 FPS。结果见 `performance-result.json`。

| 模式 | CPU render 中位数 | p95 | 最大值 |
| --- | --- | --- | --- |
| 无剖面 + 爆炸 | 8.3 ms | 10.7 ms | 12.2 ms |
| X 剖面 + 爆炸 | 6.7 ms | 8.6 ms | 13.4 ms |
| Y 剖面 + 爆炸 | 10.4 ms | 14.2 ms | 18.3 ms |

剖切删除的可见面与截面数量不同，因此模式成本不要求单调增加。爆炸时所有封口顶点到世界剖切面的最大误差小于 2.7e-8 m；隐藏源网格没有残留封口/轮廓。X 模式 200 帧尚未完全到达吸附阈值（座舱 y=0.4497865），这是采样时长差异；Y 与无剖面到达精确 y=0.45。此次不是低端设备或长期压力验收。

附着脚本回归采用明确的测试场输入，只用于检验坐标/选择，不验证声学正确性：Q1–4 选择 q0–3；13 个锚点、32 条路径、32 个光点、12 个波前位置正确；停用一个扬声器隐藏其 4 条次级路径和 3 个波前；玻璃保持透明。脚本与结果保存在 `attachment-setup.js`、`attachment-checks.js`、`attachment-result.json`。该组脚本先建立独立覆盖层，再对实际生产 viewer 做几何断言。

## 自动检查与剩余差距

- `tsx --test tests/a2-sections.test.ts tests/a2-vehicle-model.test.ts`：6/6 通过；包含截面面积/法线/非均匀变换、顶点与边相交、相切去重、圆环孔洞/分离岛、开口面不封口、层级隐藏、材质透明和模型纹理释放。
- `tsc --noEmit`、A/B 导入边界、`git diff --check` 通过。
- 独立浏览器仅观察到 `favicon.ico` 404，未观察到 WebGL 或应用 JavaScript 错误。

外观仍属详细教学模型，尚未达到《地平线》级精细度；曲面和座椅可读性提高，但完整纹理、紧固件/焊缝、生产级机械细节、真实线束/软管尚缺。剖面针对当前网格，不声称支持任意非流形 CAD；显示蒙皮厚度不等于实车钣金规格。完整 A1/B 流、音频、长跑、目标核显、触控/窄屏和最终视觉逐视角验收由后续集成证据补齐。
