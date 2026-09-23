# A2-FULL-009 全开场、路径与波前的可读性

本批从 A2-FULL-008 已提交版本 `d74522a` 开发，对应[草稿 PR #14](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/14)。经验证运行源码 SHA 将在后续证据固定提交中填写；草稿 PR 未合入 main。

真实 Worker 页面同时开启残余声场、初级和次级路径、波前、透明车身时，原先 32 条路径同样显示且与 280 个场点/切片叠在一起，无法从选中的信号追踪对应路径。现在 viewer 利用 A1 已传入的 `selected` 信号标识突出关联路径，其余在所选路径模式内保留并淡化：轮端 `q` 对应源到四麦克风的四条初级路径，扬声器 `u` 对应四条次级路径，`d/a/e` 分别对应所选麦克风的初级/次级/两类路径。参考 `x` 只是测量信号，不被误作轮端源。禁用扬声器的次级路径继续不显示，说明明确标出停用。全开时场点/切片和波前降低不透明度；高亮线在模型和色片上作为**直线示意叠层**显示，不代表声线求解或结构真实遮挡。B组场值、280点、固定色标、硬件物理坐标、viewer API 和统一时钟未改。

## 可复现证据

- [同视角采集脚本](capture-layer.js)、[改动前状态](before.json)、[改动后状态](after.json)：真实 BEV Worker 页面在双路径+波前下拍摄无场、三维场、Y 切片、Y 切片+爆炸、Y 切片+剖面五组。例：[全开三维场改动前](before-bev-all-volume.png)/[改动后](after-bev-all-volume.png)，[Y 剖面改动前](before-bev-all-y-section.png)/[改动后](after-bev-all-y-section.png)。同页选中 MIC FL，改动后 8/32 条路径突出，其余未从所选模式删除。
- [真实界面交互脚本](verify-interactions.js)和[九组原始结果](interactions.json)：BEV 中 Q1 为 4/32、x 为 0/32、OUT1 为 4/32、MIC FL 残余为 8/32；仅次级模式 OUT1 为 4/16；禁用 OUT1 并重新计算后为 0/28；ICE/HEV/EREV 各自真实重算后 MIC FL 为 8/32。场状态均对应真实“空间窗口截至”，无页面脚本错误。截图包括[Q1聚焦](after-bev-q1.png)、[x非声源](after-bev-x1.png)、[禁用输出](after-bev-disabled-u1.png)及另外三车型。
- [420px 窄窗](after-narrow.png)和[360px 窄窗](after-narrow-360.png)：路径说明变为短文案，几何边界与结构选择器不重叠。浏览器为 Windows Chromium/ANGLE NVIDIA RTX 4070 Laptop GPU，**不代表目标核显**。
- 本机 `pnpm check` 通过类型、A/B源码边界、65/65测试和生产构建。没有新几何/纹理；新增 viewer 内说明 DOM，路径/场材质只改显示优先级和透明度。生产 `dist/index.html` SHA-256 为 `2D1D7AFFAEDA3565E90618C311C00BA6541A6287D390E3A95AF0DBFCA548999C`，viewer构建文件 `dist/assets/index-AW8GS39K.js` SHA-256 为 `F8B9C66FD9B7855D00395E6A9E2B5BD472928C1D642FABE1ABB6C5105CB3A5D4`。

仍有局限：全开叠层在复杂视角下仍会密集；高亮是为教学可读性覆盖显示，不能作为真实结构遮挡或能量大小证据。四车型动态穿剖、长时间录屏、目标核显帧率和最终游戏参照视觉质量未在本批完成。下一独立 A2 任务应做动态录像和不同切面位置的整页检视，并继续与 A1 协同同版本交付。
