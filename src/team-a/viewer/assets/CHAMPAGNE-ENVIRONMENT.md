# 云境香槟环境素材

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
