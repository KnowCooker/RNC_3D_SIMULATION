# B1-ANALYSIS-001 验证与交接

- 日期：2026-09-25；Role: B1；Identity-Source: local-config；实际执行者Codex。
- 基线3c43a99，保留B1-UI-001/002与B1-DATA-001未提交修改。在原目录/原分支继续，未创建分支、未提交、未上传；本条不能作为远端认领。
- 用户授权：7项计权、图轴、归一化算法、可变时长、幅度及模型说明。跨组接线范围A1页面/播放器、A2声场单位、共享配置与Worker；未改旧demo-v2数值/fixture。

## 实现

- shared新增A/Z分析选项、可变durationSeconds、可选levelOffsetDb和预算函数；默认分析API维持Z兼容，lab界面显式选择A。
- B侧PSD乘A幅值平方；RMS用65系数最小相位A滤波，64点前史、弱缓存。声场逐点走同一个路径/滤波口径，流式前史256点。
- 批量/流式NFxLMS本来已使用联合filtered-x能量归一化；本批抽共同函数、统一标签、补归一化和已有独立梯度验证，未伪称新算法提升收益。
- 播放器由实际样本数确定时长。预计算默认16秒，1/4/8参考的当前上限186/112/73秒；256MiB预算含八路试听缓存，不探测实际RAM；实时无固定截止，历史有界。
- 初级路径统一压力系数3.459994329744977，基准BEV40km/h、粗糙度1、240kPa、20°C、seed11末4秒四座能量平均60dBA。±12dB修正只改H；x/q/S不变，u/e重新计算。该基准为教学假设，不是实录V→Pa校准。
- 模型/参数关系和外部背景出处见[说明](../../../research/LAB_V3_SIGNAL_PATH_MODEL.md)。

## 自动验证

最终`pnpm check`通过：83/83，typecheck、源码边界、全部测试、生产build；[原始日志](check.log)。保留既有Three.js chunk>500kB提醒，无构建失败。

新增测试覆盖A标准公式修正、PSD功率倍率、时域正弦响应、60dBA基准、+6dB只改H、首窗口及实时环绕的A声场/座位一致、A/Z不修改波形、非压力频谱保持Z、时长边界/42秒batch-stream逐样本相同、NFxLMS归一化、播放器40秒/1秒终点与切换。

开发过程：首轮旧77项回归全通过；新增计权测试初次错误使用20Hz/31.5Hz修正的手抄值−50.5/−39.4dB，在独立复算公式后改为对应实际频点的四舍五入值−50.4/−39.5dB，原0.1dB容差未放宽。随后83项全通过；没有改冻结fixture或旧回归容差。

- `design_weighting.py`：NumPy独立设计A滤波器，响应证据[a-weighting-design.json](a-weighting-design.json)，所列20～1000Hz最大偏差0.103dB；非全频/声级计认证。
- `calibrate.ts`：可复现教学锚点，输出[calibration.json](calibration.json)和压力系数（会重写生成系数）。
- `benchmark.ts`：112秒默认实验[benchmark.json](benchmark.json)，core1903.58ms，A/Z历史156.49ms，试听准备/单路重采样122.40ms；全信号有限。内存是Node进程结束快照，非浏览器/GPU峰值。

复现：`python docs/evidence/B/B1-ANALYSIS-001/design_weighting.py`（需NumPy），`node --import tsx docs/evidence/B/B1-ANALYSIS-001/calibrate.ts`，`node --import tsx docs/evidence/B/B1-ANALYSIS-001/benchmark.ts`，`pnpm check`。应用运行本身不依赖Python。

## 实际浏览器验证

本机127.0.0.1:5173，IAB：

1. 默认A计权/dBA、20/500Hz、NFxLMS标签和112秒上限可见。
2. 键盘录入42秒并计算，2027ms；定位42.00/42s，四座d/e结果、PSD与收敛正常。此前自动化fill未提交change事件仍算16秒，改用真实键入+Tab后确认42秒；没有将那次16秒误记为40秒成功。
3. 同一42秒实验切换A→Z，总级例如FL64.0→54.7dBA变成82.8→60.8dB，实验id和时间不变；频谱A→Z，上限500→800；声场单位同步。
4. 最终版本实时连续约100.18秒，0补缓冲、1.22秒缓冲；切换Z/A，声场/指标/收敛仍有效；暂停后时钟固定。A声场图例、最值、探针单位统一dBA。
5. 屏幕检查：时域99.98～100.18秒、频域20～500Hz、收敛0.5～100.18秒；原声灰色、残余绿色，无初始2秒等待平台，三图各一张。页面最终保留A模式暂停预览。

未声称人工听感校准、任意设备无卡顿、真实车辆降噪或完整IEC声级计符合性。真实声压需传感器灵敏度/实测参考；下一批可验证目标设备及次级路径失配。已同步开发记录、B组交接和模型说明；GitHub尚未同步。
