from pathlib import Path
import subprocess,os,json
root=Path.cwd();out=root/'test-results/environment-refine';node_dir=root/'test-results/a2-tools/node-v22.14.0-win-x64';env=os.environ.copy();env['PATH']=str(node_dir)+';'+env['PATH'];pnpm=str(node_dir/'pnpm.cmd')
a=sorted(str(p.relative_to(root)) for p in (root/'tests').glob('a*.test.ts') if p.name!='analysis.test.ts')+['tests/player.test.ts']
commands=[('test-a',[pnpm,'exec','tsx','--test',*a]),('typecheck',[pnpm,'typecheck']),('boundaries',[pnpm,'check:boundaries']),('check',[pnpm,'check']),('build',[pnpm,'build'])]
results=[]
for name,cmd in commands:
 print(name+': running',flush=True)
 with (out/(name+'.log')).open('wb') as f:r=subprocess.run(cmd,env=env,stdout=f,stderr=subprocess.STDOUT)
 results.append({'command':name,'exit':r.returncode});print(name+': exit '+str(r.returncode),flush=True)
(out/'checks.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
