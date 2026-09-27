import { writeFileSync } from 'node:fs';
import { defaultLabConfig, labDurationLimit } from '../../../../src/shared/lab-contracts';
import { calculateLab, analyzeLab } from '../../../../src/team-b/lab';
import { prepareLabPlayback, resampleForAudio } from '../../../../src/team-a/player';
const config=defaultLabConfig(); config.durationSeconds=labDurationLimit(config);
const run=calculateLab(config,'B1-ANALYSIS-001-budget');
const start=performance.now();
for(let frame=5;frame<=config.durationSeconds*10;frame++) for(const levelWeighting of ['A','Z'] as const) analyzeLab(run,frame/10,{signal:'e',channel:0},{levelWeighting,levelsOnly:true});
const analysisMilliseconds=performance.now()-start;
const audioStart=performance.now(), audio=prepareLabPlayback(run);
const pcm=resampleForAudio(audio.result.signals.e[0]);
const report={role:'B1',executor:'Codex',task:'B1-ANALYSIS-001',node:process.version,date:'2026-09-25',
 durationSeconds:config.durationSeconds,computeMilliseconds:run.computeMilliseconds,analysisMilliseconds,oneChannelAudioMilliseconds:performance.now()-audioStart,
 pcmSamples:pcm.length,allFinite:Object.values(run.signals).every(chs=>chs.every(ch=>ch.every(Number.isFinite))),
 limits:[1,4,8].map(refs=>({refs,seconds:labDurationLimit({...config,references:Array.from({length:refs},(_,i)=>config.references[i%4])})})),
 processMemory:process.memoryUsage(),notes:'Node snapshot, not browser/GPU peak; duration budget is conservative, not a RAM/device benchmark. Eight cached PCM buffers are included in budget formula.'};
writeFileSync(new URL('./benchmark.json',import.meta.url),JSON.stringify(report,null,2)); console.log(report);
