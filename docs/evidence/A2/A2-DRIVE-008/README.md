# A2-DRIVE-008 · 同车道路仿真与座舱观察

2026-10-02 · Role: A2 · Identity-Source: user-declared · Codex 代 A2。

用户要求实验中车辆行驶于对应路面、车外上帝视角和车内位置查看、整车同步定位，以及高清且尽量接近实景的动态环境。沿用 interactive-3d-atlas，保护此前五车型、四展厅环境与连续声场的本地成果。本批只在本地，未发布新认领或上传。

## 实现与运行语义

- 声场实验页默认进入 P7+ 道路；保留“声场检视”回展厅检查连续体积和切片。道路也可打开声场透视。
- 车外跟随、上帝视角、主驾、副驾、左后排、右后排。车内眼点取自现有 P7+ 座椅的模型坐标，拖动只环顾，不绕座位转圈；整车俯视小图从同一车模渲染，标记对应眼点和朝向。图表/试听座位同步选择。
- 道路、标线、护栏、树木和石块按 `distance = experimentTime × speed / 3.6` 更新；轮组绕真实轴心滚动，制动卡钳保持固定。不移动物理麦克风/源坐标，不创建第二个播放时钟。暂停、后退定位、重启均由已有实验时间决定。
- 12 个48米路段循环复用，路旁实例由世界路段编号确定；回放相同位置重建相同景物。重复池保持有限数量，不随实验时长无限积累。
- 平整/粗糙沥青、碎石保持与预设粗糙度接线；手动数值仅选择最近视觉类别，不反写计算参数。视角和环境不重启实验；路面预设按既有规则使旧实验失效后重算。
- 田野公路、山地、沙漠和雪山环境可切换。车内降低外观深色玻璃的显示不透明度，退出恢复；仅改变观察呈现，不改变车型或物理结构。

## 高清素材与许可

均从 Poly Haven 官方来源下载，CC0，允许随应用分发。JPEG原生尺寸与SHA256见 `asset-manifest.json`，运行时本地加载，不依赖外网。

| 素材 | 作者 | 本地使用尺寸 | 用途 |
| --- | --- | --- | --- |
| [Small Rural Road](https://polyhaven.com/a/small_rural_road) | Andreas Mischok | 8192×4096 | 田野公路实拍全景远景 |
| [Asphalt 02](https://polyhaven.com/a/asphalt_02) | Rob Tuytel | 4096×4096颜色、2048×2048法线 | 沥青表面 |
| [Gravel Floor](https://polyhaven.com/a/gravel_floor) | Matterfield摄影 / Jenelle van Heerden处理 | 4096×4096颜色、2048×2048法线 | 碎石表面 |
| [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock) | Rob Tuytel | 2048×2048 | 路旁地形和石块 |

[CC0许可](https://polyhaven.com/license)。山地/雪山/沙漠远景使用前批已有4K HDR，来源见 `src/team-a/viewer/assets/CHAMPAGNE-ENVIRONMENT.md`。树木/叶片/护栏/道路和自动排布是原创三维代码；全景只负责远景，路旁有真实三维运动视差。Small Rural Road 的额外HDR下载失败，未使用；采用成功下载的8K LDR远景与已有环境光，不声称取得了新HDR。

## 文件范围

- `viewer/driving-road.ts`、`scene-stage.ts`：道路、纹理和景物生命周期。
- `viewer/driving-state.ts`：眼点、距离和确定性路段；`wheel-motion.ts`：轮轴旋转。
- `viewer/driving-view.ts`：六视角、环顾、同车小图和观察状态。
- `viewer/lab-viewer.ts`：相机/场景/车轮和现有实验时钟接入。
- `viewer/p7plus-model.ts`：标记真实轮轴、固定卡钳与玻璃材质名；无外形重建。
- `lab/champagne-shell.ts`、`champagne.css`：用户明确授权的A组页面控件、座位联动和响应式样式。
- `tests/a2-driving.test.ts`、根开发记录、A2交接及本目录。无 B/shared/integration/数值算法/fixture 修改。

## 验证记录

最终源码 `pnpm check` 通过：206/206测试、TypeScript、模块边界和生产构建；原始日志为 `check.log`。构建仍提示应用包大于500kB，未隐藏该提示。源码SHA256见 `source-manifest.json`。最终Chrome检查148项通过：驾驶43、产品69、高DPI模型交互12、连续声场24。结果分别为 `browser/results.json`、`product-regression/browser-results.json`、`interaction-results.json`、`field/results.json`。最终四套结果无JS/Shader错误，含资源监控的套件无失败资源；前轮偶发HDR中断见下文。DPR2绘图3840×2004，布局覆盖390至3840宽度。实际检查暂停/回退像素、实时Worker时钟、四座与图表/试听联动、四环境、路面参数、旋转/拾取/拆装与原有声场切片。

第一轮新增道路测试错误使用浮点加减的严格等号，47.9出现约7e-15舍入差异；该新显示测试改机器精度界限，未修改既有声学基准或容差。原失败保留 `first-check-failure.log`。首轮截图发现车窗太暗及树冠球团感，后续已改透明度和叶片几何；中间截图保存在本机 `test-results/drive-refine`。

首次暂停PNG逐字节相等检查失败；解码比对仅25像素相差1个8-bit色阶（车漆GPU栅格舍入），实验时间、位置和几何不变。最终暂停/回退图像检查允许每通道最多1色阶；时间和里程仍严格相等。保留 `browser/first-pause-failure.json`、`second-pause-failure.json` 和 `pause-difference.json`；未修改声学比较容差。

前两轮驾驶浏览器功能42项通过，但资源断言记录个别HDR请求 `net::ERR_ABORTED`（一轮与产品并行、一轮独立），页面各环境均达到加载就绪且无JS/Shader错误；保留 `browser/concurrent-request-failure.json`、`isolated-request-failure.json`。追加请求类型/步骤诊断后的独立末轮43项通过，0请求失败。尚未确定偶发中断根因，不能据末轮通过声称它已经修复；目标设备需继续观察大纹理加载稳定性。

人工复核修正桌面俯视被分析面板遮挡及雪地草色问题。雪地/沙地使用对应颜色、保留实拍表面凹凸。

## 适用范围与交接

这是参数化声学实验的行驶可视化：直线恒速、世界相对车辆平移，不是车辆动力学、实测路线重建或摄影级自动驾驶模拟。道路粗糙度影响已有噪声计算，未把装饰地形当作实测轮胎激励。视角眼点与声学麦克风职责不同；小图坐标只表示当前模型中的观察位置。

本机Chrome验证不能代替目标核显/其他浏览器、第二设备或用户最终视觉验收。摄影级植被、真实道路曲率/转向/悬架动力学不在本批已验证结果内。

分支 `a/a2-xpeng-reconstruction`，基线 `a88536a58d5f489cb245246d243dd0eb23b333e1`，本批无新提交SHA。仅本地，GitHub尚未同步。预览 `http://127.0.0.1:5197/`。下一步用户视觉验收和目标设备表现；上传须新的明确指令。
