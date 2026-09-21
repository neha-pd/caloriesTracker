"""Chat UI contract with an isolated local account and mocked free-provider replies."""
from playwright.sync_api import sync_playwright,expect
import os,time,json
base=os.environ.get('FITLENS_WEB_URL','http://localhost:8084')
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page();errors=[];sent=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base);page.get_by_test_id('start-journey').click()
 page.get_by_test_id('auth-name').fill('Chat UI Tester');page.get_by_test_id('auth-email').fill(f'chat-ui-{int(time.time())}@example.com');page.get_by_test_id('auth-password').fill('FitLens-test-123!');page.get_by_test_id('auth-submit').click();page.get_by_test_id('goals-submit').click();page.get_by_test_id('goals-submit').click()
 expect(page.get_by_test_id('dashboard')).to_be_visible()
 context.route('**/api/v2/chat/status',lambda r:r.fulfill(json={'available':True,'freeOnly':True}))
 def answer(route):
  sent.append(route.request.post_data_json)
  route.fulfill(json={'reply':'I prepared a draft. Review it before scheduling.','reminder':{'title':'Water break','body':'A gentle sip','hour':9,'minute':30,'cadence':'weekdays','quietHours':True,'intervalHours':2}})
 context.route('**/api/v2/chat',answer)
 page.get_by_test_id('talk-ember').click();page.get_by_role('switch',name='Share diary with coach').click()
 page.get_by_test_id('chat-input').fill('Remind me to drink water every 2 hours on weekdays')
 page.get_by_role('button',name='Send message',exact=True).click()
 expect(page.get_by_role('button',name='Review reminder',exact=True)).to_be_visible()
 assert sent[0]['includeDiary'] is True
 assert len(sent[0]['messages'])==1
 page.screenshot(path='test-results/chat-reminder-draft.png',full_page=True)
 page.get_by_role('button',name='Review reminder',exact=True).click()
 expect(page.get_by_test_id('reminder-title')).to_have_value('Water break')
 expect(page.get_by_test_id('reminder-body')).to_have_value('A gentle sip')
 expect(page.get_by_test_id('reminder-interval')).to_have_value('2')
 expect(page.get_by_test_id('reminder-save')).to_be_enabled()
 page.get_by_role('button',name='Go back',exact=True).click()
 expect(page.get_by_test_id('chat-input')).to_be_visible()
 page.get_by_role('button',name='Clear conversation',exact=True).click()
 expect(page.get_by_text('A little support for your day.',exact=True)).to_be_visible()
 context.unroute('**/api/v2/chat',answer)
 context.route('**/api/v2/chat',lambda r:r.fulfill(status=429,json={'error':'The shared free AI quota is busy or exhausted. Please try later; manual reminders still work.'}))
 page.get_by_test_id('chat-input').fill('Help me with dinner');page.get_by_role('button',name='Send message',exact=True).click()
 expect(page.get_by_text('The shared free AI quota is busy or exhausted.',exact=False)).to_be_visible()
 expect(page.get_by_test_id('chat-input')).to_have_value('Help me with dinner')
 page.get_by_role('button',name='Close chat',exact=True).click();expect(page.get_by_test_id('dashboard')).to_be_visible()
 assert not errors,errors
 print('PASS: chat context opt-in → reminder draft → editable schedule → clear → quota error preserves input → close; no runtime errors')
 browser.close()
