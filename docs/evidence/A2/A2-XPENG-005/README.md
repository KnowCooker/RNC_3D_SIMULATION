# A2-XPENG-005：P7+ 前后造型与其他四车精细化

2026-10-01。Role: A2；Identity-Source: user-declared；执行者：Codex 代 A2。

基于分支 `a/a2-xpeng-reconstruction`、提交 `a88536a58d5f489cb245246d243dd0eb23b333e1`。本批仅本地，未创建提交、未推送、未更新 PR；本批内容尚未同步 GitHub。开始时已 fetch 并核对开放 PR #30/#56，没有把本地工作宣称为新的远端认领。

## 实现与 P7 基线对照

应用 `C:/Users/Jiang/.codex/skills/interactive-3d-atlas/SKILL.md` 及其曲面/拆解、材质/灯光、交互/交付参考。参考小鹏官网照片、配置及 P7+ 两段实际视频抽帧。官方媒体只在忽略目录用于目视核对；应用交付原创几何，参考 URL 在 [reference-sources.json](reference-sources.json)。

| 车型 | 独立可拆总成 | 本批重点 |
| --- | ---: | --- |
| P7+ 2026 纯电 | 38 | v4 前脸曲率、灯腔及三透镜、下格栅导流片、牵引盖/摄像头、尾门字距/牌照凹槽/双层尾翼、风挡封边及尾门密封条 |
| X9 2026 增程 | 43 | 长顶 MPV、滑门轨道、星舰前脸、密辐轮毂、2+2+3 座椅；后电驱、增程器/油箱/排气、双叉臂/H 臂、空气弹簧及后轮转向 |
| MONA L03 纯电 | 38 | 独立 SUV 曲率、分叉前灯/双线尾灯、2+3 座椅、后电驱、麦弗逊/五连杆 |
| MONA M03 2026 纯电 | 38 | 低顶掀背、T 形前后灯、独立尾门玻璃、2+3 座椅、前电驱、麦弗逊/扭力梁 |
| GX 增程四驱 | 43 | 长平顶 SUV、贯穿灯与低位主灯、密辐轮毂、2+2+2、双电驱、增程器/油箱/排气、双叉臂/H 臂、空气弹簧及后轮转向 |

其他四车均具备 P7 当前基线的分层电池（托盘、冷板、分区、上盖）、高压系统、热管理、座椅轨道/头枕/扶手、车身框架/后地板，以及旋转、缩放、射线点选、逐件拆装、全展开复位、隐藏外壳及三轴剖切。车型使用独立纵向曲线与横向宽度站点，没有把 P7 网格缩放后改名。接触问题核查后升高地板、外移纵梁；测试检查电池与地板层次、尺寸、驱动差异和装配复原。

新增四车专用前/侧/后视角，座舱与展开取景避开工具面板。窄屏 `overflow:clip` 导致子元素上边距折叠、画布被推至 y=645px，已用 `display:flow-root` 修复，并增加浏览器画布定位断言。

## 修改文件与边界

- `src/team-a/viewer/p7plus-model.ts`：P7+ 外观细化，内部声学安装坐标不变。
- `src/team-a/viewer/xpeng-profiles.ts`（新增）、`xpeng-model.ts`、`xpeng-catalog.ts`：四车独立轮廓、详细总成、L03 已核实后驱。
- `src/team-a/viewer/lab-viewer.ts`：五车检视镜头与拆装取景。
- `src/team-a/lab/champagne.css`：窄屏容器外边距折叠修复。
- `src/team-a/viewer/P7PLUS-SOURCES.md`、`XPENG-SOURCES.md`：媒体/配置来源、结构估计与历史分界。
- `tests/a2-p7plus.test.ts`、`a2-xpeng-model.test.ts`、新增 `a2-xpeng-detail.test.ts`：版本及结构回归。
- 根 `开发记录.md`、`docs/coordination/A2.md`、本目录：过程、验证与交接。

未改 B、shared、integration、旧 fixture 或数值算法；未放宽既有断言/容差。P7+ 声场继续使用上一批统一布局，其他四车仅展示，未声称新建它们的声学标定。

## 实际验证

- 最终 `pnpm check`：194/194 测试、类型、模块边界及生产构建通过，见 [check.log](check.log)。既有构建大块提示仍存在。
- 最终五车真实浏览器：65/65 通过，见 [browser-results.json](browser-results.json) 与 [复现脚本](browser-check.mjs)。五车分别实际拖拽旋转、滚轮缩放、射线选择车门、拆件回装、隐藏外壳、独立座椅拆装、剖切、全展开/复位；390/740/1366/2560 宽度检查无横向溢出及画布位于页头下。0 JavaScript 异常、0 失败资源请求。
- 最终产品流程：69/69 通过，见 [product-regression/browser-results.json](product-regression/browser-results.json) 与 [复现脚本](product-regression.mjs)。包含四个页面、真实 Worker 的 P7 批量/实时声场、16 通道、A/B 对比、导出、四种环境及 390～3840 宽度。0 JavaScript 异常、0 失败资源请求。
- 最终高 DPR：12/12 通过，见 [interaction-results.json](interaction-results.json) 与 [复现脚本](interaction-check.mjs)。1920 CSS 宽度、DPR 2，实际画布 3840×2004；真实鼠标旋转/缩放/点选拆装及五车切换通过，无运行时异常。
- 正前、侧面、正后、前侧、座舱、剖面、展开截图逐车保留；自动测试通过不等于实车视觉精度认证。

过程中的失败已修正：profile 字段同名覆盖；灯带突出导致三车长度超限；曲面贴片穿入/法线折面；电池与地板/纵梁干涉；灯片共面闪烁；尾门接缝透光；窄屏画布位置错误。补密封条首次全仓 189/194（五项后杠高度断言失败），原始日志 [seal-first-check.log](seal-first-check.log) 保留；通过纠正密封条所属总成和上缘高度修复，没有更改断言。窄屏修复前的空白截图保留为 [narrow-before-fix.png](narrow-before-fix.png)，与最终 [responsive-390.png](responsive-390.png) 对照。Python 记录脚本首次未指定 UTF-8 的解码失败已纠正，不涉及产品。

最终源码/测试 49 文件 SHA-256 见 [source-sha256.json](source-sha256.json)。日志和截图对应本批生产构建，未沿用上一批 A2-P7-004 的结果充数。

## 尚未完成与下一步

这是按公开照片/视频和配置重建的交互模型。轮廓与可见部件已细化，但没有授权 OEM CAD、扫描或标定相机，不能宣称原厂曲面精度或摄影级一比一复刻。隐藏安装尺寸、电池分区、线束、油箱及机械关节点仍是受布局约束的估计。拆解是展示路径，不是实车维修工艺，也未做全零件连续碰撞认证。

本机浏览器检查之外，实车视觉评审、用户最终外观验收、目标设备/第二机验收仍待进行。下一步根据具体视角反馈与授权工程资料继续收敛。演示：<http://127.0.0.1:5197/>。上传需用户新的明确指令。
