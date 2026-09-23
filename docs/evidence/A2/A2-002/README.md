# A2-002：20轮结构与时间验证

2026-09-23，Codex root-a2-markers；基线30af787，交付版本见 [PR #6 HEAD](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/6)。Windows Chromium参考回放，1440×1100视口。使用用户授权的堆叠分支，依赖PR #3，不含A1未合并PR #4/#5。

发现真实问题：快速拖动后立即复位，OrbitControls仍保留旋转/平移阻尼增量。[修复前](reset-before.json)600ms后相机距默认位置15.85模型单位；清除待处理增量再恢复相机后，[修复后](reset-after.json)立即及600ms后误差均为0。只改viewer reset，不修改播放器时钟或声学位置。

[223项浏览器断言](browser-result.json)通过：连续20轮实体/隐藏/透明、展开/收起、交替旋转/平移、缩放、复位；所有118个网格ID、位置、旋转、缩放、可见性/材质恢复；12硬件标签恢复。每轮比较同一展开布局，无累计漂移。相机比较容差1e-10模型单位，只用于浮点舍入，不是物理误差容差。

时间验证通过：暂停下传入0.75～15秒的20个进度位置，四轮角度与44条路标位置对应绝对时间；多帧停留不自行前进；16→0→16结果一致，视图复位不重置播放时间。

首次转向看到此前视锥外的路标，会按需上传几何：初始101份，最终118份，均不超过固定118网格拓扑，纹理始终0；不能把首次上传当成内存泄漏。每轮对象ID和数量一致，最终稳定。该短测不等于20分钟稳定性。

测试通过浏览器正常按钮、鼠标和进度滑杆input事件操作。测试侧使用Three既有devtools观察事件读取renderer/scene/camera，不在生产代码增加调试全局，也不篡改场景数据。滑杆精确传入时间的检查不是实际音画延迟测量。

复现：启动`pnpm dev:a --port 5174`；Playwright CLI独立无头session打开页面、snapshot后运行 `run-code --filename docs/evidence/A2/A2-002/browser-check.js`。复位单独复现见 `reset-repro.js`。`pnpm check`通过20/20测试、类型、边界与构建。

截图：[初始](initial.png)、[展开](expanded.png)、[第20轮复位](round20.png)。同批加入四轮源示意见[A2-003](../A2-003/README.md)。
