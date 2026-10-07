# 人物资源来源与范围

本目录发布接入代码、转换脚本、网格审阅图片和包络/摘要，不发布第三方原始模型、贴图或转换 GLB。`inputs.json` 固定原始下载地址和 SHA-256。源码公开可访问不等于模型获得再分发授权。

| 内容 | 来源与本次处理 | 使用范围 |
| --- | --- | --- |
| 神里绫华 | [miHoYo 原始模型包索引](https://github.com/UuuNyaa/blender_mmd_assets/issues/249)，模型 miHoYo、改造观海。PMX 骨骼坐姿、原 UV 贴图，修正 D 辅助链权重及 MMD 叠加发片后导出 | 包内 `readme【一定要看】.txt` 明确“请勿二次配布”“请勿用于商业用途”。本机非商业审阅；不得上传转换 GLB/贴图或随公开站点分发 |
| 路飞 | [AlpaX-dev/luffy-3d](https://github.com/AlpaX-dev/luffy-3d/tree/94ca97f5f22970b19b5cd9b746dd9c65c02f2e03)，FBX 原贴图/骨骼，调整腿部和双臂，草帽保留背部 | 未找到明确的模型分发许可；本机审阅缓存，公开/商用发布前需另有授权或换为可分发资产 |
| 牛来 | [zicojiao/niulai-ai](https://github.com/zicojiao/niulai-ai/tree/adfb11c65b800be53055e93181e20e4513d34e3f)，雕刻网格及色区参考；连续体素重建、平滑、减面、顶点着色和坐姿变形 | 该项目说明 MIT 不自动覆盖第三方角色网格；未将网格视为 MIT 授权资产，不上传网格 |
| MMD 导入器 | [MMD-Blender v4.5.14](https://github.com/MMD-Blender/blender_mmd_tools/releases/tag/v4.5.14)，GPL | 仅本机 Blender 导入工具，不打包到产品 |
| 工作流 skill | [arjun988/blender-skills / character-artist](https://github.com/arjun988/blender-skills/tree/8f778d2405a214b508d4c7d80742be8e43acdd52/.claude/skills/character-artist)，MIT | 已读取比例、面部、服装及准备骨骼流程；本次现成网格整理不等于重做全四边面 AAA 拓扑 |

模型使用本身与角色 IP 权利分别保留给各自权利方。当前接入为可替换 GLB 接口，便于后续替换为获得分发授权的正式资产。渲染审阅图不构成角色素材授权声明。

牛来色区来自该项目代码/调色 JSON，其 MIT 声明如下（不适用于角色网格）：

```text
MIT License

Copyright (c) 2026 zicojiao

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
