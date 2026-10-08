# A2-ENV-011 总览远景与实体平台

Role: A2 · Identity-Source: user-declared · Executor: Codex代A2

日期：2026-10-08～09；分支：`a/a2-env-011-gallery-landscape`；[草稿PR #63](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/63)，基线 `fe1662ac0c8df76378fe4ad2fb8e37dd2cadb4ca`，目标分支为A2集成分支 `a/a2-full-017-asset-inspection`。

实现提交 `07bc43205746c50a8f24c4126198bf778135871e` 已同步；Git远端与PR头核对一致。直连失败后使用Windows已有代理完成上传，未改全局设置。00:27的CI回读为一项通过、一项运行中，见 `github-sync.json`；本段仅为回执，不改变已测源码。

总览以原生8K摄影提供远处天际，以连续三维岸坡、湖面、山丘、植被和岩石承接平台。远处几何与背景使用同一照片方向及切景进度；低俯角总览露出天空与远山。湖水以波纹法线扰动同源天空倒影；湖畔不再插入与摄影不符的针叶树，山地/雪山树木改为干地簇群。

车辆平台由不透明石灰岩铺装、实体基座、圆角压顶、排水沟/格栅及两侧落地台阶组成。保留低强度柔化反射，修正车轮接触阴影的高度和排序；亭顶补实体侧壁与底面，柱头/底座与屋面衔接。几何接触测试覆盖425个车下采样点、外沿和台阶，不把测试结果扩大为整场景精确碰撞认证。

## 修改范围

- 新建 `gallery-platform.ts`、`gallery-landscape.ts` 及两个 `tests/a2-gallery-*.test.ts`。
- 修改 `scenic-terrain.ts`、`champagne-gallery.ts`、`landscape-height.ts` 中展厅部分、`scene-stage.ts` 参数接线、`lab-viewer.ts` 采样/镜头/接触阴影。
- 新增 `qwantani_sunset_8k.jpg` 原始摄影（8192×4096，44,654,662字节）。来源、作者、CC0许可及SHA-256见[素材记录](../../../../src/team-a/viewer/assets/CHAMPAGNE-ENVIRONMENT.md)。保留既有其他三张8K摄影和同源HDR。
- 同步根开发记录与A2交接页。未改A1/B/shared/integration/冻结fixture、车辆几何或道路/声学计算。海岸道路背景间接共用新的摄影。

## 验证与复现

在仓库根运行，Node 22.14.0、pnpm 11.19.0。临时Playwright安装不修改项目依赖；脚本支持本机Chrome。

```powershell
pnpm check
pnpm exec tsx --test tests/a*.test.ts tests/player.test.ts
node docs/evidence/A2/A2-ENV-011/verify-build.mjs
# 在另一个终端启动已构建服务（默认端口可用PORT配置）
$env:PORT='5199'
node scripts/serve.mjs
# 浏览器验证；PLAYWRIGHT_MODULE可指定本机playwright-core/index.mjs路径
node docs/evidence/A2/A2-ENV-011/browser.mjs
# 生命周期fixture使用Vite开发服务器5198
pnpm dev --port 5198
node docs/evidence/A2/A2-ENV-011/lifecycle-browser.mjs
node docs/evidence/A2/A2-ENV-011/lifecycle-platform-browser.mjs
```

`check-release.log`：最终版本303/303测试、类型检查、边界检查及构建通过；`test-a-final.log`：A相关扩展回归237/237通过。保留Vite既有大于500kB包体警告。`build-manifest.json`：7个运行源文件与构建source map内容一致，原始摄影SHA-256一致。`test-a-before-visual-refinement.log`是较早236项回归，只作过程记录，不冒充最终版本结果。

`browser.mjs`最终28项通过：四环境加载、16个环绕视角、总览2×采样、场景切换时采样恢复、2560×1440超采样预算及390px无横向溢出；0脚本/着色器/资源错误，测试前后源文件哈希一致。1080p视口中画布3840×2004；1440p视口中画布4005×2096。当前Chrome最大纹理16384，支持原生8K。最终报告及截图在本目录 `browser/`。环绕检查是已测视角，不承诺所有可能视角无穿模。

`lifecycle-results.json`共38项独立检查通过：真实WebGL四景两轮切换、14个实例对象双重销毁各释放一次、主场景纹理最终释放，以及销毁后实际延迟加载的2张图片和1张HDR的释放。`lifecycle-*-fixture-failure.json`保留初期验收fixture故障；`lifecycle-before-visual-refinement*`保留修正前通过记录，以最终文件为准。生命周期截图是独立fixture；平台三图仅为看清构造而隐藏亭顶、柱与盆栽，不是产品默认画面。

## 限制与交接

这是摄影与程序建模组合的展示景观，不是地点实测。水面为远景反射近似；树石仍是程序模型。8K图片增加首载与显存成本，最高纹理小于8K的设备可能自动降采样；超采样以8.4MP为目标，超大CSS视口仍保留原生1×。纹理缓存清理目标为最近两景，过渡/道路引用期间可暂存更多；未完成目标核显、第二台机器或长时间稳定性验收。

独立逐张复核16张环绕图，在可见范围未发现断口、倒置面、树石穿入平台。水纹仍有程序化规律，部分近远景过渡可辨；不声明摄影级写实。验收日志归档为UTF-8/LF并清理行尾空白，不改变执行内容或结果；本机原始日志保留在`test-results/env011`。

用户此前整车全部细节/曲面闭合和驾驶环境重构仍是独立待续范围；A1 PR #59最新车辆/乘员改动未集成到本分支，接续基线问题尚待用户答复。本PR交付总览环境与平台，不声明整车重构已完成。下一步按A1/A2交接协调集成，并在目标设备做视觉验收；本PR不合并main。
