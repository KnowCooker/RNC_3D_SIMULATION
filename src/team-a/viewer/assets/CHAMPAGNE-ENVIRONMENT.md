# 云境香槟环境素材

## A2-ENV-011 总览远景与平台（2026-10-08）

湖畔新增原生 **8192×4096** 实拍全景 [`qwantani_sunset_8k.jpg`](https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/qwantani_sunset.jpg)，与已有 `qwantani_sunset_4k.hdr` 共用方向，取代当前分支湖畔的近树 Lakes 视图。来源：[Qwantani Sunset](https://polyhaven.com/a/qwantani_sunset)，摄影 Greg Zaal、处理 Jarod Guest；[CC0许可](https://polyhaven.com/license)已于本批复核。未放大或重绘原图；44,654,662 bytes，SHA-256 `6a84e7a3e4a93dc4afaca022f3d8b4aeffb478a6611191e92d679370424878f2`。另外三景继续使用原生8K摄影与同源HDR，原作者记录见下表。

全景负责远处天际；平台外连续三维岸坡、湖面、低丘、树石和草具有真实深度。240～590m远处几何按同一视线渐融进摄影，并共享天空前后帧与过渡比例，避免另造一条天际线。此为原创艺术景观组合，不是地点测绘或可走入的摄影测量场景。平台为原创有厚度几何，石灰岩材质按世界坐标生成，不含另购素材。

湖水使用法线扰动和视角相关的同源全景倒影，属于远景反射近似，不包含近处所有实体的实时倒影。湖畔保留与实拍草甸相符的岸草/石；山地和雪山将三维针叶树集中在高低错落的干地簇群。平台补齐基层、圆角压顶、环形排水与两侧台阶，亭顶补实体檐口/底面、柱头与底座。

总览目标2×渲染采样，超采样受8.4MP预算约束；超大CSS视口仍保留最低原生1×。8K纹理保持原分辨率并使用设备支持的各向异性过滤；低于8K最大纹理尺寸的GPU可能由渲染器降采样。HDR与摄影缓存以清理至最近两景为目标，过渡和道路引用保活期间可暂留更多，不宣称硬显存上限。旧资源和旧说明保留历史，新图随Vite本地打包，运行不依赖外网。

#59的独立生成美术层未在本A2分支接管，本批作为独立补丁供集成复核。

## A2-REALISM-009 当前运行版本（2026-10-02）

本节覆盖以下历史版本。四环境都使用完整球面8192×4096原生JPEG实拍，移除正面单扇区效果图；全方向环形地坪、顶棚、柱廊、座椅和植被。球面作高度构图调整，非地理定位场景。

|环境|完整实拍背景与同源HDR|作者|HDR尺寸|
|---|---|---|---|
|湖畔|[Lakes](https://polyhaven.com/a/lakes)|Sergej Majboroda|2048×1024|
|山地|[Alps Field](https://polyhaven.com/a/alps_field)|Andreas Mischok|4096×2048|
|荒漠|[Goegap](https://polyhaven.com/a/goegap)|Greg Zaal|2048×1024|
|雪山|[Lago d’Isola](https://polyhaven.com/a/lago_disola)|Andreas Mischok|4096×2048|

均[CC0](https://polyhaven.com/license)。背景无二次色调映射；光照与反射仍用HDR。HDR和JPEG各只缓存最近两景并释放过期纹理；8K源图仍有较大带宽/显存成本，目标核显待测。背景全景为远景球面，不是可走入的摄影测量地形。道路近景另用真实三维分块。菜单小图保留历史样式，海岸/沙漠AI小图不代表当前实拍。

新文件URL、实际大小和SHA见[009素材清单](../../../../docs/evidence/A2/A2-REALISM-009/environment-assets.json)。以下006及更早内容只作历史。

## A2-ENV-006 当前运行版本（2026-10-01）

按 `FINAL_PRESENTATION.md` 优化开放展厅与全部四环境。以下覆盖后文历史批次对“当前运行素材”的描述。

| 环境 | 光照 / 反射及完整全景 | 原作者 | 正面景物 |
| --- | --- | --- | --- |
| 海岸（湖畔展厅） | [Qwantani Sunset](https://polyhaven.com/a/qwantani_sunset) | Greg Zaal / Jarod Guest | AI 辅助湖畔日落景片 |
| 山地 | [Alps Field](https://polyhaven.com/a/alps_field) | Andreas Mischok | 对应实拍 HDR |
| 沙漠 | [Quarry 04](https://polyhaven.com/a/quarry_04) | Sergej Majboroda | AI 辅助沙丘景片 |
| 雪山 | [Lago d’Isola](https://polyhaven.com/a/lago_disola) | Andreas Mischok | 对应实拍 HDR |

四份 HDR 均为实际 **4096×2048** Radiance 文件；来源 [Poly Haven CC0 许可](https://polyhaven.com/license)。下载 URL 为 `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/<素材ID>_4k.hdr`。只使用允许再分发的 HDR，不复制网站 UI 或说明文字。素材页/许可已于本批核对。

两张生成景片位于 `gallery-coast-art-v1.png`、`gallery-desert-art-v1.png`，实际 **1774×887**，不是 4K 或标定的无缝全景。用限定角域投影并向 HDR 羽化，保留全向旋转；HDR 自身负责环境光与反射。背景球取景做小幅垂直偏移，未改变原始 HDR 像素。自然光照是视觉近似，不用于实车照度或声学计算。沙漠为艺术组合，并非某个真实测试场。

完整实际提示词和产出信息：[生成记录](../../../../docs/evidence/A2/A2-ENV-006/image-prompts.md)。四张 `gallery-*.webp` 为菜单小图：海岸/沙漠来自生成景片，山地/雪山来自对应 HDR 的曝光映射裁切；不可全部归为 CC0 摄影。

运行资源全部由 Vite 本地打包，不依赖外部 CDN。四 HDR 合计约 102 MB，按选择串行加载、只跟进最新选择，初次仅约 25 MB；HDR 纹理最多保留最近两种，过期纹理释放。生成景片按需加载。异步结果只应用于仍被选中的场景，失败显示简化天空/提示，切回可用环境可恢复。此处“本地打包”不等于新增 Service Worker；在本地静态服务上运行无需访问外部素材网站。

地面使用五层分形石纹与九点过滤实时平面反射；反射随视口在 768～2048 × 512～1440 调整。保留 2048² 阴影与主画布原生/1.5～2× 分辨率预算。弧顶、玻璃立面、细柱、座椅、石块与实例化树叶为项目原创几何。车辆和控件均为真实交互对象，环境不改变实验参数或数值。

素材大小和 SHA-256：[asset-manifest.json](../../../../docs/evidence/A2/A2-ENV-006/asset-manifest.json)。性能已做本机浏览器回归，目标核显与第二机仍须独立验收。

## 历史来源记录


2026-10-01 · A2-CP-003 · Codex 代用户声明的 A2 执行。

- 素材：[Qwantani Dusk 2](https://polyhaven.com/a/qwantani_dusk_2)
- 作者：Greg Zaal（摄影），Jarod Guest（处理），Poly Haven。
- 使用依据：[Poly Haven 许可页](https://polyhaven.com/license)，素材 CC0，可用于应用及再分发；页面截图和网站文字不作为素材复制。
- 下载文件：[2K Radiance HDR](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/qwantani_dusk_2_2k.hdr)
- 本地文件：`qwantani_dusk_2_2k.hdr`，6,456,886 bytes。
- SHA-256：`7094cf5245937b55c1a64a97438625eaa13a2879950e2e451c5e01a51e0b9f48`。

以2K全景映射到三维远景球，随相机旋转；展厅地面、柱、顶棚、座椅和植被为本项目原创几何，地面使用实时平面反射。页面控件和车辆不是背景图片。资产由 Vite 打包，运行时无 Poly Haven 下载；加载失败保留程序天空作为后备。山地、沙漠、雪山为程序化景物变体，不代表对应路面、风噪或轮胎接地物理已实现。环境选择不改声学配置。

此前用于试看的 `Lakes` JPG 已移除，未纳入运行构建。API查询曾返回403，未绕过；随后使用素材页提供的公开下载服务获取本文件。原始许可及作者归属在应用“帮助与数据来源”可查看。


## A2-P7-004 当前运行素材

- [Qwantani Sunset](https://polyhaven.com/a/qwantani_sunset)，作者同上，CC0。
- [4K HDR下载](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/qwantani_sunset_4k.hdr)。本地 `qwantani_sunset_4k.hdr`，24,736,295 bytes。
- SHA-256：`99ec5c2e3e7447128c09a9d74b76999907ed243aea664c3d32eb62ef7ecc3dba`。
- 4K全景用于真实三维背景及环境反射；暖色日落替代旧Dusk。主画布按设备像素比渲染，通常1.5～2倍，840万像素预算且不低于CSS原生像素；不是把低分辨率截图放大。阴影2048²，反射1536×1024。
- 旧Dusk 2K留作上一批来源历史，运行构建只打包Sunset。此次中间试看的4K Dusk已移到忽略目录，不作为运行依赖。
