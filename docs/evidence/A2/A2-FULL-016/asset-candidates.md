# 后续 SUV 资产候选审查

2026-09-24 用本机下载的原始 GLB 内 `asset.extras`、几何 accessor、贴图信息做初筛。只有 [Range Rover Sport SVR](../../../../src/team-a/viewer/assets/README.md) 实际渲染、经原 Sketchfab API 复核授权并纳入产品；其余候选**不得**仅凭本表直接加入交付。使用前需重新核对原作者、原作页许可、可下载性、品牌说明、画质、尺度、前后侧与座舱、核显性能。

| 候选 | 初筛授权 | 文件/三角形 | 当前结论 |
| --- | --- | --- | --- |
| [Porsche Cayenne](https://sketchfab.com/3d-models/porsche-cayenne-d1fd357faf314607afc39a67d5b4f4f1) / Car2022 | GLB 内 CC BY 4.0 | 13.00 MB / 1,500,954 | 几何过重；未做三视角/核显验证，须先制作并核对 LOD |
| [Mercedes-Benz GLS](https://sketchfab.com/3d-models/mersedes-benz-gls-6f8ad7f1624e42c58b4e9525cc45c8be) / Black Snow | GLB 内 CC BY 4.0 | 2.74 MB / 520,042 | 无纹理，材质/外观质量未实渲染；需许可二次核对与降面 |
| [Range Rover Sport 2023](https://sketchfab.com/3d-models/land-rover-range-rover-sport-2023-640826210d2a4be9ae6e638fec1e84fa) / Unn Interativa | GLB 内 CC BY 4.0 | 7.84 MB / 897,162；节点约 10,450 | 节点和几何过重，暂不适用核显预算 |
| [Audi Q3 2023](https://sketchfab.com/3d-models/2023-audi-q3-40-tfsi-97dccbc18cfb4f1e973fc75e278c6f66) / Ddiaz Design | **GLB 内 CC BY-NC-SA 4.0** | 15.16 MB / 约 958,000 | 二次仓库把它误标 CC0；不纳入当前许可范围 |
| `Sathwikmc/3D-Car-Visualization/public/models/suv.glb` | GLB 内 CC BY 4.0 | 16.46 MB | 文件实际是 Bugatti La Voiture Noire，不是 SUV |
| [3DAssets.dev Mid-size SUV](https://3dassets.dev/packs/car-park-and-road-vehicle-fleet) | 站点标 CC0 | 约 1 MB / 约 30,000 | 已看原预览，风格仍明显低模，不满足本轮真实车质感 |

前三个 CC BY 候选的二次镜像文件见 [Draxler 资产目录](https://github.com/Sultan-Sovetov/Draxler/tree/main/public/car-models)。本批未将其二进制加入仓库，也未宣称真实量产动力类别匹配教学 ICE/BEV/HEV/EREV。
