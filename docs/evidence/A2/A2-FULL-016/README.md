# A2-FULL-016 · 写实 SUV 外观范例

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
