"""Calendar/clock controls and smart-nudge settings preview, with no notification side effects."""
from playwright.sync_api import sync_playwright,expect
import os,datetime
base=os.environ.get('FITLENS_WEB_URL','http://localhost:8084')
with sync_playwright() as p:
 b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844});page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base);page.get_by_test_id('enter-demo').click();expect(page.get_by_test_id('dashboard')).to_be_visible()
 date=page.get_by_label('Choose diary date',exact=True);expect(date).to_have_attribute('type','date');date.fill('2024-02-29');expect(date).to_have_value('2024-02-29')
 page.get_by_test_id('tab-history').click();expect(page.get_by_label('Jump to date',exact=True)).to_have_value('2024-02-29');page.get_by_label('Jump to date',exact=True).fill('2024-03-12');expect(page.get_by_text('March 2024',exact=True)).to_be_visible()
 page.get_by_test_id('tab-profile').click();page.get_by_role('button',name='Preferences & reminders',exact=True).click();page.get_by_role('button',name='Gentle reminders',exact=True).click();page.get_by_role('button',name='Personalize Ember nudges',exact=True).click()
 for label in ['Breakfast time','Lunch time','Dinner time','Quiet hours start','Quiet hours end']:expect(page.get_by_label(label,exact=True)).to_have_attribute('type','time')
 page.get_by_label('Breakfast time',exact=True).fill('09:15');expect(page.get_by_label('Breakfast time',exact=True)).to_have_value('09:15')
 page.get_by_role('switch',name='Nudge me about watch workouts',exact=True).click();page.get_by_role('switch',name='Celebrate step milestones',exact=True).click();page.get_by_role('button',name='Two',exact=True).click()
 expect(page.get_by_text('Smart background nudges are available in the Android APK.',exact=False)).to_be_visible()
 page.screenshot(path='test-results/smart-nudges-web-preview.png',full_page=True)
 page.get_by_role('button',name='Save smart nudges',exact=True).click();expect(page.get_by_text('Sign in to enable personal nudges.',exact=True)).to_be_visible()
 assert not errors,errors
 print('PASS: leap-day picker, calendar date jump, five clock controls, notification preference preview and demo boundary')
 b.close()
