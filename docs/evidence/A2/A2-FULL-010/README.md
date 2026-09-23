# A2-FULL-010 四车型动态剖面与真实场录像

本批基于 A2-FULL-009 已提交 `569b6a9`，对应[草稿 PR #15](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/15)。经验证运行源码 SHA 在后续证据固定提交中填写；开放 PR 不等于 main 已集成。

## 动态证据与实际结论

- [四车型动态剖面录像](dynamic-sections.mp4)：真实 lab-v3/Worker 页面的静音屏幕录制，2:10.75、1440×1000、20 fps、H.264，SHA-256 `F74A70449C1DE7BC4246591A525F826F30D9FCE4B7450C1C0AB9241A5276D27F`。顺序为 BEV、ICE、HEV、EREV，各车型连续调整 X/Y/Z 结构剖面，再看固定真实采样色片与 Y 剖面展开/收拢。视频经等尺寸 H.264 转码，无补帧、合成声场或替换车模；**没有音轨或人工解说，不是最终约五分钟全应用讲解**。
- [可复现录制脚本](record-dynamic-sections.js)及四车型原始状态：[BEV](bev.json)、[ICE](ice.json)、[HEV](hev.json)、[EREV](erev.json)。每车 X 轴从 −1.1 到 1.1 m、Y 轴从 0.45 到 1.9 m、Z 轴从 −1.8 到 1.8 m，各九个 UI 滑块位置；再显示每轴固定采样色片及一次 Y 剖面展开/收拢。每车 33 条、共 132 条状态记录；每车型内部的 run 标识不变，场窗口均截至 3.91 s；四车均无页面 JavaScript 异常及 WebGL 上下文丢失。标记随裁剪隐藏，在每轴中央固定色片状态为 8 个可见，未裁剪起点为 16 个。每车三轴和展开视图各有一张同版 WebGL 截图，如[BEV X](bev-x-slice.png)、[ICE Y](ice-y-slice.png)、[EREV Z](erev-z-slice.png)、[BEV 展开](bev-exploded-y.png)。
- [360px 窄窗检查脚本](check-narrow.js)、[原始结果](narrow.json)及[截图](narrow-field-note.png)：固定场片说明与可见硬件标签相交数为 0。环境见[原始浏览器信息](environment.json)：Windows Headless Chromium 153、ANGLE NVIDIA RTX 4070 Laptop GPU/Direct3D11，非目标核显。
- 本机 `pnpm check` 通过类型、A/B 源码边界、65/65 测试和生产构建；同版 `dist/index.html` SHA-256 为 `5A40D51ED4BE2F399B5B23A9888865A4C15925B624C9DB3470B1B4148100F057`。新增的 viewer 文案从原 280 点几何读取实际固定平面坐标：X=0.00 m、Y=1.48 m、Z=0.54 m；桌面标明“车身剖面另行移动”，窄窗显示短说明。B组计算、物理坐标、既有场值/色标、viewer API 与统一时钟未改。

复现：在仓库根启动 `pnpm dev -- --port 5183`，用 Playwright CLI 打开 `/?captureVehicle=bev`，执行 `video-start` 后运行本目录脚本；对 ice/hev/erev 分别先导航到对应 `/?captureVehicle=<车型>` 再运行同一脚本，最后 `video-stop`。将 WebM 用 FFmpeg/H.264 转为 MP4；四份 JSON 和截图由脚本生成。录制通过实际页面控件与其 `input` 事件操作滑块，并读取真实 Worker 场状态；这属于浏览器自动化证据，不代替人手操作或指定设备性能测量。

## 仍未满足的范围

结构剖面平面可连续移动，**X/Y/Z 声场色片仍固定在已有真实采样平面**；三维采样体随剖切裁剪，但当前没有对任意新剖面请求 B 组新场点。色片即使与结构剖面同轴，也不能解释为在滑块当前坐标重新求解的 COMSOL 式结果。要交付随滑块移动且物理有效的任意位置切片，需要 A2 提供新平面采样点及帧匹配，A1/integration 在结构剖面变化时失效旧场并按同一实验/时间请求 B 组任意点场，B 组确认查询负载和数值语义。该跨端接口尚未实施或验收。四车外观参照质量、目标核显、实物音画、第二台 Windows 离线与整组同版本正式包/讲解也未由本批证明。
