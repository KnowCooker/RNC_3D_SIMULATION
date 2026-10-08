# 环境景片生成记录

2026-10-01，Role: A2，Codex 代 A2。使用 imagegen skill 的内置 image_gen 工具；每景一次生成。未调用 API CLI。

原生输出均为 **1774×887 PNG**，不是提示词要求的 3840×1920，也不是经过校准的无缝 360° HDR。实际应用只将景片投射到约 110° 的正面角域，边缘融合至独立完整 HDR；光照和材质反射仍由 CC0 HDR 计算。未生成车辆、页面文字或实验热图。

最终项目资源：

- `src/team-a/viewer/assets/gallery-coast-art-v1.png`
- `src/team-a/viewer/assets/gallery-desert-art-v1.png`
- 对应两张 `gallery-coast.webp` / `gallery-desert.webp` 为菜单缩略图。

## 湖畔日落：完整实际提示词

```text
Use case: photorealistic-natural. Asset type: seamless equirectangular 360-degree landscape panorama texture for a live Three.js automotive pavilion environment. Create one ultra-detailed 3840x1920 landscape 2:1 image, NOT a UI mockup. Subject: elegant alpine lake at golden sunset, dramatic layered jagged mountains across distant shore, calm reflective water and atmospheric distance. Warm cream and champagne highlights, softly blue slate mountains, fine sunlit amber clouds with beautiful texture, natural photographic contrast. Camera 1.5 metres high on a rocky lakeshore; horizon exactly at 50% image height, sky occupies upper half, water/shore lower half. Seamless left/right 360-degree wrap, zenith and nadir appropriate for equirectangular mapping, no fisheye circle. Most beautiful open lake view across middle-right horizontal portion, sun close to horizon at horizontal position 65%, mountains rise above the water at positions 40% and 78%, golden reflection on the water. The final real-time scene will place its own marble floor in the foreground. Important: no cars, buildings, pavilion, furniture, people, typography, logo, borders, or interface. Crisp distant peaks, nuanced clouds, believable restrained lighting, premium architectural photography environment, not fantasy or illustration. Output is a project environment texture, so preserve true panorama projection.
```

## 沙漠：完整实际提示词

```text
Use case: photorealistic-natural. Asset type: equirectangular panoramic distant environment texture for a live 3D architectural car showroom. Generate a single highest-resolution 2:1 panoramic image, ideally 3840x1920. Vast elegant sand desert at golden hour: layered sweeping ochre dunes with fine wind-combed sand, shadows in muted umber, distant hazy rocky mesas, delicate cream-colored clouds in a pale champagne-blue sky. Calm luxurious architectural visualization atmosphere with restrained highlights; photographically plausible and rich material detail, not orange fantasy. Horizon exactly halfway down; sky upper half, dunes lower half. Very wide seamless left/right panorama projection, camera 1.5m above a low flat sandy ridge. Low sun near horizontal 65%, consistent light from the right. Full 360-degree wrap if possible. No cars, no buildings, no pavilion, no plants, no people, no text, no UI, no watermark, no borders. Landscape only; the application adds a real marble floor and real-time car in front. Keep the middle horizon distant and uncluttered. Maximum native image detail, do not embed interface graphics.
```

原始工具输出保留于用户 `.codex/generated_images/01a0f554-92dd-7772-9c82-b013ad790062/`；项目运行只引用上述仓库副本。两次生成返回的文件分别为 `exec-bcaac98c-f933-4dce-8e9b-79eacb3b9a11.png` 和 `exec-f9820945-25f4-4bf4-9dd9-81f869f46c5e.png`。
