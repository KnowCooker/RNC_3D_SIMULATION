# A2-P7-002 · P7+ 独立外观重建

2026-10-01。Role: A2；Identity-Source: user-declared；实际执行者：Codex 代 A2。

用户仅授权精细重做 P7+，其他四款车型维持原样。本批使用 interactive-3d-atlas，依据懂车帝多角度照片与小鹏2026款官网细节，新增独立曲面工厂。参考年款、来源及精度边界见 [P7PLUS-SOURCES](../../../../src/team-a/viewer/P7PLUS-SOURCES.md)。

本地演示：<http://127.0.0.1:5197/#p7plus>。

## 修改文件与效果

- `src/team-a/viewer/p7plus-model.ts`：P7+ 专用纵向截面、前舱压线、真实开口轮拱、连续拱形车顶/长溜背、收尖侧窗、一体灯带/分体灯腔、双层尾翼/尾灯、五辐分叉轮毂及五座内饰。31个语义总成，后风挡归属掀背尾门，后保险杠独立。
- `src/team-a/viewer/xpeng-model.ts`：仅将 P7+ 分派至新工厂，其余车型继续原工厂。
- `src/team-a/viewer/lab-viewer.ts`、`viewer.css`：P7+ 专用取景、正前/正侧/正后按钮、懂车帝来源、直接入口；窄窗默认收起拆装清单并拉远复位取景。
- `tests/a2-p7plus.test.ts`：4项专项测试覆盖尾门/风挡分组、真实射线拾取与剖切、往复拆装精确复位及车漆材质隔离。
- `P7PLUS-SOURCES.md`、`XPENG-SOURCES.md`、本目录、根开发记录和 A2 交接：来源、验收证据及限制。

当前工作区还保留上一批 A2-XPENG-001 未提交变更；本目录描述其后的 P7+ 专项批次，不将原有五车代码误列为本次其他车型重做。无 A1/B/shared/integration/fixture 修改，也未改变声学计算。

## 验证

最终结果：`pnpm check` 退出0，180/180测试通过（其中A2共40项）；类型检查、源码边界和构建通过。Chrome30项检查通过，无JavaScript运行错误；最终多视角及740宽窗口截图已人工查看。`git diff --check` 通过。源码与记录均尚未提交。

- `check.log`：最终 `pnpm check` 原始输出，包含类型、源码边界、全仓测试及生产构建。
- `browser-check.mjs` / `browser-results.json`：本地生产页面实际 Chrome WebGL 检查，覆盖三正交取景的画布拾取、座舱、透明、三轴剖切、逐件/31件全部拆装与复位、自动暂停/回装、车漆、车型切换、鼠标旋转缩放、窄屏。
- `other-models-before.json` / `other-models-after.json`：本批前后 X9、L03、M03、GX 几何位置缓冲、对象位置/名称和材质描述（排除随机 UUID）摘要逐项一致。`other-models-hash.ts` 为摘要脚本。
- 实际渲染截图：`front-quarter.png`、`front.png`、`side.png`、`rear.png`、`rear-quarter.png`、`cabin.png`、`section.png`、`exploded.png`、`narrow.png`。

开发中首次几何测试9/11通过，2项因胎面环超出轮胎半径导致穿地失败；修正胎面几何后通过，未放宽断言。视觉检查发现正后镜头位于车间墙后，已将镜头前移，并以真实画布拾取验证可见性。保留既有构建大块提示。

## 未完成与下一步

照片重建没有原厂扫描/CAD、多视角相机标定或毫米级误差证明；程序检查不能替代外观验收。隐藏电池/电驱/悬架及拆解路径仍为教学示意，未建立 P7+ 实车声学配准。下一步先由用户评审多视角外观；若需达到实车扫描精度，应取得具有使用授权的对应年款 CAD/扫描资产后进行几何替换与接口复验。

分支 `a/a2-xpeng-reconstruction`；基线提交 `4c097d47dc1d8d3d511cfa6a801059373d867e0c`。本批未提交、无新增提交 SHA。按用户要求仅本地，GitHub 尚未同步，未创建/更新 PR，远端认领未生效。
