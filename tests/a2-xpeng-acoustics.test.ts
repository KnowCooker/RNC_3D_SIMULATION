import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultXPengConfig, XPENG_LAB_LAYOUTS, labLayout, supportedLabLayoutId } from '../src/shared/lab-contracts';
import { calculateLab, createLabStream, sampleField, decodeRecordedNoise } from '../src/team-b/lab';
import { primaryPath, secondaryPath } from '../src/team-b/lab/paths';
import { cabinViewsForAsset } from '../src/team-a/viewer/driving-state';
import { createXPengModel } from '../src/team-a/viewer/xpeng-model';

const raw=readFileSync(new URL('../src/team-b/lab/data/recorded-primary.f32',import.meta.url));
const recording=decodeRecordedNoise(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
for(const row of XPENG_LAB_LAYOUTS) {
  test(`${row.assetId}: independent layout, full cross paths, both sources and live/batch/field agreement`,()=>{
    const config={...defaultXPengConfig(row.assetId),durationSeconds:1};
    assert.equal(supportedLabLayoutId(config),row.id);
    assert.throws(()=>supportedLabLayoutId({...config,vehicle:row.vehicle==='bev'?'erev':'bev'}));
    const layout=labLayout(config);
    for(const mic of layout.microphones) {
      assert.ok(mic[1]>layout.floor&&mic[1]<layout.roof);
      for(let source=0;source<4;source++) {
        assert.ok(primaryPath(config,source,mic).gains.some(g=>g!==0));
        assert.ok(secondaryPath(config,source,mic).gains.some(g=>g!==0));
      }
    }
    for(const sourceMode of ['shaped-noise','recorded-noise'] as const) {
      const cfg={...config,sourceMode},batch=calculateLab(cfg,'batch',recording),stream=createLabStream(cfg,'stream',40000,recording);
      let start=0;
      for(const n of [173,511,1316]) {
        const chunk=stream.process(n);
        for(const key of ['x','u','d','a','e'] as const)for(let c=0;c<4;c++)assert.deepEqual(chunk.signals[key][c],batch.signals[key][c].slice(start,start+n));
        start+=n;
      }
      const field=sampleField(batch,1,[...layout.microphones]);assert.ok(field.valid);assert.equal(batch.divergence,undefined);
      for(let c=0;c<4;c++)for(const [signal,values] of [['d',field.primarySpl],['e',field.residualSpl]] as const){
        let power=0;for(let i=1000;i<2000;i++)power+=batch.signals[signal][c][i]**2/1000;
        assert.ok(Math.abs(values[c]-10*Math.log10(Math.max(1e-20,power)/(20e-6)**2))<1e-4);
      }
    }
  });
  test(`${row.assetId}: observer seats and acoustic attachment nodes exist in the actual detachable model`,()=>{
    const model=createXPengModel(row.assetId.replace('xpeng-','') as Parameters<typeof createXPengModel>[0]);
    try {
      const views=cabinViewsForAsset(row.assetId);
      for(const view of ['fl','fr','rl','rr',...(row.seatZ.length===3?['tl','tr']:[])] as (keyof typeof views)[])assert.ok(model.group.getObjectByName(views[view].seat),views[view].seat);
      for(const axle of [-1,1])for(const side of [-1,1]) {const wheel=model.group.getObjectByName(`wheel-${axle}-${side}`)!;assert.ok(wheel);assert.ok(wheel.userData.rollingRadius>.3);assert.ok(wheel.userData.rollingCenter.every(Number.isFinite));}
      for(const ref of defaultXPengConfig(row.assetId).references)assert.ok(model.group.getObjectByName(ref.mountPart!));
    } finally {model.dispose();}
  });
}
