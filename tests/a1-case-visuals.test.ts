import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLabConfig } from '../src/shared/lab-contracts';
import type { CaseSnapshot } from '../src/team-a/lab/case-compare';
import { caseVisualsMarkup, configurationDifferences, pairedLevelChart } from '../src/team-a/lab/case-visuals';

function snapshot(runId:string):CaseSnapshot {
  return {runId,config:defaultLabConfig(),windowEndSeconds:16,primarySpl:[60,61,62,63],residualSpl:[57,58,59,60],reductionDb:[3,3,3,3]};
}
test('comparison waits for two distinct experiments and does not invent chart values',()=>{
  for(const [a,b] of [[null,null],[snapshot('a'),null],[snapshot('a'),snapshot('a')]] as const){
    const html=caseVisualsMarkup(a,b);
    assert.match(html,/data-ready="false"/);assert.doesNotMatch(html,/<svg|data-value=/);
  }
});
test('changed control input and exact seat results are shown together, including a worse seat',()=>{
  const a=snapshot('a'),b=snapshot('b');b.config.stepSize=a.config.stepSize/2;
  b.residualSpl=[55,60,59,56];b.reductionDb=[5,1,3,7];
  const html=caseVisualsMarkup(a,b);
  assert.match(html,/1 项输入变化/);assert.match(html,/学习步长 μ/);
  assert.equal((html.match(/data-value=/g)??[]).length,16);
  assert.match(html,/data-effect="better"/);assert.match(html,/data-effect="worse"/);
  assert.match(html,/>\+2\.0 /);assert.match(html,/>-2\.0 /);assert.match(html,/>\+4\.0 /);
  assert.match(html,/左后/);assert.match(html,/右后/);assert.match(html,/dBA · 共用横轴/);
  assert.doesNotMatch(html,/平均降噪量|最优方案/);
});
test('control comparison blocks apparent gains from different speed and never draws deltas',()=>{
  const a=snapshot('a'),b=snapshot('b');b.config.speedKph+=20;b.reductionDb=[14,14,14,14];
  const html=caseVisualsMarkup(a,b,'control');
  assert.match(html,/data-comparable="false"/);assert.match(html,/车速/);
  assert.doesNotMatch(html,/class="cp-chart-link"|class="cp-benefit-panel"/);
  assert.match(html,/data-value="14"/);assert.match(html,/仅并列各自读数/);
});
test('scenario comparison labels its numbers as non-causal ANC gains',()=>{
  const a=snapshot('a'),b=snapshot('b');b.config.speedKph+=20;
  const html=caseVisualsMarkup(a,b,'scenario');
  assert.match(html,/data-comparable="true"/);assert.match(html,/不能视为 ANC 控制方案的净收益/);
  assert.match(html,/两个场景的降噪量差异/);assert.doesNotMatch(html,/候选 B 相对 A 的降噪量变化/);
});
test('multiple changes and identical inputs do not claim single-factor attribution',()=>{
  const a=snapshot('a'),b=snapshot('b');
  assert.match(caseVisualsMarkup(a,b),/重复运行/);
  b.config.stepSize/=2;b.config.speakerEnabled=[true,true,true,false];
  assert.match(caseVisualsMarkup(a,b),/2 项输入变化/);
  assert.match(caseVisualsMarkup(a,b),/不能将结果归因于其中某一项/);
});
test('null, nonfinite and empty readings are missing, never converted to zero',()=>{
  const html=pairedLevelChart([null,NaN,Infinity,-Infinity],[null,null,null,null],'residual');
  assert.equal((html.match(/无读数/g)??[]).length,8);
  assert.doesNotMatch(html,/<circle|NaN|Infinity|undefined/);
  const a=snapshot('a'),b=snapshot('b');b.reductionDb=[3,3,null,3];
  assert.match(caseVisualsMarkup(a,b),/data-effect="missing"/);
  assert.match(caseVisualsMarkup(a,b),/无有效读数/);
});
test('both series use the same coordinate for the same value, including negative reduction',()=>{
  const html=pairedLevelChart([-4,0,4,null],[4,-4,0,8],'reduction');
  const points=[...html.matchAll(/<circle cx="([^"]+)".*?data-series="([ab])" data-value="([^"]+)"/g)];
  assert.equal(points.length,7);
  const coordinate=(series:string,value:string)=>Number(points.find(p=>p[2]===series&&p[3]===value)![1]);
  assert.equal(coordinate('a','-4'),coordinate('b','-4'));
  assert.equal(coordinate('a','0'),coordinate('b','0'));
  assert.ok(coordinate('a','-4')<coordinate('a','0'));
  assert.ok(coordinate('b','8')<=434);
});
test('sensor location, enabled outputs and all physical inputs remain inspectable',()=>{
  const a=snapshot('a'),b=snapshot('b');const [x,y,z]=b.config.references[0].position;b.config.references[0].position=[x+.2,y,z];b.config.speakerEnabled=[true,true,false,true];
  const rows=configurationDifferences(a.config,b.config);
  assert.deepEqual(rows.filter(r=>r.changed).map(r=>r.label),['参考传感器','扬声器']);
  assert.ok(rows.some(r=>r.label==='声源种子'&&!r.changed));
  assert.ok(rows.some(r=>r.label==='采样率'&&r.a==='2000 Hz'));
  assert.match(caseVisualsMarkup(a,b),/左后 禁用/);
});
test('record text is escaped, and rendering never mutates captured configurations',()=>{
  const a=snapshot('a'),b=snapshot('b');b.config.references[0].name='<img src=x onerror="alert(1)">';
  const before=JSON.stringify([a,b]),html=caseVisualsMarkup(a,b);
  assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
  assert.equal(JSON.stringify([a,b]),before);
});
test('unknown vehicle layouts and mismatched time windows cannot acquire benefit graphics',()=>{
  const a=snapshot('a'),b=snapshot('b');b.config.layoutId='unknown-car';b.windowEndSeconds=10;
  const html=caseVisualsMarkup(a,b);
  assert.match(html,/物理布局身份/);assert.match(html,/采样时长/);
  assert.doesNotMatch(html,/class="cp-benefit-panel"/);
});
