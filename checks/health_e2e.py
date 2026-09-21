"""Selected-day energy UI using explicit local fixtures, never real watch data."""
from playwright.sync_api import sync_playwright,expect
import os,time,json,datetime
base=os.environ.get('FITLENS_WEB_URL','http://localhost:8084')
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base);page.get_by_test_id('start-journey').click();page.get_by_test_id('auth-name').fill('Health Test');page.get_by_test_id('auth-email').fill(f'health-{int(time.time())}@example.com');page.get_by_test_id('auth-password').fill('FitLens-test-123!');page.get_by_test_id('auth-submit').click();page.get_by_test_id('goals-submit').click();page.get_by_test_id('goals-submit').click();expect(page.get_by_test_id('dashboard')).to_be_visible()
 today=page.evaluate("new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0')")
 yesterday=(datetime.date.fromisoformat(today)-datetime.timedelta(days=1)).isoformat()
 fixture={'date':today,'steps':7000,'activeCalories':400,'totalCalories':2100,'restingCalories':1700,'exerciseMinutes':45,'workouts':[],'source':'Test fixture','origins':['test'],'readAt':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'),'permissions':{'Steps':'allowed'},'errors':[]}
 page.evaluate("""([day,date,old])=>{const u=JSON.parse(localStorage.getItem('fitlens:profile'));localStorage.setItem('fitlens:health:'+u.id,JSON.stringify({enabled:true,since:day.readAt,permissionVersion:2,days:{[date]:day,[old]:{...day,date:old,activeCalories:null,totalCalories:null,restingCalories:null,exerciseMinutes:null,steps:null}}}));}""",[fixture,today,yesterday])
 page.reload();expect(page.get_by_test_id('daily-energy').get_by_text('2,100 kcal',exact=True)).to_be_visible()
 page.get_by_role('button',name='Previous day',exact=True).click();expect(page.get_by_test_id('daily-energy').get_by_text('Unavailable',exact=True)).to_be_visible()
 expect(page.get_by_test_id('daily-energy').get_by_text('2,100 kcal',exact=True)).to_have_count(0)
 page.get_by_role('button',name='Next day',exact=True).click();expect(page.get_by_test_id('daily-energy').get_by_text('2,100 kcal',exact=True)).to_be_visible()
 page.screenshot(path='test-results/health-day-rings.png',full_page=True)
 page.get_by_role('button',name='Activity & burn details',exact=True).click();page.get_by_label('Daily step goal · optional',exact=True).fill('6000');page.get_by_label('Active kcal goal · optional',exact=True).fill('350');page.get_by_label('Workout minutes goal · optional',exact=True).fill('30');page.get_by_role('button',name='Save movement goals',exact=True).click();expect(page.get_by_text('Movement goals saved.',exact=False)).to_be_visible()
 page.get_by_role('button',name='Go home',exact=True).click();expect(page.get_by_test_id('step-progress').get_by_text('Hooray!',exact=False)).to_be_visible();page.screenshot(path='test-results/step-goal-celebration.png',full_page=True);page.get_by_test_id('talk-ember').click()
 sent=[]
 context.route('**/api/v2/chat/status',lambda r:r.fulfill(json={'available':True,'freeOnly':True}))
 # Status may already have been fetched; retry explicitly if necessary.
 if page.get_by_role('button',name='Retry connection',exact=True).is_visible():page.get_by_role('button',name='Retry connection',exact=True).click()
 page.get_by_role('button',name='Close chat',exact=True).click();page.get_by_test_id('talk-ember').click()
 def answer(r):sent.append(r.request.post_data_json);r.fulfill(json={'reply':'Your device recorded 2100 total kcal, including 400 active kcal.','reminder':None})
 context.route('**/api/v2/chat',answer)
 page.get_by_role('switch',name='Share diary with coach').click();page.get_by_test_id('chat-input').fill('How much did I burn?');page.get_by_role('button',name='Send message',exact=True).click();expect(page.get_by_text('Your device recorded 2100 total kcal, including 400 active kcal.',exact=True)).to_be_visible()
 assert sent[0]['activity']['totalCalories']==2100 and sent[0]['activity']['date']==today
 page.get_by_role('button',name='Close chat',exact=True).click();page.get_by_test_id('tab-profile').click();page.get_by_test_id('logout').click();page.get_by_test_id('logout-confirm').click();page.get_by_test_id('enter-demo').click();expect(page.get_by_test_id('dashboard')).to_be_visible();expect(page.get_by_test_id('daily-energy').get_by_text('2,100 kcal',exact=True)).to_have_count(0)
 assert not errors,errors
 print('PASS: selected-day rings, unknown vs zero, saved goals, opt-in coach activity context, logout isolation')
 browser.close()
