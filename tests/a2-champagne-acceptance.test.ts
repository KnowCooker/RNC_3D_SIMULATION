import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultXPengConfig } from '../src/shared/lab-contracts';
import { compareCases, type CaseSnapshot } from '../src/team-a/lab/case-compare';
import { createCaseEvidence, parseCaseEvidence } from '../src/team-a/lab/case-evidence';
import { reviewCase } from '../src/team-a/lab/case-review';
const snapshot=(runId:string):CaseSnapshot=>({runId,config:{...defaultXPengConfig('xpeng-x9'),durationSeconds:10},windowEndSeconds:10,primarySpl:[60,61,62,63],residualSpl:[55,56,57,58],reductionDb:[5,5,5,5]});
test('CP controlled comparison blocks road/source/seed/operating changes; scenario states differences',()=>{
 const a=snapshot('A'),b=snapshot('B');b.config.roadRoughness=2.2;b.config.speedKph=80;b.config.seed=12;
 const control=compareCases(a,b,'control');assert.equal(control.comparable,false);assert.deepEqual(new Set(control.conditions),new Set(['路面粗糙度','声源种子','车速']));assert.deepEqual(control.residualDeltaDb,[null,null,null,null]);
 const scenario=compareCases(a,b,'scenario');assert.equal(scenario.comparable,true);assert.equal(scenario.changes.length,3);assert.ok(reviewCase(a,b,'scenario').limits.some(s=>s.includes('不能解释为 ANC')));
});
test('CP declared controller changes retain negative outcomes and do not change input snapshots',()=>{
 const a=snapshot('A'),b=snapshot('B');b.config.stepSize=.1;b.residualSpl=[54,58,57,60];const before=JSON.stringify([a,b]);
 const comparison=compareCases(a,b,'control');assert.equal(comparison.comparable,true);assert.deepEqual(comparison.residualDeltaDb,[-1,2,0,2]);assert.equal(JSON.stringify([a,b]),before);
});
test('CP scenario cannot cross layout or absolute analysis window',()=>{
 const a=snapshot('A'),b=snapshot('B');b.config= {...defaultXPengConfig('xpeng-p7plus'),durationSeconds:10};b.windowEndSeconds=9;
 const comparison=compareCases(a,b,'scenario');assert.equal(comparison.comparable,false);assert.ok(comparison.conditions.includes('物理布局身份'));assert.ok(comparison.conditions.includes('采样时长/末尾时间窗'));assert.deepEqual(comparison.primaryDeltaDb,[null,null,null,null]);
});
test('CP mode survives summary roundtrip; old summaries retain historical comparison meaning',()=>{
 const a=snapshot('A'),b=snapshot('B');b.config.roadRoughness=2.2;
 const serialized=createCaseEvidence(a,b,'','','2026-10-02T00:00:00Z','','','control');assert.equal(parseCaseEvidence(serialized).comparison.comparable,false);
 const old=JSON.parse(serialized);delete old.comparisonMode;assert.equal(parseCaseEvidence(JSON.stringify(old)).comparison.mode,'legacy');assert.equal(parseCaseEvidence(JSON.stringify(old)).comparison.comparable,true);
 for(const invalid of ['unknown',['control'],{}]){old.comparisonMode=invalid;assert.throws(()=>parseCaseEvidence(JSON.stringify(old)),/比较模式/);}
});
test('CP nonfinite external readings never become displayed delta',()=>{
 const a=snapshot('A'),b=snapshot('B');b.residualSpl=[55,Infinity,57,58];assert.equal(compareCases(a,b,'control').residualDeltaDb[1],null);
});
