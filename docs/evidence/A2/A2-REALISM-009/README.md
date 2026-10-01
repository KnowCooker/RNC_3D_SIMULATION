# A2-REALISM-009 · 五车与360°环境阶段成果

2026-10-02 · Role:A2 · Identity-Source:user-declared · Codex代A2。

本轮工程修复和验证完成，按用户明确授权同步全部本地项目成果。**五车仍未达到“与真实照片视频一模一样”的外观验收标准，保持草稿状态。** 本报告不将代码与交互通过解释为最终视觉验收通过。

## 修改

- 五车曲面采用连续导数法线；修补P7窗下蒙皮、四车轮拱侧围连接、C/D柱与后风挡连接面，细化包围鼓度、灯腔圆角及P7/L03/M03厚轮面。保留名义尺寸、语义总成与已有声学锚点。
- 四景均改为8192×4096完整实拍球面，配同源HDR照明，移除正面单扇区景片；环形地坪、顶棚、柱廊、座椅与植被覆盖四周。恢复地面附近球心以改善平视地平线。
- HDR/JPEG各缓存最近两景；道路复用高清背景，LDR取消二次色调映射；修正高车正后视角裁切。
- HDR改为原生fetch完整读取后由HDRLoader解析，保持半浮点、线性色彩、翻转和过滤设置。避免本机原加载器流式传输路径的中断记录。
- 此次同步同时包含005五车、006展厅、007过渡与连续声场、008道路驾驶的全部本地代码、资源、文档和证据。

## 文件与边界

新文件coachwork-surface.ts、hdr-texture.ts；修改p7plus-model.ts、xpeng-model.ts、champagne-gallery.ts、scene-stage.ts、driving-road.ts、lab-viewer.ts，以及用户授权的lab/champagne-shell.ts来源标注、自有测试和来源说明。上述路径均在src/team-a/viewer或src/team-a/lab。完整源码哈希见source-manifest.json，覆盖此次同步的24份变更源码/测试。

不改B/shared/integration/计算或冻结fixture。所有新环境运行资产来自Poly Haven CC0；URL、大小、SHA见environment-assets.json，6份新资源哈希复核均通过（asset-verification.json）。原生8K不代表所有观察角度都达到摄影级细节；远景是球面，近景展厅为三维几何。

## 最新验证

- pnpm check：209/209、TypeScript、模块边界、生产构建通过，见check.log。包含最终HDR修复，保留包体大于500kB提示。
- Chrome共214项：五车交互65（models/browser-results.json）、完整产品69（product-regression/browser-results.json）、驾驶43（driving/results.json）、四景环绕/缓存37（environments/results.json）。全部无JS/Shader错误，所有套件失败资源均为空。
- 五车正前/侧/后/前侧、座舱、剖面和全部展开；四景32方向；真实点选/逐件拆装/复位、四座/小图/试听通道对应、实验暂停/回退及Worker时钟；响应式390、740、1366、2560等宽度。
- 人工复核P7前后/前侧、X9/L03前侧、GX正后、湖畔/山地/雪山/荒漠方向及驾驶俯视截图。之前修正的缝隙和裁切有实图复核，外观差异仍明确保留。
- git diff --check通过。106份变更文本未匹配GitHub令牌/私钥特征；未纳入test-results依赖、凭据或无再分发授权的参考照片。

## 保留的失败与诊断

此前环境36项/驾驶42项功能检查通过但资源零失败断言失败，原记录在environments/first-resource-failure.json、environments/stream-resource-failure.json、driving/stream-resource-failure.json。hdr-transfer-diagnostic.json记录同文件15次原生读取无失败，15次Three FileLoader有8次ERR_ABORTED，两组字节均完整。据此改下载路径，最终两套场景复验均无资源失败；尚不能推断所有浏览器内部根因或目标核显表现。

上轮自动审批因Codex额度阻止最终检查；本轮已恢复，最新检查成功，旧阻塞不再有效。最初版本字符串测试未同步v5造成一次失败，已修正版本断言，未修改数值容差。

## 未完成项与下一步

五车前后包围、灯具、侧窗/车顶边界与实拍仍存在差异，详见model-source-audit.md。未取得匹配版本的原厂CAD、扫描或授权高精底模；候选页不等于已取得许可。内饰/隐藏机械仍有近似，不能替代维修、标定或有限元模型。目标核显/第二机、最终视觉验收继续保留待测。

分支a/a2-xpeng-reconstruction，基线a88536a58d5f489cb245246d243dd0eb23b333e1；沿用[草稿PR #56](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/56)，当前准备提交推送。推送完成后补实际SHA与远端核对记录。预览http://127.0.0.1:5197/，已包含最新HDR修复。
