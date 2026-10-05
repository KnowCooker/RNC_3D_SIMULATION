# 注册候选第二台 Windows 复现入口

2026-10-05；Role:B2；Task:B2-004；Identity-Source:user-declared；Executor:Codex。**本批准备步骤，第二机及物理断网未执行。** [旧步骤](../SECOND_WINDOWS.md)对应固定教学模型；候选注册模型不能运行旧审计后直接签收。

联网准备时取得维护者指定的候选完整提交（本批基线795d909；包含#62审计的实际提交随后记录在本批README），记录Git状态与SHA。准备Node≥22.12、pnpm11.19.0及锁文件依赖；如运行B1独立Python对照，提前准备其Python/NumPy环境。不要把候选分支称为已发布main。

在第二台独立Windows的干净仓库根目录执行，保存输出与退出码：

```text
git status --short
git rev-parse HEAD
node --version
pnpm --version
pnpm exec tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck docs/evidence/B/B2-004/registered-candidate/run-audit.ts
pnpm exec tsx docs/evidence/B/B2-004/registered-candidate/run-audit.ts test-results/B2-004-registered-second-pc/audit.json
pnpm test:b
pnpm check
```

预期五份不可变报告绑定、旧报告历史版本、新模型5/17登记与八份冻结文件核对通过；十组默认16秒共768万值，每种往返/复算一致，600帧A/Z分析在两种解码结果上相同。时钟耗时、Node版本和checkoutHead可不同，不以完整JSON哈希要求跨机器一致；核对配置、来源、布局、模型/素材、通道/单位/实际点数/时标与逐路信号SHA。出现差异保留原始输出，不覆盖旧审计文件或放宽断言。

如需新模型浏览器复现，按[注册Worker报告](../../B2-003/registered-worker/README.md)构建独立生产页面、运行真实浏览器并保存新报告/控制台；30组短矩阵与默认16秒Node审计分别记录。浏览器夹具不是正式产品文件流程，不能据此签收取消、重复导入、旧Worker响应和当前实验隔离。

真实断网包仍由指定集成者从最终干净SHA执行现有package-offline流程并核对逐文件清单；本批没有新包。把指定包拷到第二台机器后实际断Wi-Fi/网线，使用冷缓存/新浏览器配置，记录五车、两声源、完整退出重开、字段/播放/声场及正式文件流程的同版实际结果。开发者工具Offline或本机localhost不等于第二机物理断网。

沿用旧步骤的设备记录表，新增候选layoutId/model-2/素材SHA及包来源；真实峰值内存、B1默认16秒核心+Worker发送目标性能、目标核显、长稳/实物听感独立记录。设备条件缺失填“未测”，不得以容器字节下界、Node耗时或旧版本截图替代。
