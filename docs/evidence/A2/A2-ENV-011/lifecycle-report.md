# A2-ENV-011 展厅生命周期与平台独立实测

Role: A2；Task: A2-ENV-011；Identity-Source: user-declared；Executor: Codex代A2。记录于2026-10-09（Asia/Shanghai），本次会话跨2026-10-08/09。此报告记录独立几何/真实WebGL证据，不替代正式产品页面、目标设备或长稳验收。

## 最终结果

- 真实 Chrome / Three.js WebGLRenderer，960×600，4环境依次切换两轮，每次90个真实RAF渲染帧、每帧推进1/60秒场景过渡。四环境照片实际均8192×4096。
- 38项独立检查通过：主生命周期30项、异步销毁新增5项、runner错误/资源/源码一致性3项。`late.checks`含此前30项，不能把两个返回数组相加冒称65项。
- 每个完整gallery有14个实例对象：4个景观实例、8个亭内树叶实例、2个平台实例。两次调用dispose后，每个实例dispose事件恰一次；父场景节点移除。
- 天空前/后纹理及活动HDR在渲染中不提前释放；外部protected背景照片跨两轮切换保持有效，最终释放一次。主场景跟踪的18个纹理最终均dispose一次。
- 第二个gallery创建后立即连续销毁两次，再将真实本地图片/HDR请求延迟1秒。两张图片（2048×2048地表纹理和8192×4096照片）及4096×2048 HDR在返回后释放一次；另有128×128波纹和针叶CanvasTexture，也均释放一次。未使用假renderer或合成加载结果。
- 最终0页面/GLSL/资源错误，6份生产源码前后SHA256一致。运行时Program集合第二轮保持50，无进一步增长；dispose事件不能等同于对浏览器驱动显存的精确测量。
- 植被专项及既有环境专项10/10通过，类型检查通过。coast取消针叶树、保留岸草石；mountain/snow保留干地与台阶净空，在140–235m范围形成高低不同簇群。

## 文件与重现

- `lifecycle.html`、`lifecycle-fixture.ts`：从实际生产源码创建场景，观察真实资源事件。
- `lifecycle-browser.mjs`：连接本地Vite `http://127.0.0.1:5198`，运行8次切景和异步销毁。
- `lifecycle-results.json`：最终原始结果及六文件SHA256。
- `lifecycle-actual-webgl-snow.png`：生命周期最终场景实图。fixture灯光和相机用于独立检测，不代表产品默认构图或曝光。
- `lifecycle-platform-browser.mjs`、`lifecycle-platform-results.json`：同版平台截图与源码一致性。
- `lifecycle-platform-whole.png`、`lifecycle-platform-stairs-east.png`、`lifecycle-platform-stairs-west.png`：实际平台及两侧台阶。为检查结构，只在fixture隐藏亭顶、立柱、长椅和盆栽，保留真实平台、岸坡与天空；这不是产品默认可见状态。

运行工具：仓库`test-results/a2-tools/node-v22.14.0-win-x64/node.exe`、`test-results/a2-tools/browser/node_modules/playwright-core/index.mjs`及已安装Chrome。启动本项目Vite于5198后，用Node22运行本目录两份`*-browser.mjs`。它们写出本目录或`test-results/env011/lifecycle*`证据，不修改生产源码。

## 失败与范围

第一轮fixture初始化等待超时，含无关favicon 404；第二轮fixture漏算平台两个实例，且runner吞下异步拒绝后继续等截图信号而超时。两份原始失败保留为`lifecycle-first-fixture-failure.json`及`lifecycle-second-fixture-failure.json`；修正的是fixture计数、等待与错误传播，未放宽生产断言。早期视觉修正前的通过结果保留为`lifecycle-before-visual-refinement.json`。

首张60m高位平台检视图出现深度条纹，保留于`lifecycle-platform-whole-initial-depth-precision.png`。该独立镜头远超产品20m环绕范围；把fixture该镜头近裁面由0.1m改为1m后重新拍摄，生产几何/材质未改变。台阶图仍使用0.1m近裁面。

单元测试曾因受限进程tsx读取用户信息失败而未运行，采用已授权的Node22提权运行通过；最后植被专项首次自动审批超时未启动，按工具允许重试后10/10通过。无未执行项目记为通过。

本次有限帧与两轮切景不能证明所有设备无闪烁或长时间GPU零泄漏。摄影与程序地形是展示环境，并非实地扫描；全场精确碰撞与原厂车辆零件完整度不属于本独立fixture的证明范围。
