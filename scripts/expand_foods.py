"""Import official USDA archives without changing existing FNDDS identifiers.
Usage: python3 scripts/expand_foods.py .data/food-import
Sources and methodology: docs/FOOD_CATALOG.md. All nutrition is per 100 g.
"""
import json,zipfile,sys,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]; folder=Path(sys.argv[1]); out=[]
for filename,kind,source in [('sr.zip','SRLegacyFoods','USDA SR Legacy · April 2018'),('foundation.zip','FoundationFoods','USDA Foundation · April 2026')]:
 with zipfile.ZipFile(folder/filename) as z:
  items=json.loads(z.read(next(n for n in z.namelist() if n.endswith('.json'))))[kind]
 for f in items:
  if not isinstance(f,dict):continue
  n={int(v['nutrient']['id']):v.get('amount') for v in f.get('foodNutrients',[])}
  energy=next((n[k] for k in [1008,2048,2047] if n.get(k) is not None),None)
  values=[energy,n.get(1003),n.get(1005),n.get(1004)]
  if any(v is None or not math.isfinite(v) or v<0 for v in values):continue
  if energy>1000 or any(v>100 for v in values[1:]):continue
  portions=[]
  for p in f.get('foodPortions',[]):
   g=p.get('gramWeight',0);desc=p.get('portionDescription')
   if not desc:
    unit=p.get('measureUnit',{}).get('name','');desc=' '.join(str(v) for v in [p.get('amount',1),unit,p.get('modifier','')] if v and v!='undetermined')
   if g>0 and desc and 'not specified' not in desc.lower():portions.append({'label':desc,'grams':g})
  out.append(dict(id=str(f['fdcId']),name=f['description'],serving_qty=100,serving_unit='g',calories=energy,protein_g=values[1],carbs_g=values[2],fat_g=values[3],fiber_g=n.get(1079),source=source,portions=portions[:5]))
(root/'mobile/src/data/foods-global.json').write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False))
print('Added USDA records:',len(out))
