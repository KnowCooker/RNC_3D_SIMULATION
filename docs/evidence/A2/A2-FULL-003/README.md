# A2-FULL-003：公共车壳与座舱第一轮视觉升级

日期：2026-09-24。源码来自 `a/a2-full-003-visual`，基于完整目标 [PR #7](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/7) 的 `f38b94d`；本任务见 [PR #8](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/8)。准确代码版本由本目录对应提交及 PR 记录定位，不把未合并分支写作 main。运行的 Vite 生产主包 `dist/assets/index-CSqvXccz.js` SHA-256 为 `86fa39aeda735fedefa6327ff502cd81a5d5233dcf2afb2171abae652d725118`，viewer 代码包 `dist/assets/index-Do82-Iun.js` 为 `5ca1aa7fd46cadae35ca23b2fa365487a7f03499e7d49aa78481fa980c8b48b0`。两个产物只作本轮构建识别，正式发布须重新绑定同版全包清单。

## 改动与结论

- 五座坐垫及靠背由圆角盒体改为连续曲面；原五个 `seat-*` 部件、头枕与四个固定误差点安装关系保留。驾驶台上缘采用弧形网格，原仪表/屏/方向盘保留。
- A/B/C 柱由细圆杆改为有宽度变化的立柱面，前脸中段由厚盒体改为连续弧面；前格栅、灯、门、顶与四类动力件仍属原部件。默认镜头从 `(6.3,3.9,7.2)` 指向 `(0,1,0)` 调整为 `(4,3.4,4.8)` 指向 `(0,.7,0)`。模型包围盒在夹具视口的投影宽/高由 `0.480/0.497` 增至 `0.742/0.851`，八角仍在视口内，见 [测量](reset-framing-result.json)。
- [16 张同版 V1–V4 原图](screens-result.json)为四车型×前左、侧面、后右、座舱；[HEV X 剖面](hev-section-x.png)与[完整页面](full-app-default.png)、[切换 HEV 后完整页面](full-app-hev.png)另列。截图未经调色/裁切。固定视角相机位置见清单，清单中的 `direction` 是单位朝向向量，**不是** OrbitControls 的 target 点；截图时 viewer 以新默认 target `(0,.7,0)` 建立朝向，脚本直接更换位置，不应把向量误用成世界坐标。
- **本批仅改善轮廓的一部分。A2-F2 视觉品质仍未通过。** [BEV 侧面](bev-v2.png)可见较平的车侧、粗门缝、简化轮拱；[HEV 后角](hev-v3.png)车顶接合及尾部仍显程序几何；[HEV 座舱](hev-v4.png)未证明仪表/扶手/踏板细节充分。缺少同视角高品质参照物与游戏级材质/细节，不能把三角数或自动化通过写成达到《地平线》视觉质量。动力结构近景 V5、底盘 V6、全车型爆炸 V7、用户可达三轴截面 V8 尚未由本批完成。

## 实际验证

- `pnpm check`：59/59 工程测试、类型检查、源码边界、生产构建通过；构建约547 kB主块提示仍在。四车型网格约 45,412 / 45,880 / 47,800 / 48,204 个三角（ICE/BEV/HEV/EREV，夹具统计），只用于负载观察，不代表指定核显性能。
- [剖面回归原始数值](section-result.json)：四车型 X=0，HEV 另测 Y=1.06 与 Z=0.1，均生成实体截面；离目标平面最大误差 `1.91e-8 m`。BEV 展开后的座舱/车顶位移为 `.45/1.00 m`，`getMountIssues()` 为空。脚本先等待模型动画并驱动渲染；这不是所有安装配置的笛卡尔积验收。
- [完整页面结果](full-app-result.json)：真实 Worker 默认 BEV 在本机约281 ms就绪，16个示意/硬件标记可见，切 HEV 后旧实验明确过期。截图是 1440×900 浏览器的完整页面，车窗区域仍需人工解决标记遮挡。运行环境 Windows 11、Chromium、ANGLE NVIDIA RTX 4070 Laptop GPU/D3D11；不是目标核显或实物音画测试。

## 复现入口与下一步

在仓库根执行 `pnpm install --frozen-lockfile`、`pnpm dev -- --port 5183`。`viewer.html` 是独立 A2 模型夹具；可把它置于 Vite 可访问的 `output/playwright/a2-full-003/viewer.html`，访问 `http://127.0.0.1:5183/output/playwright/a2-full-003/viewer.html`。先前 A2-FULL-002 夹具含直接指向 Vite 生成缓存文件的导入，在新工作树不稳定；本夹具改用包名 `three`，不修改旧证据。`screenshot-v1-v4.js`、`section-regression.js`、`reset-framing.js` 和 `full-app-check.js` 是 Playwright `page` 回调脚本，从项目根执行并将新原图输出到 `output/playwright/a2-full-003/`；归档图片是本次已执行的原图。

下一独立 A2 批次优先做 V5–V6 四架构机械/电驱壳体与连接，依据 [视觉差距表](../A2-FULL-002/VISUAL_GAPS.md)逐件验收；然后处理 V7–V8 用户可达剖面与完整页遮挡。保留 `seat-*`、门/扬声器安装 ID、轮心与物理测点；如需新增相机入口，先在 A2 交接中提出兼容接口，由 A1 接入。A1 可继续音频/页面工作，无需改本轮 viewer 源码。
