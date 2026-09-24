# A1-FULL-007 暂停态移动剖面场重新查询

状态：A1 本机实现与验证完成，待[草稿 PR #21](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/21)审查及与后续 A2 分支集成。基于 A2-FULL-011 已提交 `1d6c5b0`；经验证运行源码 SHA 在文档固定提交补入。本批只更改 A1 的 `lab/index.ts`，不改 viewer、B 组数值、Worker/共享接口或声学物理坐标。

## 原问题与修复

在预计算实验暂停于 3.90 秒时，先显示 X=0 的真实场，再把同轴车身剖面移到 X=0.60 米：A2 viewer 已隐藏旧位置色片，A1 页面却因播放时间未前进而不再请求场值，且状态仍写“空间窗口截至 3.90 s”。[`before.json`](before.json)、[原图](before-paused-moved.png)和[`reproduce.js`](reproduce.js)保留可复现前态。

现在 A1 在 viewer 的场采样点发生变化时失效旧场和请求代次，下一轮按当前实验的同一绝对时间查询最新物理点位。旧响应不能更新新平面；任何时刻最多两个场请求占用，拖动过程不会无限提交历史位置。滑块停下后最后的位置会重新查询。单纯移动不改变采样点的结构状态不会强制重算场；实时仿真的暂停语义和预计算定位语义保持原样。

## 真实页面验证

- [`verify-real-page.js`](verify-real-page.js)拦截并记录发给**真实 Worker** 的场请求，不篡改计算结果。四车型在预计算暂停 3.90 秒时，X=0.60 米每车各发一次 280 点新查询；BEV 另验证 Y=1.20 米和 Z=0.40 米。同一实验与时间不变、切片说明显示新坐标、零页面异常/WebGL上下文丢失。原始请求与状态见[`after.json`](after.json)，BEV 三轴截图见 `after-bev-*.png`。
- [`verify-slow-worker.js`](verify-slow-worker.js)仅人为延迟场请求投递 900 毫秒，并连续发送九次剖面滑块输入。延迟中最多记录两个待处理请求，最后查询 X=0.90 米而不是显示旧 X=0/0.60 米结果；时间仍为 3.90 秒。原始记录在[`slow.json`](slow.json)，[最终色片图](after-slow-latest.png)。延迟用于验证状态机，不代表实际 Worker 性能。
- [`verify-live-paused.js`](verify-live-paused.js)在真实持续仿真中启动、运行至 1.55 秒、暂停，随后将 X 剖面从 0 移到 0.60 米。同一 run、同一时间发出 280 点真实场查询并显示新色片；[`live.json`](live.json)和[截图](after-live-paused.png)。
- `pnpm exec tsx --test tests/a1-*.test.ts`：26/26；`pnpm check`：类型、边界、66/66 自动测试及生产构建通过。构建保留超过 500 kB 的非阻断提示。

浏览器为 Windows Headless Chrome 153；实际 WebGL GPU 为 NVIDIA RTX 4070 Laptop GPU。本批验证了请求与展示联动，不代替目标核显、实际音画延迟或所有车型/剖面/改制组合的最终验收。

## 后续

先审核 #21 与其依赖 #16→#7，再和 A2 #17～#20 合入最新分支作完整页面回归；B/集成协调者核查移动平面任意点查询在目标设备的负载。A1 继续处理实时试听补缓冲质量、实物音画和同版本 Windows 交付包；A2 继续参照视觉与核显验收。最终标准见[统一交付清单](../../../coordination/A_FINAL_DELIVERY.md)。
