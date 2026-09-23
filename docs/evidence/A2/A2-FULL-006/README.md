# A2-FULL-006：四架构结构讲解

本批把四车型的关键动力、储能和传动部件做成可点选的教学说明。用户可直接点击可见车模，或从视图右上角选择被壳体遮挡的关键部件；说明包含部件作用、该车型的能量路径和公开资料链接。硬件标记仍进入原信号流程；改制模式关闭讲解选择，避免把安装点击解释成结构点选。

## 复现与实测

- 在本分支执行 `pnpm dev -- --port 5183`，使用真实 lab-v3 页面 `http://127.0.0.1:5183/`。浏览器为 Windows Headless Chromium 153，视口 1280×720，WebGL 为 RTX 4070 Laptop / D3D11，画布 948×508；这不是目标核显验收。
- 运行 [浏览器脚本](real-app.js) 得到[原始结果](result.json)。依次切换 ICE、BEV、HEV、EREV，选择变速器、电池、功率分流器和增程发电机；核对各自的真实拓扑说明和可打开的来源链接。实际鼠标点击可见车型几何能打开说明；关闭、车型切换、改制模式以及硬件标记入口已检查。
- [BEV整页原图](bev-guide.png)、[EREV整页原图](erev-guide.png)记录真实渲染和讲解卡片。`pnpm exec tsx --test tests/a2-part-guide.test.ts` 检查四架构模型中列出的部件确实存在、BEV没有燃油系统、EREV发动机不机械驱动车轮。
- 资料采用[美国能源部汽油车](https://afdc.energy.gov/vehicles/how-do-gasoline-cars-work)、[纯电车](https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work)、[Toyota THS II](https://global.toyota/en/mobility/tnga/powertrain2018/ths2/)、[Stellantis/Leapmotor C10 增程](https://www.media.stellantis.com/uk-en/leapmotor/press/leapmotor-c10-uk-press-information)和[RNC硬件专利](https://patents.google.com/patent/EP3156998B1/en)。模型形状、尺寸和路径绘制是原创教学简化，不代表上述量产车。

本批验证源码 SHA 在后续文档提交中固定。`pnpm check` 结果、PR与CI以交接页及根开发记录为准。截图证明界面交互及可读性，不证明实车声学、游戏参照精细度或目标核显性能。
