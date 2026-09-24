# A2-FULL-016 · 写实 SUV 外观范例

> 2026-09-24 用户以道路/车间拆装截图重新明确终点：教学与演示必须是同一车模、同一结构，主界面为三维道路和车间。本页以下证据仅记录独立外观资产的**过渡技术验证**，不代表新视觉目标达标；后续必须将资产、内部部件、声学锚点和两种场景统一。

同车拆装第一轮资产审计可复现：[GLB层级读取脚本](audit-part-hierarchy.mjs)直接解析包内两款 GLB 的节点/网格名称。Range Rover 为 171 mesh、512 node，可从父节点名初筛出 37 类外观/车门/方向盘等前缀，但实际 171 个 mesh 节点均叫 `Object_N`，同一零件被材质分成多个节点；尚未证明转轴、内部机械或真实 37 个可动件。Model Y 为 84 mesh、86 node，84 个 mesh 节点均是通用 `Object_N`，没有可直接用的语义前缀。因而两款资产都不能未经人工分组和部件几何核验就播放参考图里的逐件拆装；Model Y 尤其需要重建语义分组。用户图中 28 个可动分组是质量参照，当前这两个数字不能与之等同。

[GLB坐标审计脚本](audit-spatial-fit.mjs)按当前GLB展示器的4.8 m车长归一化，使用节点变换与每个mesh的位置accessor范围计算保守包围盒。Range Rover 是 `x±1.094 / y0～1.770 / z±2.400 m`；Model Y 是 `x±1.043 / y0～1.416 / z±2.400 m`。当前[共享契约](../../../../src/shared/lab-contracts.ts)把全部车型的MIC固定在`y=1.65 m`：它高于Model Y整体最高点0.234 m，不能作为该车的头枕附近误差点。轮端与门扬声器也需逐项按车模核对。B组声学路径直接读取这些全局常量，所以只在A2渲染层挪标签会导致图像与计算不一致；需A1/集成协调者和B组共同确定车型布局接口后再重验数值。暂时尝试把GLB直接叠到原教学车，在完整页发现BEV前格栅/门板穿出新车、MIC浮出车顶，已撤回未提交，并未作为进度验收。

## 同批续进：道路、车间与逐件拆装的运行切片

[三维场景源码](../../../../src/team-a/viewer/scene-stage.ts)增加海岸道路与有地砖、墙面、灯光招牌、举升轨、立柱和货架的车间。两处是 Three.js 几何，不是背景图；同一辆**现有原创教学车**在两处切换，原有 16 个标记和实验身份保持。车间内可点选实体部件组拆/装，可按序逐件、自动拆解、暂停、逆序自动回装和复位；程序化四车型分别有 33/33/36/37 个可动组。座椅或车门拆出时，绑定的MIC或门扬声器**显示位置**跟随移动，场景切换保留拆装状态。窄屏面板默认收起且可打开，离开写实外观范例后恢复原车间。

- [场景浏览器脚本](qa-stage.playwright-cli.js)：ICE/BEV/HEV/EREV 道路和车间各 16 标记，爆炸状态跨场景保持，写实外观模式隐藏场景控件并可返回；360px 窄屏场景按钮可见、拆装面板自动收起并可打开。页面异常与外网请求均 0。
- [拆装浏览器脚本](qa-assembly.playwright-cli.js)：四车型部件组数为 33/33/36/37；BEV 拆前座和前门后，对应MIC与扬声器引导线端点分别移动约 36px/52px；两件状态跨场景保持，手动逆序回装、自动回装、自动拆解及复位均通过。页面异常与外网请求均 0。
- `pnpm check`：类型/源码边界、69/69 测试与生产构建通过；浏览器实测为 1600×900 和 360×800 的本机 Chromium。截图：[道路](road-stage-bev.png)、[车间](workshop-stage-bev.png)、[窄屏车间](workshop-stage-narrow.png)、[拆出座椅和前门](workshop-two-parts.png)。
- [生产预览复核脚本](qa-stage-production.playwright-cli.js)在本机 `http://127.0.0.1:5182/` 检查真实构建：车间拆一件后切道路再返回仍是1/33，16标记在场，页面异常与外网资源均0。

**该教学切片尚未达到用户三图终点**：这些场景与拆装功能仍驱动原低多边形教学车；33～37 个原创组不能宣称为写实品牌车的真实拆件。车型专属物理锚点契约、四类同车高质资产、道路驾驶物理与目标设备性能均待完成；下节开始对独立写实资产做真实分件。

## 同批续进：同一写实 ICE 外观跨道路与车间

Range Rover 外观资产现在在道路、车间复用**同一个加载实例**。车间列出原 GLB 中可核实的 27 个几何总成：前/后保险杠、前舱盖、左右前翼子板与灯组、前后轮区内侧板、左右前门、四个独立轮端、尾门、左右后灯、后侧围、门槛、车顶、车窗玻璃、机舱动力网格、方向盘、座舱内饰整体、车身/底盘主体网格和排气。它们是**这份美术资产的可辨几何分组**，不是 27 个经原厂零件目录核对的机械总成。GLB 原始 171 个 mesh 主要按材质切分，不是 171 个零件。轮胎、制动盘、卡钳虽各合为一个 mesh，但逐三角形审计发现四个空间分离的轮位：每轮分别有 360、256、148 个三角形，没有三角形跨越前后/左右中线；16 个轮辋 mesh 也能按真实空间位置各归 4 个。加载器保留原顶点属性，把三张合并网格的三角形按轮位重组，四个轮端各含 7 个原资产来源网格，不复制单轮几何，也不增加三角形。机舱动力网格按 `Chassis6` 父节点与 `rM_Engine_Max1` 材质双重归属提取，避免误带前舱盖/尾门中同材质的网格。后侧围不是可核实的各后门，座椅也不能从复杂内饰网格可靠分出。27 组支持单件、顺序自动拆解、暂停、逆序回装及场景切换保留状态。BEV 资产尚无可核实分组；HEV/EREV 仍只是 Range Rover 外观参考，均不展示这 27 组为本车型真实结构。

[开发页实测脚本](qa-real-parts.playwright-cli.js)和[结果](real-parts-browser-result.json)检查：原资产 171 mesh 在轮系拆分后为 180 个渲染 mesh，仍为 74,127 个三角形；运行中的 180 份几何和 30 份材质均恰好释放一次。27 组各有非空真实子网格，四个轮端各 7 个。道路→车间时同一外观，前舱盖与左前门拆出后状态为2/27，往返道路仍为2/27，手动逆序与自动回装到0/27；四轮分别拆出达4/27并可复位；完整自动拆解到27/27再逆序回装到0/27。写实模式物理标记仍隐藏，页面异常/外网请求0；360px窗口拆装面板收起后可打开，HEV/EREV/BEV不显示这27组。实渲染原图：[道路后视](real-road-ice.png)、[车间合拢](real-workshop-assembled.png)、[前舱盖与车门拆出](real-workshop-two-parts.png)、[机舱网格拆出](real-workshop-engine-bay.png)、[四轮端拆出](real-workshop-four-wheels.png)、[27组拆出](real-workshop-all-parts.png)、[完整回装](real-workshop-restored.png)、[内饰整体移出](real-workshop-interior.png)、[窄屏车间](real-workshop-narrow.png)。[生产预览脚本](qa-real-parts-production.playwright-cli.js)重查同源GLB按需加载及跨场景拆件状态。

试把现有教学车的外壳/轮系隐藏、内部与声学点放进 Range Rover 时，浏览器[原始配准失败图](rejected-shell-overlay.png)显示教学头枕穿出车顶，教学仪表台压在前舱盖外，MIC不贴头枕；因此**未把两套资产简单叠加进产品**。进一步检查内饰主体发现它由大量小几何岛混合而成，没有可直接验证的独立五座语义分组。JLR 的[2014年原厂发布资料](https://media.jlr.com/corporate/news/2014/08/pebble-beach-debut-new-range-rover-sport-svr-fastest-most-powerful-land-rover-ever)与[车型规格册](https://www.landrover.co.uk/content/dam/lrdx/pdfs/uk/brochures/misc/RANGE-ROVER-SPORT-SVR_tcm295-140483.pdf)确认该代 SVR 为纵置 5.0 升机械增压 V8、ZF 8HP70 八速自动变速箱、四轮驱动；**原 GLB 并非原厂 CAD**，本批只把其中可见的机舱动力表面单列，未核实其缸体、变速箱、传动轴、悬架的精确构形。当前写实资产的 27 组不是完整机械/电驱结构；与四类教学模型、RNC物理锚点和算法尚未统一，仍不能按用户三图最终签收。下一步须按写实车尺寸制作并核验独立座椅、底盘/传动/悬架件及安装位，再由A1/集成协调者与B组同步车型布局契约和数值重验。

用户要求优先提升车辆的真实质感，并允许直接找现成模型。本批在既有四类教学 SUV 旁增加一个独立外观欣赏模式；**没有**用品牌模型替换教学车的机械/电驱结构或声学坐标。外观模式隐藏物理标记、声场和剖面讲解；返回后原教学模型及交互恢复。更换动力类型也自动返回教学视图，避免把真实品牌外观当成所选动力架构的实车。

经验证运行源码：`cc055329e164704bd4e74d6fd601f6e59f83de28`；[草稿 PR #24](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/24) 的 verify 已通过，尚未合并原仓库 main。

## 资产与适用边界

资源是 Mona x Supercars 的 [Range Rover Sport SVR](https://sketchfab.com/3d-models/land-rover-range-rover-sport-svr-5462d65acb0e4dca8c20da82360261db)，原模型 Sketchfab API 与文件内元数据均写 CC BY 4.0；原镜像、作者、SHA-256、改动与许可见 [资产说明](../../../../src/team-a/viewer/assets/README.md)。GLB 内嵌纹理，5.73 MB、74,127 三角形；仅用户点“写实外观”后加载，加载失败可重试。提供前侧/侧面/后侧、拖动和四种临时车漆。

其他候选并未混入产品：二次仓库标为 CC0 的 Audi Q3 GLB，其原始文件元数据为 CC-BY-NC-SA-4.0；另一仓库名叫 `suv.glb` 的文件元数据实际为 Bugatti 跑车；若干合规 CC0 SUV 外形仍明显偏低模。[候选初筛表](asset-candidates.md)保存后续可接续的来源、授权和几何负担。本批选用经许可核对且实渲染检查的车型。该写实模型是一个外观范例，不能据此宣称四类 SUV 都已达到最终参照精细度；四种动力结构仍由原创教学模型表达。

## 本机验证

- `pnpm check`：类型、源码边界、全部 68 项测试和生产构建通过。新增测试检查**打包资产自身**的来源、CC BY 元数据、内嵌纹理与三角预算，防止后续误换成受非商业条款约束的文件。
- 真实完整页使用 Playwright Chromium 1600×900、开发服务 `http://127.0.0.1:5176/`；操作脚本 [qa.playwright-cli.js](qa.playwright-cli.js)，结果 [browser-result.json](browser-result.json)。外观模式标记 0、资源加载 1 次、外网请求 0、页面异常 0；返回教学模型及切换至 ICE 后，各有 16 个可见硬件/轮端标记。截图见下。
- GLB 被生产构建纳入 `dist/assets`。本机 Vite 生产预览 `http://127.0.0.1:5178/` 实测按需加载同源带哈希 GLB、外网资源 0、页面异常 0；无运行时 CDN 引用。目标核显帧率、第二台 Windows 和四车型各自的写实外观未验收；A1/B/shared/integration 源码未改。

| 视图 | 截图 |
| --- | --- |
| 原教学模式 | [technical-before.png](technical-before.png) |
| 写实前侧 | [showroom-viewer-front.png](showroom-viewer-front.png) |
| 写实侧面 | [showroom-viewer-side.png](showroom-viewer-side.png) |
| 写实后侧 | [showroom-viewer-rear.png](showroom-viewer-rear.png) |
| 珍珠白车漆 | [showroom-viewer-white.png](showroom-viewer-white.png) |
| 返回教学模式 | [technical-return.png](technical-return.png) |

## 下一步

按同样的原作许可审查与三视角质量门槛补齐四种动力对应的独立写实 SUV 外观，解决品牌造型与教学结构的匹配；若新增外观与原物理坐标不符，仍保持独立展示，不把标记投射到无依据的部位。之后在指定核显测加载时间、显存及交互帧率，并由 A1 在同版完整实验、离线包和演示中复核入口。

## 同批续进：纯电 Model Y 独立外观

在已有燃油外观参考之外，BEV 现在按需加载单独的 [2021 Tesla Model Y](https://sketchfab.com/3d-models/2021-tesla-model-y-59e2ead369984b1a85c800ff6cf6789d)。[资产说明](../../../../src/team-a/viewer/assets/README.md)记录源文件镜像、双重许可核验、转码方式和 SHA-256。使用随应用打包的 Meshopt 解码器与内嵌纹理；不依赖外网。切换动力类型时丢弃不匹配的已加载车模，异步旧请求不能覆盖新车。ICE 使用 Range Rover；HEV/EREV 仍使用它作**明确标注的普通 SUV 外观参考**，未冒充对应动力车型。两款品牌外观都不承载教学模型的内部结构或声学坐标。

- `pnpm check`：类型、边界、69/69 项测试和生产构建通过；生产产物含 10.35 MB 的 Model Y GLB 和 5.73 MB 的 Range Rover GLB。BEV 资产测试检查真实文件的署名、CC BY、内嵌资源、压缩扩展及 287,080 三角形。
- [开发页实测脚本](qa-two-models.playwright-cli.js)和[原始结果](two-models-browser-log.txt)：BEV/ICE 各加载对应模型一次，HEV/EREV 给出未匹配说明；返回后 16 个标记恢复，页面异常 0，外网资源 0。1600×900、Chrome/RTX 4070，三视角原图如下。
- [生产预览脚本](qa-two-models-production.playwright-cli.js)和[原始结果](two-models-production-browser-log.txt)：两款 GLB 均从 `dist/assets` 带哈希地址加载，页面异常及外网资源均为 0。Meshopt 在生产构建中实际解码成功。

| 视图 | 截图 |
| --- | --- |
| BEV 前侧 | [bev-model-y-front.png](bev-model-y-front.png) |
| BEV 侧面 | [bev-model-y-side.png](bev-model-y-side.png) |
| BEV 后侧 | [bev-model-y-rear.png](bev-model-y-rear.png) |
| ICE 换车后 | [ice-range-rover-after-switch.png](ice-range-rover-after-switch.png) |

视觉复核：Model Y 轮廓、车门/玻璃、两排座椅和灯组可辨，但漆面反射与细部真实感弱于 Range Rover；本批不宣布最终视觉参照达标。HEV 和 EREV 的独立、授权清楚的写实外观仍缺；搜索到的 [RAV4 Hybrid CC BY-NC-SA](https://sketchfab.com/3d-models/2023-toyota-rav4-hybrid-ed155ad0cb7d447085a519eaff9aa2df) 和 [Li Auto L7 CC BY-NC](https://sketchfab.com/3d-models/li-auto-l7-0203b32240124b228168de2e89a2f4f2) 未导入。下一步重点是找到许可链可靠、质感至少达到 Range Rover 范例的 HEV/EREV 模型，并测指定核显与第二机离线包。A1 可依据本批截图与生产预览脚本在其独立工作区复核，不需要改它的源码。

## 同批续进：三维内部像素预算

此前[当前整合版性能基线](../../full-lab/current-performance/README.md)在1920×1080完整页面得到1588×618的WebGL绘图缓冲，超过约定的1280×720等效像素量。本批在A2 viewer根据实际容器宽高和设备DPR动态限制内部缓冲**总像素数**，保留原CSS宽高比、HTML标记和鼠标坐标；不会拉伸成固定16:9画布。监听容器与窗口尺寸变化。

[浏览器脚本](qa-pixel-budget.playwright-cli.js)和[原始结果](pixel-budget-browser-log.txt)显示：1920×1080页面的1588×618 CSS区域使用1538×598缓冲；1600×900为1268×618；360×800窄窗为332×398。模拟2×DPR的1920×1080仍为1538×598。各场景都≤921,600像素、16个硬件/轮端标记存在、实际点击REF FL进入对应信号、页面异常0；写实外观和窄窗原图见[showroom-pixel-budget.png](showroom-pixel-budget.png)、[technical-narrow-pixel-budget.png](technical-narrow-pixel-budget.png)。这只是离屏像素策略与本机浏览器交互复核，**不证明指定核显≥30fps**；后者仍需目标机器、驱动和供电环境实测。
