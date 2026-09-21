"""Manual activity, calendar, share and multi-reminder integration with an isolated account."""
from playwright.sync_api import sync_playwright,expect
import time,os,struct
base=os.environ.get('FITLENS_WEB_URL','http://localhost:8084')
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base);page.get_by_test_id('start-journey').click();page.get_by_test_id('auth-name').fill('Fitness Tester');page.get_by_test_id('auth-email').fill(f'fitness-{int(time.time())}@example.com');page.get_by_test_id('auth-password').fill('FitLens-test-123!');page.get_by_test_id('auth-submit').click();page.get_by_test_id('goals-submit').click();page.get_by_test_id('goals-submit').click();expect(page.get_by_test_id('dashboard')).to_be_visible()
 page.get_by_role('button',name='Log activity',exact=True).click();expect(page.get_by_label('Activity date',exact=True)).to_have_attribute('type','date');expect(page.get_by_label('Start time',exact=True)).to_have_attribute('type','time');page.get_by_label('Start time',exact=True).fill('17:45');page.get_by_label('Activity name',exact=True).fill('Evening walk');page.get_by_label('Duration · minutes',exact=True).fill('40');page.get_by_label('Active calories · optional',exact=True).fill('180');context.set_offline(True);page.get_by_role('button',name='Save record',exact=True).click();expect(page.get_by_test_id('daily-energy').get_by_text('180',exact=True)).to_be_visible();expect(page.get_by_test_id('daily-energy').get_by_text('Unavailable',exact=True)).to_be_visible()
 context.set_offline(False);page.get_by_test_id('tab-profile').click();page.get_by_role('button',name='Sync now',exact=True).click();page.get_by_test_id('tab-history').click();expect(page.get_by_text('Evening walk',exact=True)).to_be_visible();page.get_by_role('button',name='Edit Evening walk',exact=True).click();page.get_by_label('Duration · minutes',exact=True).fill('45');page.get_by_role('button',name='Save record',exact=True).click();expect(page.get_by_text('45 min · 180 kcal estimate',exact=True)).to_be_visible()
 page.get_by_role('button',name='Log weight',exact=True).click();page.get_by_label('Weight · kg',exact=True).fill('72');page.get_by_role('button',name='Save record',exact=True).click();expect(page.get_by_text('72 kg',exact=False)).to_be_visible()
 page.get_by_role('button',name='Share this month',exact=True).click();page.get_by_role('button',name='Calendar mosaic',exact=True).click()
 with page.expect_download() as info:page.get_by_test_id('download-story').click()
 info.value.save_as('test-results/fitness-month.png');assert struct.unpack('>II',open('test-results/fitness-month.png','rb').read()[16:24])==(1080,1920)
 page.get_by_role('button',name='Year',exact=True).click();page.get_by_role('button',name='Soft cream',exact=True).click()
 with page.expect_download() as info:page.get_by_test_id('download-story').click()
 info.value.save_as('test-results/fitness-year.png');page.get_by_role('button',name='Go home',exact=True).click();page.get_by_test_id('tab-history').click();page.get_by_role('button',name='Year',exact=True).click();page.screenshot(path='test-results/fitness-calendar-year.png',full_page=True)
 page.get_by_test_id('tab-dashboard').click()
 context.route('**/api/v2/chat/status',lambda r:r.fulfill(json={'available':True,'freeOnly':True}))
 drafts=[{'title':name,'body':'Time for your meal','hour':hour,'minute':minute,'cadence':'daily','quietHours':True} for name,hour,minute in [('Breakfast',8,0),('Lunch',13,0),('Dinner',19,30)]]
 context.route('**/api/v2/chat',lambda r:r.fulfill(json={'reply':'Review these three suggested times.','reminders':drafts}))
 page.get_by_test_id('talk-ember').click();page.get_by_test_id('chat-input').fill('Remind me to have all three meals');page.get_by_role('button',name='Send message',exact=True).click();page.get_by_role('button',name='Review all reminders',exact=True).click();expect(page.get_by_label('Title 1',exact=True)).to_have_value('Breakfast');expect(page.get_by_label('Time 2',exact=True)).to_have_value('13:00');expect(page.get_by_label('Time 3',exact=True)).to_have_value('19:30');page.get_by_role('button',name='Confirm & schedule all',exact=True).click();expect(page.get_by_text('Scheduling reminders requires the native phone app.',exact=False)).to_be_visible()
 assert not errors,errors
 print('PASS: workout save/edit, unknown total burn, weight, month/year PNG, calendar, three-meal review and native scheduling boundary')
 browser.close()
