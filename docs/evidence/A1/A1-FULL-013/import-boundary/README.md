# A1-FULL-013 / 案例导入的物理布局边界

2026-09-29；Role: A1；Identity-Source: user-declared；执行者：Codex 代 A1。运行源码固定为 A1 [PR #38](https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/38) 的 `449d36af3db2ff2c14e5c05cbafd9a7a8b71b99f`。本批无运行代码修改，仅验证公开页面的只读案例导入行为。

在 Windows / Playwright CLI Chromium 153 的生产构建上，先运行 BEV 10 秒预计算并显示末尾教学声场。然后把既有[旧案例](../../A1-FULL-012/example-review.json)的 B 配置添加未注册的 `layoutId: showroom-unverified-v1`，形成[测试文件](unknown-layout-case.json)并上传。页面显示“案例物理布局身份不受支持”，不展示导入案例；原实验 ID 和“教学布局声场截至 10.00 s”均保持不变。[拒绝时截图](unknown-layout-rejected.png)。

随后上传原旧案例，它没有 `layoutId` 字段。页面把 A/B 均解释为 `teaching-fixed-v1`，显示后排残余 B−A 为 RL、RR 各 `+3.0 dB`，同时说明文件未经签名、仅供只读复核；原实验及声场仍不变。[旧案例截图](legacy-layout-imported.png)。[浏览器脚本](qa-layout-import.js)与[原始 CLI 输出](qa-layout-import.log)记录了上述断言及 0 页面脚本异常。仅观察到既有 `favicon.ico` 404，本批未检验目标设备或实际声音。

边界要区分两层：`compareCases` 对不同布局的内存摘要不给数值差值；**文件导入**还要求布局已被当前版本支持，因此未知布局文件直接拒绝，不能把它解释为“已导入但不可比”。旧 `rnc-case-v1` 的缺省身份兼容教学布局。未来接入已核实的写实布局时，应在注册 B 数值路径和 A2 安装锚点后，再决定该布局案例的导入/同布局比较规则；当前测试不证明新布局已可计算。

复现：运行当前提交的 `pnpm check`/`pnpm start`，在 PowerShell 设置 `$env:PORT='5187'` 后启动服务，以 Playwright CLI `run-code --filename` 执行本目录脚本；脚本中的 URL 端口可按本机调整。测试文件由旧案例派生，仅增加 B 布局身份，不更改原仓库样例。
