# A2-FULL-016 · 写实 SUV 外观范例

用户要求优先提升车辆的真实质感，并允许直接找现成模型。本批在既有四类教学 SUV 旁增加一个独立外观欣赏模式；**没有**用品牌模型替换教学车的机械/电驱结构或声学坐标。外观模式隐藏物理标记、声场和剖面讲解；返回后原教学模型及交互恢复。更换动力类型也自动返回教学视图，避免把真实品牌外观当成所选动力架构的实车。

## 资产与适用边界

资源是 Mona x Supercars 的 [Range Rover Sport SVR](https://sketchfab.com/3d-models/land-rover-range-rover-sport-svr-5462d65acb0e4dca8c20da82360261db)，原模型 Sketchfab API 与文件内元数据均写 CC BY 4.0；原镜像、作者、SHA-256、改动与许可见 [资产说明](../../../../src/team-a/viewer/assets/README.md)。GLB 内嵌纹理，5.73 MB、74,127 三角形；仅用户点“写实外观”后加载，加载失败可重试。提供前侧/侧面/后侧、拖动和四种临时车漆。

其他候选并未混入产品：二次仓库标为 CC0 的 Audi Q3 GLB，其原始文件元数据为 CC-BY-NC-SA-4.0；另一仓库名叫 `suv.glb` 的文件元数据实际为 Bugatti 跑车；若干合规 CC0 SUV 外形仍明显偏低模。本批选用经许可核对且实渲染检查的车型。该写实模型是一个外观范例，不能据此宣称四类 SUV 都已达到最终参照精细度；四种动力结构仍由原创教学模型表达。

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
