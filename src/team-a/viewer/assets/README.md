# 写实外观范例资产

`range-rover-sport-svr.glb` 是独立的 SUV 外观欣赏资源，**不**代表本项目 ICE/BEV/HEV/EREV 任一教学动力架构的实车结构、尺寸或声学安装点；外观模式隐藏教学标记和声场，返回结构实验后继续使用原创教学车。项目与 Land Rover 无关联。

- 原作：[Land Rover Range Rover Sport SVR](https://sketchfab.com/3d-models/land-rover-range-rover-sport-svr-5462d65acb0e4dca8c20da82360261db)，Mona x Supercars / Sketchfab 用户 `Car2022`。
- 授权：[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)。2026-09-24 通过 Sketchfab 模型 API `https://api.sketchfab.com/v3/models/5462d65acb0e4dca8c20da82360261db` 的 `license` 字段和 GLB 内 `asset.extras` 双重核验，均为 CC Attribution；允许商用，须署名。
- 获取：原作 GLB 的 [公开 GitHub 镜像](https://github.com/Sultan-Sovetov/Draxler/blob/main/public/car-models/landrover/land_rover_range_rover_sport_svr.glb)。本仓库仅改文件名，GLB 内容未修改。运行时居中缩放至约 4.8 m，并可临时更改 `carPaint` 材质颜色；不写回模型文件。
- 文件：5,726,332 字节；SHA-256 `8da77f899401e9a04dd7624df350a3b1a99b154d721a905ea8154a894a95e904`；74,127 三角形；纹理内嵌，可离线加载。三角面和许可元数据由 `tests/a2-showroom-asset.test.ts` 守护。

品牌名称仅用于准确识别原作；后续替换资产时须重新核验原作许可、署名、视觉与性能，再更新本文件及测试。

## 纯电外观参考：2021 Tesla Model Y

`tesla-model-y.meshopt.glb` 仅在选择 BEV 并打开写实外观时按需加载。它是纯电 SUV 的外观参考，**不**代表本项目教学车的电池、传感器、扬声器和声场坐标。项目与 Tesla 无关联。

- 原作：[2021 Tesla Model Y](https://sketchfab.com/3d-models/2021-tesla-model-y-59e2ead369984b1a85c800ff6cf6789d)，Sketchfab 用户 `tonielpro520`。2026-09-24 以 [Sketchfab 模型 API](https://api.sketchfab.com/v3/models/59e2ead369984b1a85c800ff6cf6789d) 的 `license` 字段、[公开镜像的 license.txt](https://github.com/ShineTJKU/Ag/blob/main/apps/console-web/public/models/tesla_model_y/license.txt) 和 glTF 内 `asset.extras` 核对：均标为 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，要求署名，允许商用。原模型页面未提供更早的创作来源链，作者身份以发布页面标示为准。
- 获取：[公开 GitHub 镜像](https://github.com/ShineTJKU/Ag/tree/main/apps/console-web/public/models/tesla_model_y)中的 `scene.gltf`、`scene.bin` 和两张纹理。使用 glTF Transform 4.5.0 `copy` 打成单个 GLB，再用 `meshopt` 转码以便离线按需加载。转码改变了顶点量化和缓冲压缩，保留了文件内作者、许可、来源字段；运行时临时修改 `Carro_Pintura` 颜色，并把原始近哑光漆面调为较有反射的金属度 0.32、粗糙度 0.28，不写回模型文件。解码器随 Three.js 构建打包，不访问 CDN。
- 文件：10,353,640 字节；SHA-256 `9cea26e8c89ba30af890cfa47a4dda2a0f66eca3b52ca16bd9fc4b22ab0eaa59`；287,080 三角形；`EXT_meshopt_compression` + `KHR_mesh_quantization`；纹理内嵌。约比原始 30,708,504 字节 GLB 小 66%。
- 实际截图见 [A2-FULL-016 报告](../../../../docs/evidence/A2/A2-FULL-016/README.md)。它比 Range Rover 范例的漆面和灯组层次弱，仍属阶段性资产；指定核显负载与最终游戏/选车参照精细度尚未验收。
