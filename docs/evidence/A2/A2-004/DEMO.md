# A2 操作演示复现

对应组合代码`838cdf38503cb2a8dc7512ace28f7894d3f283c9`。使用真实生产页面，未替换引擎、数据或播放器。`demo-step.js`每次执行一个50秒章节，共六章；章节之间的工具等待也会保留在原始录像，因此文件时长可能超过五分钟。它是视觉交接材料，不是帧率、实物音频或音画延迟测试。

| 章 | 内容 |
| --- | --- |
| 1 | 实体/隐藏/透明车身，绕车查看结构 |
| 2 | 分层展开、相机旋转/缩放、一键复位 |
| 3 | 逐一点选四个REF和四个OUT |
| 4 | 默认/展开状态逐一点选四轮SOURCE，查看同角REF |
| 5 | 四个MIC点选与同座位d/e试听选择 |
| 6 | 重播、暂停/继续、车轮道路运动、播放中结构复位 |

复现前启动完整候选生产服务器，使用Playwright CLI 0.1.21。下面在仓库根目录运行；已有同名会话或文件时改名，勿覆盖原证据：

```powershell
npx --yes --package @playwright/cli@0.1.21 playwright-cli -s=a2-demo open http://127.0.0.1:4173/
npx --yes --package @playwright/cli@0.1.21 playwright-cli -s=a2-demo resize 1440 1100
npx --yes --package @playwright/cli@0.1.21 playwright-cli -s=a2-demo snapshot
npx --yes --package @playwright/cli@0.1.21 playwright-cli -s=a2-demo video-start output/playwright/a2-demo.webm --size=1440x1100 --fps=10
for ($chapter = 1; $chapter -le 6; $chapter++) {
    npx --yes --package @playwright/cli@0.1.21 playwright-cli -s=a2-demo --raw run-code --filename docs/evidence/A2/A2-004/demo-step.js
    if ($LASTEXITCODE -ne 0) { throw "Demo chapter failed: $chapter" }
}
npx --yes --package @playwright/cli@0.1.21 playwright-cli -s=a2-demo video-stop
npx --yes --package @playwright/cli@0.1.21 playwright-cli -s=a2-demo close
```

录制工具可能需额外准备FFmpeg；首次准备工具需联网，演示页面本身不需要外网。不要在录制期间运行性能基准或修改该浏览器会话。脚本只向测试页面注入顶部讲解字幕与章节计数，刷新即可消失，不改变仓库产品。录制不包含对声卡输出的验收，也不能用视频帧率代表产品帧率。

遇到中途失败，先`video-stop`保留片段，记录失败章节；重新载入页面后从第一章录制，勿把不完整章节记为完整演示。
