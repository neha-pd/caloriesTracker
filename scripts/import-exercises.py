"""Import a pinned local checkout's MIT text only; never copy media or media URLs."""
import json,sys,hashlib,subprocess
from pathlib import Path
source=Path(sys.argv[1]);out=Path('mobile/src/features/train/data');out.mkdir(parents=True,exist_ok=True)
raw=(source/'data/exercises.json').read_bytes();data=json.loads(raw)
assert len(data)==1324 and len({x['id'] for x in data})==1324
keys=['id','name','category','equipment','target','secondary_muscles']
(out/'catalog.json').write_text(json.dumps([{k:x[k] for k in keys} for x in data],ensure_ascii=False,separators=(',',':')))
langs=sorted(data[0]['instruction_steps'])
for lang in langs:
 steps={x['id']:x['instruction_steps'].get(lang) or x['instruction_steps']['en'] for x in data}
 assert all(isinstance(v,list) and v and all(isinstance(s,str) for s in v) for v in steps.values())
 (out/f'{lang}.json').write_text(json.dumps(steps,ensure_ascii=False,separators=(',',':')))
(out/'LICENSE.txt').write_text((source/'LICENSE').read_text())
(out/'source.json').write_text(json.dumps({'repository':'https://github.com/hasaneyldrm/exercises-dataset','commit':subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip(),'sha256':hashlib.sha256(raw).hexdigest(),'count':len(data),'languages':langs,'mediaIncluded':False},indent=2))
print('Imported',len(data),'exercises;',len(langs),'languages; no media.')
