"""Activity screen hierarchy: daily use is separate from watch setup and troubleshooting."""
from playwright.sync_api import sync_playwright,expect
import os,json,datetime
with sync_playwright() as p:
 b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844});page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('FITLENS_WEB_URL','http://localhost:8084'));page.get_by_test_id('enter-demo').click();expect(page.get_by_test_id('dashboard')).to_be_visible()
 page.get_by_role('button',name='Log activity',exact=True).click()
 expect(page.get_by_text('Was this captured by your watch?',exact=True)).to_have_count(0)
 expect(page.get_by_role('button',name='Adjust calorie counting',exact=True)).to_have_count(0)
 page.screenshot(path='test-results/simple-manual-activity.png',full_page=True)
 page.get_by_role('button',name='Go home',exact=True).click()
 today=page.evaluate("new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0')")
 day={'date':today,'steps':1372,'activeCalories':None,'totalCalories':1800,'restingCalories':None,'exerciseMinutes':None,'workouts':[],'source':'Fixture','origins':['fixture'],'readAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'permissions':{'Steps':'allowed','ActiveCaloriesBurned':'no records','ExerciseSession':'no records'},'errors':[]}
 page.evaluate("""d=>{localStorage.setItem('fitlens:health:fitlens-offline-demo',JSON.stringify({enabled:true,permissionVersion:2,days:{[d.date]:d}}));}""",day)
 page.reload();expect(page.get_by_test_id('dashboard')).to_be_visible();page.get_by_role('button',name='Activity & burn details',exact=True).click()
 expect(page.get_by_text('Your activity',exact=True)).to_be_visible();expect(page.get_by_text('1,372 steps',exact=True).last).to_be_visible()
 for name in ['Review permissions','Import activity','Sync now','Disconnect watch']:expect(page.get_by_role('button',name=name,exact=True)).to_have_count(0)
 expect(page.get_by_label('Daily step goal · optional',exact=True)).to_have_count(0)
 page.screenshot(path='test-results/simple-activity-summary.png',full_page=True)
 page.get_by_role('button',name='Watch settings',exact=True).click();expect(page.get_by_role('button',name='Import activity',exact=True)).to_have_count(0)
 page.get_by_role('button',name='Bring in past activity',exact=True).click();expect(page.get_by_role('button',name='Import activity',exact=True)).to_be_visible();page.get_by_role('button',name='Bring in past activity',exact=True).click();expect(page.get_by_role('button',name='Import activity',exact=True)).to_have_count(0)
 page.get_by_role('button',name='Connection help',exact=True).click();expect(page.get_by_text('Movement calories: No readings for this day',exact=True)).to_be_visible()
 expect(page.get_by_text('ActiveCaloriesBurned',exact=False)).to_have_count(0)
 page.get_by_role('button',name='Connection help',exact=True).click();page.screenshot(path='test-results/simple-watch-settings.png',full_page=True)
 page.get_by_role('button',name='Go back',exact=True).click();page.get_by_role('button',name='Edit goals',exact=True).click();expect(page.get_by_label('Daily step goal · optional',exact=True)).to_be_visible()
 assert not errors,errors
 print('PASS: plain manual entry, uncluttered activity summary, separate goals, collapsed imports and friendly watch diagnostics')
 b.close()
