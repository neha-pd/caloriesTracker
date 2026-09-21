"""Run against the local API on :3000 and exported web preview on :8084."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import time,json,os
web_url=os.environ.get("FITLENS_WEB_URL","http://localhost:8084").rstrip("/")
api_url=os.environ.get("FITLENS_API_URL","http://localhost:3000").rstrip("/")
out=Path('test-results');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 email=f'e2e-{int(time.time())}@example.com';password='FitLens-test-123!'
 def click(name):page.get_by_role('button',name=name,exact=True).click()
 def screenshot(name):page.screenshot(path=str(out/(name+'.png')),full_page=True)
 def api(path,method='GET',data=None):
  token=page.evaluate('sessionStorage.getItem("access_token")')
  r=context.request.fetch(api_url+path,method=method,headers={'Authorization':'Bearer '+token},data=data)
  assert r.ok,(path,r.status,r.text())
  return r.json()
 def wait_synced():
  page.wait_for_function('''() => {const k=Object.keys(localStorage).find(k=>k.includes('fitlens:data:'));return k && JSON.parse(localStorage.getItem(k)).queue.length===0;}''',timeout=20000)
 try:
  page.goto(web_url);page.wait_for_load_state('networkidle')
  page.get_by_test_id('start-journey').click()
  page.get_by_test_id('auth-name').fill('Neha Test');page.get_by_test_id('auth-email').fill(email);page.get_by_test_id('auth-password').fill(password)
  page.get_by_test_id('auth-submit').click();page.get_by_test_id('goals-submit').click();page.get_by_test_id('goal-calories').fill('2100');page.get_by_test_id('goals-submit').click()
  expect(page.get_by_test_id('dashboard')).to_be_visible();screenshot('01-dashboard-empty')
  page.get_by_test_id('tab-add').click();page.get_by_role('button',name='Add food',exact=True).click();page.get_by_test_id('food-search').fill('banana')
  page.get_by_text('Banana, raw',exact=True).click();page.get_by_test_id('food-quantity').fill('1.5');page.get_by_test_id('food-confirm').click()
  expect(page.get_by_text('Your food story.',exact=True)).to_be_visible();wait_synced()
  entries=api('/api/v2/changes')['entries'];assert len(entries)==1;entry=entries[0];assert entry['quantity']==1.5;assert api('/api/v2/progress')['xp']==35
  page.get_by_role('button',name='Banana, raw',exact=True).click();page.get_by_test_id('entry-quantity').fill('2');page.get_by_test_id('entry-save').click();wait_synced();assert api('/api/v2/changes')['entries'][0]['quantity']==2;assert api('/api/v2/progress')['xp']==35;screenshot('02-diary')
  click('Go home');page.get_by_test_id('tab-profile').click();click('Sync now');wait_synced()
  page.goto(web_url+'/water');page.wait_for_load_state('networkidle');page.get_by_test_id('water-250').click();wait_synced();assert len(api('/api/v2/changes')['water'])==1;screenshot('03-water')
  context.set_offline(True);page.get_by_test_id('water-500').click();expect(page.get_by_text('750',exact=False).first).to_be_visible();context.set_offline(False)
  click('Go home');page.get_by_test_id('tab-profile').click();click('Sync now');wait_synced();assert sum(w['amount_ml'] for w in api('/api/v2/changes')['water'] if not w['deleted_at'])==750
  page.get_by_test_id('tab-quests').click();page.get_by_test_id('quest-checkin').click();wait_synced();xp=api('/api/v2/progress')['xp'];page.get_by_test_id('quest-checkin').click();wait_synced();assert api('/api/v2/progress')['xp']==xp;screenshot('04-quests')
  page.get_by_test_id('tab-history').click();screenshot('05-progress')
  page.get_by_test_id('tab-dashboard').click();page.get_by_test_id('share-day').click()
  expect(page.get_by_test_id('share-card')).to_be_visible()
  with page.expect_download() as info:page.get_by_test_id('download-story').click()
  info.value.save_as(out/'daily-story-midnight.png')
  import struct
  png=(out/'daily-story-midnight.png').read_bytes()
  assert png[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',png[16:24])==(1080,1920)
  click('Soft cream');page.get_by_role('switch',name='Include calories and macros').click()
  expect(page.get_by_test_id('share-card').get_by_text('FOOD LOGGED',exact=True)).to_be_visible()
  with page.expect_download() as info:page.get_by_test_id('download-story').click()
  info.value.save_as(out/'daily-story-cream.png')
  screenshot('07-share-preview');click('Go home')

  page.get_by_test_id('tab-profile').click();click('My profile');page.get_by_test_id('profile-name').fill('Neha Spark');page.get_by_test_id('profile-weight').fill('72');page.get_by_test_id('profile-target-weight').fill('68');page.get_by_test_id('profile-save').click();expect(page.get_by_text('Neha Spark',exact=True)).to_be_visible()
  click('Health & watch sync');expect(page.get_by_text('Apple Health + Health Connect',exact=True)).to_be_visible();screenshot('06-health');click('Go back')
  click('How to use FitLens');expect(page.get_by_text('Start with what you ate.',exact=True)).to_be_visible();click('Skip guide');page.get_by_test_id('tab-profile').click()
  page.get_by_test_id('logout').click();page.get_by_test_id('logout-confirm').click();expect(page.get_by_test_id('start-journey')).to_be_visible()
  click('I already have an account');page.get_by_test_id('auth-email').fill(email);page.get_by_test_id('auth-password').fill(password);page.get_by_test_id('auth-submit').click();expect(page.get_by_test_id('dashboard')).to_be_visible();wait_synced();assert len(api('/api/v2/changes')['entries'])==1
  page.get_by_test_id('tab-add').click();page.get_by_role('button',name='Add food',exact=True).click();click('Create a custom food');page.get_by_test_id('custom-name').fill('Homemade test bowl')
  for key,val in [('calories','320'),('protein','20'),('carbs','40'),('fat','10')]:page.get_by_test_id('custom-'+key).fill(val)
  page.get_by_test_id('custom-save').click();page.get_by_test_id('food-confirm').click();wait_synced();assert len(api('/api/v2/changes')['entries'])==2
  click('Go home');page.get_by_test_id('home-connect-device').click();expect(page.get_by_text('Apple Health + Health Connect',exact=True)).to_be_visible();click('Go home');page.get_by_test_id('talk-ember').click()
  expect(page.get_by_test_id('chat-input')).to_be_visible()
  expect(page.get_by_role('button',name='Send message',exact=True)).to_be_disabled()
  click('Create reminder manually')
  page.get_by_test_id('reminder-time').fill('23:00');page.get_by_test_id('reminder-save').click()
  expect(page.get_by_text('Quiet hours are 22:00–08:00.',exact=False)).to_be_visible()
  page.get_by_test_id('reminder-time').fill('15:00');page.get_by_test_id('reminder-save').click()
  expect(page.get_by_text('Scheduling reminders requires the native phone app.',exact=False)).to_be_visible()
  page.get_by_test_id('reminder-request').fill('Drink water at regular intervals in 24hrs')
  expect(page.get_by_test_id('reminder-save')).to_be_disabled()
  page.get_by_test_id('reminder-draft').click()
  expect(page.get_by_test_id('reminder-title')).to_have_value('Water break')
  expect(page.get_by_test_id('reminder-interval')).to_have_value('2')
  expect(page.get_by_test_id('reminder-times')).to_have_text('08:00 · 10:00 · 12:00 · 14:00 · 16:00 · 18:00 · 20:00')
  expect(page.get_by_test_id('reminder-save')).to_be_enabled()
  page.get_by_test_id('reminder-request').fill('water at some time')
  page.get_by_test_id('reminder-draft').click()
  expect(page.get_by_test_id('reminder-save')).to_be_disabled()
  click('Use manual fields instead')
  expect(page.get_by_test_id('reminder-save')).to_be_enabled()
  page.screenshot(path=str(out/'reminder-intervals.png'),full_page=True)
  click('Go home');page.get_by_test_id('share-day').click();click('Coach report')
  report=page.get_by_test_id('share-card')
  expect(report.get_by_text('Homemade test bowl',exact=True)).to_be_visible()
  expect(report.get_by_text('Banana, raw',exact=True)).to_be_visible()
  expect(report.get_by_text('4 kg above your chosen target.',exact=True)).to_be_visible()
  expect(report.get_by_text('Active calories: not available',exact=True)).to_be_visible()
  with page.expect_download() as info:page.get_by_test_id('download-story').click()
  info.value.save_as(out/'daily-coach-report.png')
  png=(out/'daily-coach-report.png').read_bytes();w,h=struct.unpack('>II',png[16:24]);assert w==1080 and h>=2160
  page.goto(web_url+'/diary');page.wait_for_load_state('networkidle')
  page.get_by_role('button',name='Homemade test bowl',exact=True).click();page.get_by_test_id('entry-delete').click();page.get_by_test_id('entry-delete-confirm').click();wait_synced();assert len([e for e in api('/api/v2/changes')['entries'] if not e['deleted_at']])==1
  page.goto(web_url+'/privacy');page.wait_for_load_state('networkidle')
  with page.expect_download() as info:click('Export my data')
  download=info.value;download.save_as(out/'account-export.json');assert json.loads((out/'account-export.json').read_text())['user']['display_name']=='Neha Spark'
  click('Delete my account');page.get_by_label('Confirm your password',exact=True).fill(password);click('Delete account permanently');expect(page.get_by_test_id('start-journey')).to_be_visible()
  assert not errors,errors
  print('PASS: signup → onboarding → search/log/edit → water/offline sync → quests → history → profile → native fallbacks → logout/login → custom food/delete → daily coach → reminder validation → complete coach report PNG → export → account deletion; no browser runtime errors.')
 except Exception:
  screenshot('failure');print(page.locator('body').inner_text());print('Runtime errors:',errors);raise
 finally:browser.close()
