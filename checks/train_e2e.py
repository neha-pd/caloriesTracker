"""Workout onboarding, editing, multilingual library, persistence and offline PWA."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import json,os
base=os.environ.get('FITKIN_WEB_URL','http://localhost:8084')
catalog=json.loads(Path('mobile/src/features/train/data/catalog.json').read_text());hindi=json.loads(Path('mobile/src/features/train/data/hi.json').read_text())
def first_instruction(name):return hindi[next(e['id'] for e in catalog if e['name']==name)][0]
out=Path('test-results/train');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch();context=b.new_context(viewport={'width':430,'height':932});page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/train');page.wait_for_load_state('networkidle')
 expect(page.get_by_text('What would you like to work on?',exact=True)).to_be_visible()
 page.screenshot(path=str(out/'01-onboarding-phone.png'))
 page.get_by_role('button',name='Continue',exact=True).click();page.get_by_role('button',name='Continue',exact=True).click()
 expect(page.get_by_text('Please review the two readiness statements before continuing.')).to_be_visible()
 page.get_by_role('button',name='I’m 18 or older',exact=True).click();page.get_by_role('button',name='I can exercise without restrictions, or have individual clearance',exact=True).click()
 page.get_by_role('button',name='Continue',exact=True).click();page.get_by_role('button',name='Dumbbells',exact=True).click();page.get_by_role('button',name='Continue',exact=True).click();page.get_by_role('button',name='Continue',exact=True).click();page.get_by_role('button',name='Build my workout plan',exact=True).click()
 expect(page.get_by_role('button',name='Start this workout',exact=True)).to_be_visible();page.get_by_role('button',name='Go back',exact=True).scroll_into_view_if_needed();page.screenshot(path=str(out/'02-plan-phone.png'),full_page=True)
 page.get_by_role('button',name='Exercises',exact=True).click();page.get_by_test_id('exercise-search').fill('dumbbell bench press');page.get_by_role('button',name='Open dumbbell bench press',exact=True).click();page.get_by_role('button',name='हिन्दी',exact=True).click()
 expect(page.get_by_text(first_instruction('dumbbell bench press'),exact=True)).to_be_visible();page.screenshot(path=str(out/'03-library-hindi-phone.png'))
 page.get_by_role('button',name='Save exercise',exact=True).click();page.get_by_role('button',name='Add to selected workout',exact=True).click()
 page.get_by_role('button',name='Edit this session',exact=True).click();page.get_by_label('sets 1',exact=True).fill('1');page.get_by_role('button',name='Done editing',exact=True).click()
 page.get_by_role('button',name='Start this workout',exact=True).click();page.get_by_role('button',name='Resume workout',exact=True).click();page.get_by_label('Reps 1.1',exact=True).fill('8');page.get_by_label('Load kg 1.1',exact=True).fill('10');page.get_by_role('button',name='Complete set 1.1',exact=True).click();page.screenshot(path=str(out/'04-session-phone.png'))
 page.reload();expect(page.get_by_text('Timer paused',exact=True)).to_be_visible();expect(page.get_by_role('button',name='Set 1.1 complete · undo',exact=True)).to_be_visible()
 page.get_by_role('button',name='Finish & save workout',exact=True).click();expect(page.get_by_text('80 kg × reps · effort 6/10',exact=True)).to_be_visible();page.screenshot(path=str(out/'05-progress-phone.png'))
 page.get_by_role('button',name='Settings',exact=True).click()
 with page.expect_download() as event:page.get_by_role('button',name='Export calendar reminders',exact=True).click()
 event.value.save_as(str(out/'workouts.ics'));assert 'BYDAY=MO,WE,FR' in (out/'workouts.ics').read_text()
 with page.expect_download() as event:page.get_by_role('button',name='Export my training data',exact=True).click()
 event.value.save_as(str(out/'training.json'));assert len(json.loads((out/'training.json').read_text())['history'])==1
 page.get_by_role('button',name='My plan',exact=True).click();page.set_viewport_size({'width':1440,'height':1000});page.screenshot(path=str(out/'06-plan-desktop.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 # Wait for the complete versioned offline cache, then launch a deep link offline.
 page.evaluate('navigator.serviceWorker.ready');page.reload();page.wait_for_load_state('networkidle');context.set_offline(True);page.goto(base+'/train');expect(page.get_by_role('button',name='Start this workout',exact=True)).to_be_visible()
 page.get_by_role('button',name='Exercises',exact=True).click();page.get_by_test_id('exercise-search').fill('dead bug');page.get_by_role('button',name='Open dead bug',exact=True).click();page.get_by_role('button',name='हिन्दी',exact=True).click();expect(page.get_by_text(first_instruction('dead bug'),exact=True)).to_be_visible()
 assert not errors,errors
 # A separate browser profile must not see the first person's training data.
 other=b.new_context();q=other.new_page();q.goto(base+'/train');expect(q.get_by_text('What would you like to work on?',exact=True)).to_be_visible()
 # Demo account integration exercises the same diary action without a real user's data.
 q.goto(base+'/');q.get_by_test_id('enter-demo').click();expect(q.get_by_test_id('dashboard')).to_be_visible();q.get_by_test_id('open-train').click()
 def click(name):q.get_by_role('button',name=name,exact=True).click()
 click('Continue');click('I’m 18 or older');click('I can exercise without restrictions, or have individual clearance');click('Continue');click('Continue');click('Continue');click('Build my workout plan');click('Start this workout');click('Complete set 1.1');click('Finish & save workout');click('Add to fitness diary');expect(q.get_by_text('Added to fitness diary',exact=True)).to_be_visible()
 rows=q.evaluate('JSON.parse(localStorage.getItem("fitlens:data:fitlens-offline-demo")).fitness');workouts=[x for x in rows if x.get('name','').endswith(' · Train')];assert len(workouts)==1 and workouts[0]['calories'] is None and workouts[0]['minutes']>=1
 q.reload();click('Progress');expect(q.get_by_text('Added to fitness diary',exact=True)).to_be_visible()
 b.close();print('PASS: onboarding readiness, plan editing, catalog/Hindi, set logging, reload resume, volume, exports, offline deep link and device isolation')
