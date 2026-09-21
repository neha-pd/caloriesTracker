"""Build transparent home-style recipe estimates from USDA ingredient records.
Original recipes are assumptions, not lab measurements or copied restaurant recipes.
Recipe grams are ingredient input weights; yield_g is the assumed cooked batch weight.
"""
import json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
foods={f['id']:f for path in ['foods.json','foods-global.json'] for f in json.loads((root/'mobile/src/data'/path).read_text())}
spec=json.loads((root/'data/food-recipes/indian.json').read_text());out=[]
for r in spec['recipes']:
 totals={k:0 for k in ['calories','protein_g','carbs_g','fat_g','fiber_g']};ingredients=[]
 for key,g in r['ingredients'].items():
  assert g>0
  if key=='water':ingredients.append({'name':'Water','grams':g});continue
  ref=spec['ingredients'][key];f=foods[ref['id']]
  ingredients.append({'name':ref.get('label',f['name']),'grams':g,'food_id':f['id']})
  for k in totals:
   if f.get(k) is None:totals[k]=None
   elif totals[k] is not None:totals[k]+=f[k]*g/100
 assert r['yield_g']>0
 row={'id':'in-recipe-'+r['slug'],'name':r['name'],'aliases':r.get('aliases',[]),'indian':True,'region':r['region'],'category':r['category'],'serving_qty':100,'serving_unit':'g','source':'FitLens home-style recipe estimate · USDA ingredients','estimated':True,'portions':[{'label':r.get('portion_label','1 small katori (approx.)'),'grams':r.get('portion_g',150)}], 'recipe':{'yield_g':r['yield_g'],'ingredients':ingredients,'note':r.get('note','Assumed home-style recipe and cooked yield. Oil, water and preparation change nutrition; adjust your portion to match your meal.')}}
 row.update({k:round(v*100/r['yield_g'],2) if v is not None else None for k,v in totals.items()})
 assert row['calories']<=1000 and all(0<=row[k]<=100 for k in ['protein_g','carbs_g','fat_g'])
 out.append(row)
assert len({f['id'] for f in out})==len(out)
(root/'mobile/src/data/foods-india.json').write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False))
print('Indian recipe estimates:',len(out))
