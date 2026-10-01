"use strict";
const $=id=>document.getElementById(id);
const P={
 overview:{title:"总览",file:"01-overview-approved.png",caption:"首页母版：直接使用用户批准的原始图片，画面未重绘。",purpose:"从整车与道路进入实验",steps:["左侧切换观察方式，保持同车与相机上下文。","点击声场大卡或主按钮进入声场实验。","三张摘要卡分别进入路径解释、结构布置和频谱详情。"]},
 field:{title:"声场实验",file:"02-acoustic-field.png",caption:"左侧三维主舞台，右侧同窗对照，底部配置与共用回放。",purpose:"定位噪声与观察 ANC 差异",steps:["选择座位、声场类型和切片方向。","修改工况使旧结果失效；演示运行后才可保存方案。","回放与观察控制共用一组状态；本原型不驱动真实场图。"]},
 structure:{title:"结构与布置",file:"03-structure-layout.png",caption:"部件树、同车爆炸图、安装点检查器与路径条。",purpose:"解释结构并设计布置",steps:["部件选择、拆装显示和相机恢复分开处理。","安装点与启用修改形成布局草稿，可撤销。","离开未保存布局前可保留草稿、放弃或继续编辑。"]},
 compare:{title:"方案对比",file:"04-scenario-comparison.png",caption:"同条件 A/B、频段与座位变化、报告预览及导出。",purpose:"把实验变成可解释的判断",steps:["基准 A 与方案 B 各自保存配置和时窗。","条件不一致时给出原因，不导出误导的比较。","报告同时包含改善、局部变差和来源限制。"]}
};
const freshConfig=()=>({vehicle:"纯电 SUV",scene:"海岸",road:"沥青",speed:80,band:"20–200 Hz",weight:"Z",window:"10–15 s"});
const snapshot=(name,layout)=>({name,config:freshConfig(),layout,demo:true});
const initial=()=>({page:"overview",config:freshConfig(),mode:"外观",seat:"驾驶位",field:"原始",slice:"水平",slicePosition:50,explode:55,part:"左前门扬声器",mount:"左前门标准位",enabled:true,layoutDirty:false,result:"ready",paused:true,time:12,snapshots:[snapshot("A 基准方案","基准布局"),snapshot("B 优化方案","优化布局")],history:[],pending:null});
let state=initial(),runToken=0,toastTimer=null;
let savedLayout={mount:state.mount,enabled:state.enabled};
function applyMotion(){document.body.classList.toggle('reduce-motion',state.reducedMotion==='减少动态')}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const select=(key,values,value)=>'<select data-setting="'+key+'">'+values.map(v=>'<option'+(v===value?' selected':'')+'>'+esc(v)+'</option>').join("")+'</select>';
const field=(label,control)=>{const tag=control.startsWith('<div')?'div':'label';return '<'+tag+' class="field"><span>'+label+'</span>'+control+'</'+tag+'>'};
const btn=(text,action,value="",cls="")=>'<button class="'+cls+'" data-action="'+action+'" data-value="'+esc(value)+'">'+text+'</button>';
const segments=(key,values,value)=>'<div class="segmented">'+values.map(v=>'<button data-action="set-choice" data-key="'+key+'" data-value="'+esc(v)+'" aria-pressed="'+(value===v)+'">'+esc(v)+'</button>').join("")+'</div>';
const callout=(text,warn=false)=>'<div class="callout'+(warn?' warning':'')+'">'+text+'</div>';
const common=[["总览","route","overview",612,9,72,55],["声场实验","route","field",704,9,105,55],["结构与布置","route","structure",822,9,119,55],["方案对比","route","compare",957,9,105,55],["显示偏好","settings","",1580,13,69,49]];
const H={
 overview:[["外观视图","view","外观",30,231,80,93],["透明视图","view","透明",30,327,80,87],["声场视图","route","field",30,420,80,85],["拆解视图","route","structure",30,510,80,62],["观察车辆","view","外观",285,284,625,270],["车内声场详情","route","field",1090,90,550,410],["传递路径","path","",545,568,341,218],["结构布置","route","structure",901,568,360,218],["频谱对比","spectrum","",1275,568,367,218],["海岸场景","scene","海岸",80,816,158,87],["山地场景","scene","山地",262,816,158,87],["沙漠场景","scene","沙漠",448,816,158,87],["雪山场景","scene","雪山",636,816,159,87],["进入声场实验","route","field",1075,830,350,67]],
 field:[["座位与探针","field-controls","",435,329,150,116],["ANC 同窗对照","spectrum","",1114,92,510,246],["水平切面","slice","水平",1264,365,120,48],["纵向切面","slice","纵向",1385,365,115,48],["横向切面","slice","横向",1501,365,119,48],["切面位置","field-controls","",1448,464,172,71],["频谱详情","spectrum","",1110,582,524,214],["道路场景","scene","",34,744,208,84],["车速与工况","scene","",246,744,159,84],["频段与计权","scene","",410,744,174,84],["声场类型","field-controls","",590,744,287,84],["运行实验","run","",882,751,186,72],["播放/暂停","play","",35,854,67,60],["时间与倍速","playback","",108,852,1121,63],["保存方案","save","",1250,850,192,65]],
 structure:[["部件树","structure-controls","",35,92,308,694],["三维部件选择","structure-controls","",370,117,818,569],["安装点与启用","structure-controls","",1218,93,420,683],["拆解程度","structure-controls","",366,695,381,84],["逐件拆解","explode-step","",778,703,129,52],["逆序回装","reassemble","",917,703,125,52],["恢复相机","camera","",1054,704,125,51],["传递路径详情","path","",41,805,1018,109],["保存布局并运行","commit-layout","",1153,826,332,65],["撤销布局","undo","",1500,826,139,63]],
 compare:[["查看比較条件","comparison","",443,108,830,46],["选择方案 A","comparison","",47,179,780,340],["选择方案 B","comparison","",847,179,780,340],["频段与座位变化","spectrum","",44,537,1015,287],["报告预览","report","",1080,537,548,290],["返回实验","route","field",1103,846,179,62],["导出评审报告","report","",1302,846,327,62]]
};
function toast(text){$("toast").textContent=text;$("toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),3200)}
function close(){if($("drawer").open)$("drawer").close()}
function open(title,html){$("drawer-title").textContent=title;$("drawer-body").innerHTML=html;if(!$("drawer").open)$("drawer").showModal()}
function statusText(){return state.result==="ready"?"示例结果可用":state.result==="running"?"运行等待态演示":state.result==="stale"?"配置已改 · 需重新运行":"尚未运行"}
function renderState(){
 const values=[state.config.scene+" · "+state.config.road,state.config.speed+" km/h",state.config.band,state.seat,state.field+"场",statusText(),state.layoutDirty?"布局草稿未保存":"布局已保存"];
 $("state-summary").replaceChildren();values.forEach((v,i)=>{const span=document.createElement("span");span.className="pill"+((i===5&&state.result!=="ready")||(i===6&&state.layoutDirty)?" warn":"");span.textContent=v;$("state-summary").append(span)});
}
function render(){
 const p=P[state.page];$("screen").src="screens/"+p.file;$("screen").alt=p.title+" · 云境香槟页面设计";$("original").href=$("screen").src;$("page-caption").textContent=p.caption;$("page-purpose").textContent=p.purpose;$("page-behavior").replaceChildren();p.steps.forEach(t=>{const li=document.createElement("li");li.textContent=t;$("page-behavior").append(li)});
 $("page-nav").replaceChildren();Object.entries(P).forEach(([key,p])=>{const b=document.createElement("button");b.textContent=p.title;b.dataset.action="route";b.dataset.value=key;if(state.page===key)b.setAttribute("aria-current","page");$("page-nav").append(b)});
 $("hotspots").replaceChildren();[...common,...H[state.page]].forEach(([label,action,value,x,y,w,h])=>{const b=document.createElement("button");b.className="hotspot";b.dataset.action=action;b.dataset.value=value;b.setAttribute("aria-label",label);b.title=label;Object.assign(b.style,{left:x/1672*100+"%",top:y/941*100+"%",width:w/1672*100+"%",height:h/941*100+"%"});const s=document.createElement("span");s.textContent=label;b.append(s);$("hotspots").append(b)});
 renderState();history.replaceState(null,"","#"+state.page);
}
function route(page,skip=false){if(!P[page])return;if(state.layoutDirty&&state.page==="structure"&&page!=="structure"&&!skip){state.pending=page;open("布局尚未保存",callout("你修改了安装点或启用状态。选择保留草稿、放弃改动，或继续编辑。",true)+'<div class="button-row">'+btn("保留草稿并离开","leave-keep","","primary")+btn("放弃并离开","leave-discard")+btn("继续编辑","close")+"</div>");return}close();state.page=page;render();$("artboard").scrollIntoView({block:"start",behavior:"instant"})}
function invalidate(){runToken++;state.result="stale";renderState()}
function configChange(key,value){if(state.config[key]===value)return;state.config[key]=value;invalidate()}
function sceneDrawer(preview){if(preview){configChange("scene",preview)}open("场景与工况",
 '<div class="choice-grid">'+["海岸","山地","沙漠","雪山"].map((s,i)=>'<button class="choice" data-action="choose-scene" data-value="'+s+'" aria-pressed="'+(state.config.scene===s)+'"><strong>'+s+'</strong><small>'+["湖岸道路 · 开阔","山道弯路 · 起伏","沙地环境 · 粗糙","雪山环境 · 低温"][i]+'</small></button>').join("")+'</div>'+
 '<div class="form-grid">'+field("路面类型",select("road",["沥青","粗糙沥青","混凝土"],state.config.road))+field('车速 <output id="speed-out">'+state.config.speed+' km/h</output>','<input type="range" min="20" max="140" step="5" value="'+state.config.speed+'" data-setting="speed">')+field("分析频段",select("band",["20–200 Hz","20–1000 Hz","200–500 Hz"],state.config.band))+field("计权",select("weight",["Z","A"],state.config.weight))+'</div>'+
 callout("切换场景会建立待运行配置；车辆、热图和读数在本原型中为固定效果图。正式产品需同步三维道路与声源参数。")+'<div class="button-row">'+btn("进入声场实验","route","field","primary")+btn("演示运行状态","run")+btn("关闭","close")+"</div>")}
function fieldDrawer(){open("声场观察",
 field("测量位置",select("seat",["驾驶位","副驾位","后左位","后右位"],state.seat))+
 field("声场类型",segments("field",["原始","残余","改善量"],state.field))+field("剖面方向",segments("slice",["水平","纵向","横向"],state.slice))+
 field('切面位置 <output id="slice-out">'+state.slicePosition+'%</output>','<input type="range" min="0" max="100" value="'+state.slicePosition+'" data-setting="slicePosition">')+
 '<div class="plane-preview" aria-label="切面方向示意"><div class="cabin-shape"></div><div id="slice-plane" class="slice-plane"></div></div>'+
 callout("原始与残余共享固定声压色标；改善量使用独立零中心色标。以上控件演示交互状态，背景三维热图保持设计示例。")+btn("完成观察设置","close","","primary"));updatePlane()}
function updatePlane(){const el=$("slice-plane");if(!el)return;el.style.top=(20+state.slicePosition*.4)+"%";el.style.transform=state.slice==="水平"?"rotateX(40deg)":state.slice==="纵向"?"rotateY(55deg) rotateZ(90deg)":"rotateY(-35deg) rotateZ(90deg)"}
function structureDrawer(){open("部件与安装点",
 field("当前部件",select("part",["左前门扬声器","右前门扬声器","左后门扬声器","右后门扬声器"],state.part))+
 '<div class="form-grid">'+field("安装点",select("mount",["左前门标准位","右前门标准位","左后门标准位","右后门标准位"],state.mount))+field("启用状态",select("enabled",["启用","停用"],state.enabled?"启用":"停用"))+'</div>'+
 field('拆解程度 <output id="explode-out">'+state.explode+'%</output>','<input type="range" min="0" max="100" step="1" value="'+state.explode+'" data-setting="explode">')+
 '<div class="explode-demo" aria-label="拆装显示层级示意"><div id="layer-body" class="layer body"></div><div class="layer seats"></div><div id="layer-base" class="layer base"></div></div>'+
 callout("拆解只影响显示位置，物理坐标不变。安装点修改会生成布局草稿；本原型以控件和层级示意演示状态。")+
 '<div class="button-row">'+btn("逐件拆解","explode-step")+btn("逆序回装","reassemble")+btn("撤销布局","undo")+btn("保存布局并运行","commit-layout","","primary")+"</div>");updateExplode()}
function updateExplode(){if($("explode-out"))$("explode-out").textContent=state.explode+"%";if($("layer-body"))$("layer-body").style.transform="translateY("+(-12-state.explode*.35)+"px)";if($("layer-base"))$("layer-base").style.transform="translateY("+(12+state.explode*.35)+"px)"}
function layoutChange(key,value){if(state[key]===value)return;state.history.push({mount:state.mount,enabled:state.enabled,layoutDirty:state.layoutDirty});state[key]=value;state.layoutDirty=true;invalidate()}
function chart(){return '<svg class="chart" viewBox="0 0 540 180" role="img" aria-label="示例 ANC 前后频谱，非计算结果"><g stroke="#ddcbb2" stroke-width="1"><path d="M42 22V150H515M42 55H515M42 90H515M42 122H515"/></g><path d="M42 54L62 39L81 53L100 42L127 63L153 55L177 72L204 63L230 88L257 77L284 95L310 89L337 100L365 94L391 107L420 111L447 108L477 118L513 125" fill="none" stroke="#c2674d" stroke-width="2"/><path d="M42 85L62 73L81 83L100 78L127 92L153 87L177 102L204 94L230 114L257 105L284 122L310 115L337 124L365 120L391 133L420 130L447 134L477 138L513 141" fill="none" stroke="#5287a2" stroke-width="2"/><g fill="#716657" font-size="11"><text x="7" y="20">dB</text><text x="42" y="170">20</text><text x="165" y="170">100</text><text x="330" y="170">500</text><text x="460" y="170">1000 Hz</text></g></svg>'}
function spectrumDrawer(){open("频谱与同窗对照",'<div class="data-tiles"><div><small>ANC 关闭 · 示例</small><strong>75.8 dB</strong></div><div><small>ANC 开启 · 示例</small><strong>61.9 dB</strong></div></div><h3>同工况 · 同座位 · 同时窗</h3>'+chart()+callout("曲线与读数为设计样例；正式分析按采样率、时间窗、频段及计权计算，不能使用本图数字作为结果。")+'<div class="button-row">'+btn("观察座位与切片","field-controls")+btn("进入方案对比","route","compare","primary")+"</div>")}
const pathTexts=["路面起伏形成轮端激励；三维道路外观与声源参数需对应。","轮胎将路面输入转为轮端振动，速度与胎面等影响源谱。","悬架传递与隔离振动；实际通道由已定义的初级路径描述。","车身结构把振动传入座舱，解释动画与计算数据分层。","座舱测点记录原始和残余声压；ANC 通过扬声器作用于对应声学路径。"];
function pathDrawer(index=0){open("噪声传递路径",'<div class="path-steps">'+["路面","轮胎","悬架","车身","座舱"].map((s,i)=>btn((i===index?"● ":"")+s,"path-node",i)).join("")+'</div><h3>'+["路面激励","轮端输入","悬架传递","车身响应","座舱声场"][index]+'</h3><p>'+pathTexts[index]+'</p>'+callout("节点可逐个点选；正式产品联动同车部件、所选 H/S 通道与解释动画。此处为设计交互。")+'<div class="button-row">'+btn("查看结构","route","structure")+btn("进入声场","route","field","primary")+"</div>")}
function playbackDrawer(){open("统一回放控制",field('时间 <output id="time-out">'+state.time.toFixed(1)+' / 30.0 s</output>','<input type="range" min="0" max="30" step=".1" value="'+state.time+'" data-setting="time">')+field("回放速度",select("rate",["0.5×","1×","2×"],state.rate||"1×"))+'<div class="button-row">'+btn(state.paused?"播放状态":"暂停状态","play","","primary")+btn("回到起点","rewind")+btn("关闭","close")+'</div>'+callout("本原型仅展示时间/倍速状态，不播放音频或驱动三维帧。正式产品所有视图共用一个播放时钟。"))}
function run(){if(state.layoutDirty){toast("请先保存布局，再运行示例。");structureDrawer();return}const token=++runToken;state.result="running";renderState();open("运行实验 · 状态演示",'<div class="status-row"><span class="spinner"></span>展示等待态…</div>'+callout("此动作演示交互反馈，不调用声学仿真。")+btn("取消","cancel-run"));setTimeout(()=>{if(token!==runToken)return;state.result="ready";renderState();open("示例结果已就绪",callout("<strong>现在可演示保存方案。</strong><br>示例效果图与数值仍为固定设计素材，并非当前参数的计算输出。")+'<div class="button-row">'+btn("保存方案","save","","primary")+btn("继续观察","close")+"</div>")},850)}
function saveDrawer(){if(state.result!=="ready"||state.layoutDirty){open("当前结果不能保存",callout(state.layoutDirty?"布局尚未保存，请先保存并重新运行。":"配置已修改或结果尚不可用，请先运行。",true)+btn("演示运行状态","run","","primary"));return}open("保存示例方案",field("保存到",'<select id="save-slot"><option value="0">A 基准方案</option><option value="1">B 优化方案</option></select>')+field("方案名称",'<input id="save-name" type="text" maxlength="40" value="当前示例方案">')+callout("保存配置、布局摘要与示例时间窗。仅用于测试设计流程，不保存真实实验数据。")+btn("保存到所选方案","save-confirm","","primary"))}
function mismatches(){const [a,b]=state.snapshots;if(!a||!b)return["需要同时保存 A 与 B"];const labels={vehicle:"车型",scene:"道路环境",road:"路面",speed:"速度",band:"频段",weight:"计权",window:"时间窗"};return Object.entries(labels).filter(([key])=>a.config[key]!==b.config[key]).map(([key,label])=>label+"："+a.config[key]+" / "+b.config[key])}
function comparisonDrawer(){const errors=mismatches();open("方案与可比条件",'<div class="data-tiles">'+state.snapshots.map((s,i)=>'<div><small>方案 '+(i?"B":"A")+' · 设计示例</small><h3>'+esc(s?.name||"尚未保存")+'</h3><small>'+esc(s?[s.config.scene,s.config.speed+" km/h",s.config.band,s.config.weight+"计权"].join(" / "):"")+'</small></div>').join("")+'</div>'+callout(errors.length?"不可直接比较：<br>"+errors.map(esc).join("<br>"):"示例条件一致。正式产品还需要物理测点映射与数据身份校验。",!!errors.length)+'<div class="button-row">'+(errors.length?btn("将 A 条件带回实验","align","","primary"):btn("预览报告","report","","primary"))+btn("返回实验","route","field")+"</div>")}
function reportDrawer(){const errors=mismatches();open("报告预览与导出",
 (errors.length?callout("当前条件不一致，不能导出对比结论：<br>"+errors.map(esc).join("<br>"),true):callout("设计示例报告。包含固定示例结论与当前原型方案配置；不属于真实工程证据。"))+
 field("观察结论",'<textarea id="report-text" maxlength="500">整体改善，局部频段仍需优化。此处为页面设计示例。</textarea>')+
 '<div class="checks">'+["配置差异","同窗频谱","座位结果","数据来源"].map(t=>'<label><input type="checkbox" checked data-report="'+t+'"> '+t+'</label>').join("")+'</div><div class="button-row"><button class="primary" data-action="export"'+(errors.length?" disabled":"")+'>导出设计示例报告</button>'+btn("查看比较条件","comparison")+btn("返回实验","route","field")+"</div>")}
function exportReport(){if(mismatches().length){comparisonDrawer();return}const report={type:"design-prototype-example",version:"E-FINAL-1.0",notice:"仅用于页面与交互设计，不是声学仿真或实车验证报告",conclusion:$("report-text").value,included:[...document.querySelectorAll("[data-report]:checked")].map(e=>e.dataset.report),schemes:state.snapshots};download("RNC-设计示例报告.json",JSON.stringify(report,null,2),"application/json");toast("已导出带设计示例标识的文件。")}
function download(name,text,type){const u=URL.createObjectURL(new Blob([text],{type:type+";charset=utf-8"}));const a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
function componentsDrawer(){open("组件与状态规范",'<div class="swatch-grid">'+[["暖白底","#F6F1E9"],["正文","#2F281F"],["香槟主色","#B68B55"],["高光","#F5DEB4"],["深端","#87613C"],["异常","#A64C39"]].map(([t,c])=>'<div class="swatch"><i style="background:'+c+'"></i>'+t+'<br>'+c+'</div>').join("")+'</div><h3>操作层级</h3><div class="button-row">'+btn("主操作","demo","","primary")+btn("次操作","demo")+'<button disabled>不可用状态</button></div>'+field("可读的参数控件",'<input type="text" placeholder="14–16 px 正文，清晰焦点">')+'<div class="status-row">未运行：显示引导，保留车辆观察。</div><div class="status-row"><span class="spinner"></span>计算中：阶段反馈，允许取消。</div><div class="status-row warn">配置已改：旧结果失效，需要重新运行。</div><div class="status-row warn">不可比：列出条件差异，提供恢复入口。</div>'+callout("主面板圆角 28 px；内卡 18 px；按钮 32 px；8 px 间距体系。低动态偏好关闭装饰动画。")+'<a href="design-tokens.json" target="_blank">打开可交付样式变量 ↗</a>')}
function viewDrawer(mode){state.mode=mode||state.mode;renderState();open("车辆观察方式",field("显示模式",segments("mode",["外观","透明","声场","拆解"],state.mode))+callout("正式交互：左键拖动旋转、滚轮缩放，切换显示模式保留相机。原型采用固定效果图，模式状态不会实时重绘车辆。")+'<div class="button-row">'+btn("声场实验","route","field","primary")+btn("结构拆解","route","structure")+btn("恢复相机状态","camera")+"</div>")}
function settingsDrawer(){open("显示偏好",field("减少动态效果",select("reducedMotion",["跟随系统","减少动态"],state.reducedMotion||"跟随系统"))+callout("正式实现应按设备调整画质，保持同一车辆身份。性能模式不能改变结果含义。")+'<div class="button-row">'+btn("查看组件规范","components")+btn("关闭","close","","primary")+"</div>")}
function action(name,value="",key=""){
 if(name==="route")return route(value);
 if(name==="close")return close();
 if(name==="scene")return sceneDrawer(value);
 if(name==="choose-scene"){configChange("scene",value);return sceneDrawer()}
 if(name==="field-controls")return fieldDrawer();
 if(name==="slice"){state.slice=value;return fieldDrawer()}
 if(name==="structure-controls")return structureDrawer();
 if(name==="set-choice"){state[key]=value;renderState();return key==="mode"?viewDrawer():fieldDrawer()}
 if(name==="view")return viewDrawer(value);
 if(name==="settings")return settingsDrawer();
 if(name==="path")return pathDrawer();
 if(name==="path-node")return pathDrawer(Number(value));
 if(name==="spectrum")return spectrumDrawer();
 if(name==="run")return run();
 if(name==="cancel-run"){runToken++;state.result="idle";renderState();close();return toast("已取消等待态演示。")}
 if(name==="play"){state.paused=!state.paused;return playbackDrawer()}
 if(name==="playback")return playbackDrawer();
 if(name==="rewind"){state.time=0;return playbackDrawer()}
 if(name==="save")return saveDrawer();
 if(name==="save-confirm"){const slot=Number($("save-slot").value);state.snapshots[slot]={name:$("save-name").value.trim()||"示例方案",config:structuredClone(state.config),layout:state.mount+(state.enabled?" · 启用":" · 停用"),demo:true};close();return toast("已保存设计示例方案 "+(slot?"B":"A")+"。")}
 if(name==="comparison")return comparisonDrawer();
 if(name==="report")return reportDrawer();
 if(name==="export")return exportReport();
 if(name==="align"){state.config=structuredClone(state.snapshots[0].config);invalidate();route("field");return sceneDrawer()}
 if(name==="explode-step"){state.explode=Math.min(100,state.explode+15);return structureDrawer()}
 if(name==="reassemble"){state.explode=0;return structureDrawer()}
 if(name==="camera")return toast("已演示恢复相机操作；固定效果图不改变视角。");
 if(name==="commit-layout"){savedLayout={mount:state.mount,enabled:state.enabled};state.layoutDirty=false;state.history=[];invalidate();route("field",true);return run()}
 if(name==="undo"){const old=state.history.pop();if(!old)return toast("没有可撤销的布局修改。");Object.assign(state,old);invalidate();return structureDrawer()}
 if(name==="leave-keep"){const p=state.pending;state.pending=null;return route(p,true)}
 if(name==="leave-discard"){Object.assign(state,savedLayout);state.layoutDirty=false;state.history=[];invalidate();const p=state.pending;state.pending=null;return route(p,true)}
 if(name==="components")return componentsDrawer();
 if(name==="reset"){runToken++;state=initial();savedLayout={mount:state.mount,enabled:state.enabled};applyMotion();close();render();return toast("已恢复初始设计示例。")}
 if(name==="demo")return toast("组件按下与反馈状态示例。");
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(b&&!b.disabled)action(b.dataset.action,b.dataset.value||"",b.dataset.key||"")});
document.addEventListener("input",e=>{const key=e.target.dataset.setting;if(!key)return;const v=e.target.value;if(key==="speed"){configChange(key,Math.max(20,Math.min(140,Number(v))));if($("speed-out"))$("speed-out").textContent=state.config.speed+" km/h"}if(key==="slicePosition"){state.slicePosition=Number(v);if($("slice-out"))$("slice-out").textContent=v+"%";updatePlane()}if(key==="explode"){state.explode=Number(v);updateExplode()}if(key==="time"){state.time=Number(v);if($("time-out"))$("time-out").textContent=state.time.toFixed(1)+" / 30.0 s"}});
document.addEventListener("change",e=>{const key=e.target.dataset.setting;if(!key)return;const v=e.target.value;if(["road","band","weight"].includes(key))configChange(key,v);else if(key==="mount")layoutChange(key,v);else if(key==="enabled")layoutChange(key,v==="启用");else if(["seat","part","rate","reducedMotion"].includes(key)){state[key]=v;if(key==="reducedMotion")applyMotion();renderState()}});
$("annotations").addEventListener("change",e=>$("artboard").classList.toggle("annotated",e.target.checked));
$("drawer").addEventListener("click",e=>{if(e.target===$("drawer"))close()});
Object.entries(P).forEach(([key,p])=>{const b=document.createElement("button");b.className="thumb";b.dataset.action="route";b.dataset.value=key;const img=document.createElement("img");img.src="screens/"+p.file;img.alt=p.title+"设计缩略图";const span=document.createElement("span");span.textContent=p.title;b.append(img,span);$("screen-list").append(b)});
const hash=location.hash.slice(1);if(P[hash])state.page=hash;render();
