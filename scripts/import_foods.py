"""Build a compact offline catalog from the official USDA FNDDS 2021–2023 JSON archive.
Usage: python3 scripts/import_foods.py /path/to/FoodData_Central_survey_food_json_2024-10-31.zip
Source: https://fdc.nal.usda.gov/download-datasets/ — values per 100 g.
"""
import json,sys,zipfile
from pathlib import Path
z=zipfile.ZipFile(sys.argv[1]);data=json.loads(z.read(next(n for n in z.namelist() if n.endswith('.json'))))['SurveyFoods'];out=[]
for f in data:
 n={int(v['nutrient']['id']):v.get('amount') for v in f.get('foodNutrients',[])}
 if any(n.get(k) is None for k in [1008,1003,1004,1005]):continue
 portions=[{'label':p['portionDescription'],'grams':p['gramWeight']} for p in f.get('foodPortions',[]) if p.get('gramWeight',0)>0 and 'not specified' not in p.get('portionDescription','').lower()]
 out.append({'id':str(f['fdcId']),'name':f['description'],'serving_qty':100,'serving_unit':'g','calories':n[1008],'protein_g':n[1003],'carbs_g':n[1005],'fat_g':n[1004],'fiber_g':n.get(1079),'source':'USDA FNDDS 2021–2023','portions':portions[:5]})
Path('mobile/src/data/foods.json').write_text(json.dumps(out,separators=(',',':')))
print(f'Imported {len(out)} foods with complete energy/macronutrient data.')
