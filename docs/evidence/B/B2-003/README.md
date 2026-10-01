# B2-003 导出设计准备证据

最新进度（2026-10-01）：设计 #44 已合并；B1-001 #48 的五算例数值证据解除 demo-v2 依赖。已续作 [demo-v2 结果导出/配方复算 API 批次](demo-api/README.md)，[PR #51](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/51)。lab-v3/实时状态/UI/设备验收仍独立待办；下方 9 月 29 日内容保留设计交付时点。

用户角色B2；Identity-Source: user-declared；执行者Codex；2026-09-29。
任务分支`b/b2-003-export-design`；基线`842bec8197a61df9d849e60e86504292de7846d0`；[PR #44](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/44)。

本批只交付[导出设计提案](EXPORT_DESIGN.md)、[字节核算脚本](measure-storage.ts)和[实际结果](storage-audit.json)。B1-001独立完整数值证据未补齐，正式实现/验收仍阻塞；没有导出产品API、UI或共享协议改动。本目录不代表B2-003整项完成。

## 复现

在仓库根目录、已安装锁定依赖的Node 24环境运行：

```powershell
pnpm exec tsx docs/evidence/B/B2-003/measure-storage.ts
pnpm test:b
pnpm check
```

脚本只读取冻结配置/当前引擎和已入库运行素材，向stdout打印JSON；不写fixture或素材、不访问网络。测量的是默认demo-v2和默认shaped-noise lab-v3各16秒的输出，另测Float32负零/零/次正规数/正负最大有限值。每路通过显式小端DataView编解码，逐位核对，所有断言通过才打印结果。这不是完整容器的实现或五算例独立Python验收。

| 实际输出 | Float32载荷字节 | JSON数字数组UTF-8字节 |
| --- | ---: | ---: |
| demo-v2 640000个值 | 2560000 | 12737577 |
| lab-v3 768000个值 | 3072000 | 15404293 |

同一数据JSON约占5倍载荷字节，支持选择二进制结果容器；不包括manifest/浏览器复制/下载成本，未实测堆峰值。lab90秒8参考的20160000字节为公式估算，不是实际跑出的90秒测量。素材hash只用于建立复算身份，不证明数据校准或授权范围。

验证日志：[全仓检查](check.txt)、[B组检查](test-b.txt)。类型、边界、全仓145项及B组55项通过，保留原有构建大块提示。文档链接/`git diff --check`通过。未执行产品导入导出、浏览器下载/内存、跨运行环境复算、设备验收或B1五配置完整独立对照。

下一步：A1+B1审阅方案中的版本/布局/素材/发散语义；B1补齐前置证据并结束写入；下一位B2先核对本PR与main，再进入正式实现。设计可单独审阅，整项B2-003仍不可签收。
