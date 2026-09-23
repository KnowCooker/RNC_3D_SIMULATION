# A2-FULL-008 四车型共用外观近景

本批从 A2-FULL-007 已提交基线 `e32a40c` 开发，对应[草稿 PR #13](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/13)。经验证的运行源码 SHA 在后续证据固定提交中填写；不能将未合并 PR 当作 main 已交付。

改动仅在 viewer 教学车模：前灯内部短灯条和转向灯、后灯分段及倒车灯、六块玻璃的直边密封条、程序生成的轮胎凹凸纹理、座椅嵌片和靠背收窄。所有新增几何及纹理使用本仓库代码原创生成，无外部模型/贴图许可依赖。车型部件 ID、四轮中心、五座/四误差点、车门扬声器、参考安装物理坐标及声学模型未改。玻璃线从曲线改为直边，避免近景车顶出现悬空弧线。

可复现证据：`capture-compare.js` 在同一 Chromium/WebGL 夹具、相同相机与车身模式拍摄基线 BEV 七视角 `before-*` 和新版四车 V1–V4 `after-*`，另拍 BEV 三个细节近景；相机、GPU、网格数见 `before.json` / `after.json`。例如[改动前车侧](before-bev-v2-side.png)与[改动后车侧](after-bev-v2-side.png)、[改动前车头](before-bev-front-detail.png)与[改动后车头](after-bev-front-detail.png)。`full-app-check.js` 在真实 Worker 页面复查 BEV 合拢、透明、隐藏、展开，原始结果 `full-app.json` 及 `app-*.png` 保留。截图设备为 NVIDIA RTX 4070 Laptop GPU / Chromium / 1500×1000 夹具或 1440×1000 整页，非目标核显。

本机 `pnpm check` 通过类型、A/B 边界、65/65 工程测试和生产构建；既有模型测试覆盖 GPU 资源释放和物理结构不变。四车型最终三角数：ICE 46,568、BEV 46,556、HEV 48,812、EREV 49,484，均低于当前 50,000 预算。生产主包 `dist/assets/index-DeluK8gK.js` SHA-256 为 `464ef717db6d25af0e5680264824d0b6a49a9e5fc9b6c85314cd30aa45e89e2f`。

本批改善近景层次，但外形比例、轮拱与门缝、轮胎立体花纹、驾驶台、动力附件仍是教学级造型；尚无同条件游戏参照人工验收，A2-F2 最终视觉质量**未通过**。目标核显 30fps、全开场/路径遮挡、动态剖面录像及同版本正式包仍待验证。下一批应处理整页全开叠层和参照差距，不能凭本批截图宣称 A 组最终交付。
