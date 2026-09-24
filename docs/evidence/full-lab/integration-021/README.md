# INTEGRATION-FULL-021：A1 #21 + A2 #20 同版组合

本批仅证明指定组合版本在本机的工程检查和所列真实页面操作，不代表A组最终交付。经验证组合运行源码为合并提交 `d45c469224ed08abd271f8434c16963bdd0fe2c8`：以 A2 #20 的 `5d3bafa7a83a356ad66b7f8c8a47539ab9bbba72` 为基线，合入 A1 #21 的 `42095d2b84d4f6a5129565f9b7b0cf40854d0359`；组合见[PR #22](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/22)。两个角色仍在独立分支工作。随后仅补本报告的版本哈希，没有修改运行源码。

## 实际检查

- `pnpm check` 通过：类型、源码边界、67/67测试、生产构建。构建有大于500 kB的体积提示。
- 本机此次构建的 `dist/index.html` SHA-256 为 `0ba748733121997676f6bf35417581aee39dcfa1381446e17b1681ed8a199d7f`，主包 `dist/assets/index-BpwjiFFv.js` SHA-256 为 `0afa74a3a42d37fc7bdd4f6bea4b85e55391db8cc4cbd179b3a587cf5fd25620`。这是组合检查产物指纹，并非已分发的正式离线包。
- 在 Windows 本机 Chromium、NVIDIA RTX 4070 Laptop GPU、Vite `http://127.0.0.1:5185/`，用[复现脚本](check-combined.js)操作真实完整页与真实 Worker。ICE/HEV/EREV/BEV 各自生成不同 run，暂停于3.90秒后将 X 剖面移至0.60 m；每车出现对应run/时间/280点的新场请求，显示16个硬件标记，无页面异常或 WebGL context loss。BEV另检查实体、透明、隐藏、展开，截图分别见 `bev-solid-x.png`、`bev-transparent-x.png`、`bev-hidden-x.png`、`bev-exploded-x.png`。
- 同一页面中的 BEV 禁用第一个车门扬声器后重算，该通道 `u0Peak=0`；恢复后为0.885。设FxLMS步长为0后重算，四误差点降噪指标均为0且 `u0Peak=0`；恢复0.08后重新输出。改制模式删去一个参考后重算，Worker参考与x通道均为3，viewer标记为15。原始记录见[result.json](result.json)，删减后的画面见 `bev-reference-removed.png`。
- 用[实时暂停复现脚本](verify-live-paused.js)在组合版实测：BEV实时 run `41da937b` 停在1.55秒，X剖面从0移到0.60 m后发出同一时刻的280点请求，场注释更新且run/时间不变，无页面异常。原始输出见[live-paused.json](live-paused.json)，截图见 `live-paused-x.png`。

## 结论边界

这批证明了合并后四车基本计算/场/三维状态及所列改制和暂停态查询。未覆盖新增参考的组合操作、所有轴与所有车身模式笛卡尔积、试听质量、20分钟组合版长稳、目标核显、实物音画、第二台Windows断网包、参照级视觉或正式演示录像。旧版证据不得替代这些项目。
