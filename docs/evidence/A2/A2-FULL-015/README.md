# A2-FULL-015 四车型侧围、门槛与轮眉连续性

状态：局部实现与本机验证完成，待[草稿 PR #20](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/20)审查；完整 A2-F2 视觉参照质量、目标核显和 A 组最终交付仍未通过。基线为 A2-FULL-014 已提交 `ee0ef2d`，本批经验证运行源码为 `356731f4a61463968c3ad3ed3a66f34a16a7a78d`；本次仅文档固定提交。模型为原创教学形态，不声称量产钣金尺寸或实车标定。

## 改动与视觉结论

- 在四车型共用侧围加入闭合漆面门槛，与车门下缘及前后轮口相接；实体车壳侧面不再大面积露出青色电池/底盘。下方仍有细线状底盘边缘，未伪装成完全无缝的量产车。
- 用闭合漆面弧形轮眉替换粗黑圆管式轮口装饰；保留深色轮拱内衬。四轮、五座、头枕 MIC、门扬声器、参考安装位置、部件 ID、viewer API、爆炸与剖面归属均未调整；实体/透明/隐藏模式仍能查看内部电池。
- 同一相机下，门槛和轮眉与车侧更连贯；轮口内的悬架与车身接缝仍显教学简化，侧窗、座舱和底盘尚未达到原定高质量车辆可视化参照。三角数降低属于性能预算，不作为视觉达标证明。

## 可复现证据

- [`capture-side.js`](capture-side.js) 在四车型固定侧面、前斜、后斜视角拍摄 12 对 `before-*`/`after-*` 原图；BEV 另有前轮眉、后轮眉、门槛 3 对近景。相机、三角数、mesh 数、GPU、WebGL 上下文在 [`before.json`](before.json) 与 [`after.json`](after.json)。全部 15 组上下文未丢失。本机 GPU 为 NVIDIA RTX 4070 Laptop GPU，并非目标核显。
- 代表视角：[BEV侧面改前](before-bev-side.png) / [改后](after-bev-side.png)，[门槛改前](before-bev-rocker.png) / [改后](after-bev-rocker.png)，[前轮眉改前](before-bev-front-arch.png) / [改后](after-bev-front-arch.png)。四车型三角数 ICE 45,416→41,680；BEV 45,404→41,668；HEV 47,660→43,924；EREV 48,332→44,596。
- [`check-full-app.js`](check-full-app.js) 在真实 `pnpm dev` 页面取同一 BEV 实验，复测实体、透明、隐藏、展开、X 剖面五状态。[`full-app.json`](full-app.json) 与 `full-app-*.png` 记录同一运行身份、每状态 16 个硬件/源标记、无页面异常和 WebGL 上下文丢失。
- `pnpm exec tsx --test tests/a2-vehicle-model.test.ts`：4/4，含新增的四车侧门下方可见表面射线断言；既有轮心、MIC/扬声器物理位置、车底电池可见、资源释放与几何预算断言通过。`pnpm check`：类型、边界、67/67 自动测试及生产构建通过；构建保留超过 500 kB 的非阻断提示。
- 该源码构建的 `dist/index.html` SHA-256 为 `96722c59a145b4cd16f9f1f57ae6b0f98ad9d836591931dbe9a246ceeac0efdc`，车型所在 `dist/assets/index-BpwjiFFv.js` SHA-256 为 `0afa74a3a42d37fc7bdd4f6bea4b85e55391db8cc4cbd179b3a587cf5fd25620`；此为验证产物，不是正式离线交付包。

## 未覆盖范围

固定视角和 BEV 五状态不构成四车型所有剖面、声场与爆炸组合的完整笛卡尔积。A1/integration/B 仍需完成移动剖面场暂停态自动重查、旧请求失效和负载核对；指定核显、实物音画、第二台 Windows 断网、正式同版包和完整讲解录像仍按[统一交付标准](../../../coordination/A_FINAL_DELIVERY.md)验收。本批不改变声学计算或物理安装坐标。
