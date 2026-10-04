# 总览渲染素材与字体来源

Role: A1 · Task: A1-FULL-021 · Executor: Codex 代 A1 · 2026-10-04

三张透明 PNG 使用内置 imagegen 生成（1774 × 887），未裁切、重画或变更原始像素。总览以 CSS/SVG 叠加声场流动、路径光点、点位呼吸；不是物理求解动画帧，也不是当前小鹏车型扫描资产。页面标注“概念动效”，点击后进入已有当前车型三维视图。生成源文件分别为 exec-e678190e-72f5-423a-920c-d0172e5a06ec.png、exec-39be8ee4-2fc8-4812-8158-8f0e8e5c62cd.png、exec-58899163-00a6-4906-9d79-97db92e3ac58.png；仓库副本见下表。

| 文件 | 用途 |
| --- | --- |
| [field.png](field.png) | 透明座舱热力场 |
| [paths.png](paths.png) | 悬架、底盘、座舱传递路径 |
| [layout.png](layout.png) | 麦克风、参考传感器、扬声器概念布置 |

三图全部为AI概念创作，不包含外部车标；未把用户的最终设计整图充作可交互页面。图像哈希见 manifest.json。

## 精确生成提示词

### 声场

```text
Use case: product-mockup. Create one premium automotive CGI technical product cutout for a luxury champagne-ivory digital-twin interface. A refined silver midsize modern SUV, front facing LEFT, smooth contemporary body lines, long continuous slim LED headlights, black panoramic glass roof, very realistic multi-spoke wheels, pearl-white leather seats, believable proportions. Entire vehicle fully contained with generous clean margin. Studio ray-traced rendering, immaculate bevels and accurate fine metallic detailing, warm neutral key light, silver edge highlights, restrained polished white finish. Three-quarter side view, slightly elevated, orthographic-like long lens. Wide 2:1 composition. Isolated on genuine alpha transparency, subtle contact shadow only. No labels, words, numbers, logos, badges, UI, borders, legend, watermark or environment. This is a conceptual illustration, not a measurement. Show a transparent crystal-clear body shell with delicate silver exterior outlines and all four wheels. The detailed cabin and seats are plainly visible. Inside the passenger compartment only, a beautiful translucent acoustic heatmap volume with smooth cyan-blue-green swirls, restrained warm yellow and orange hotspots near the front wheel/firewall and around the rear roof. The heatmap must remain spatially contained inside the car; retain individual seats and structural elements. Make this look like a very high quality engineering visualization rendered for an automotive launch, never a flat cartoon.
```

### 路径

```text
Use case: product-mockup. Create one premium automotive CGI technical product cutout for a luxury champagne-ivory digital-twin interface. A refined silver midsize modern SUV, front facing LEFT, smooth contemporary body lines, long continuous slim LED headlights, black panoramic glass roof, very realistic multi-spoke wheels, pearl-white leather seats, believable proportions. Entire vehicle fully contained with generous clean margin. Studio ray-traced rendering, immaculate bevels and accurate fine metallic detailing, warm neutral key light, silver edge highlights, restrained polished white finish. Three-quarter side view, slightly elevated, orthographic-like long lens. Wide 2:1 composition. Isolated on genuine alpha transparency, subtle contact shadow only. No labels, words, numbers, logos, badges, UI, borders, legend, watermark or environment. This is a conceptual illustration, not a measurement. Show the same SUV with a transparent silver body shell, visible suspension, chassis, dashboard and pearl-white seats. Show a small number of luminous orange paths starting at the front-left wheel, travelling through suspension and floor, then becoming refined blue light ribbons as they move into the cabin. The lines should be thin, elegant, logically routed, not a tangled cloud. Add subtle cobalt highlights along the lower chassis. The vehicle itself is the dominant subject and should be exceptionally realistic. No heatmap volume. Wheels complete and photorealistic.
```

### 布局

```text
Use case: product-mockup. One premium automotive technical CGI cutout for a champagne-ivory digital twin UI. The same refined silver midsize modern SUV, slim continuous LED front lights, black panoramic roof, realistic alloy wheels, pearl-white seats. Exact orthographic TOP VIEW with FRONT on the LEFT, entire car fully visible within a wide 2:1 frame with generous margins. Transparent glass-like roof and silver body outline reveal detailed steering wheel/dashboard on the left and two rows of white leather seats, center console, elegant cabin. Showcase a clean sensor and actuator arrangement: small precise glowing blue microphone dots near four seat headrests, warm amber vibration sensor dots near four wheel/axle corners, red tiny speaker dots at door positions, with polished metal rings. These are conceptual markers, not text. Physically detailed ray-traced studio product rendering, fine metallic edges, softly shaded leather, sophisticated restrained materials. Genuine transparent alpha background with only a faint contact shadow. No labels, no numbers, no legend, no logo, no border, no environment, no heatmap, no perspective tilt, no UI.
```

## 字体

从 [Google Fonts / Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc) 与 [Noto Serif SC](https://github.com/google/fonts/tree/main/ofl/notoserifsc) 官方发布下载。SIL OFL 1.1，原保留名称为 Source；子集改名 RNC Sans / RNC Serif。上游 SHA、子集 SHA、字形数见 [manifest](../fonts/manifest.json)，完整许可见 [Sans](../fonts/NotoSansSC-OFL.txt)、[Serif](../fonts/NotoSerifSC-OFL.txt)。本地 woff2 随 Vite 构建，不请求字体 CDN；缺少的用户输入字形由系统回退。生成脚本 [build-subsets.py](../fonts/build-subsets.py) 在仓库根运行，原 TTF 仅放 output/font-source，不提交大字体源文件。
