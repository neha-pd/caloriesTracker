"""Offline demo flows; native inference and widgets require the Android build."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json
out=Path('test-results');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch()
 context=browser.new_context(viewport={'width':390,'height':844})
 page=context.new_page();errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:requests.append(r.url) if '/api/' in r.url else None)
 page.goto('http://localhost:8084');page.wait_for_load_state('networkidle')
 # Keep the web asset server reachable; block all backend traffic. Native assets are bundled.
 context.route('**/api/**',lambda route:route.abort('internetdisconnected'))
 page.get_by_test_id('enter-demo').click()
 expect(page.get_by_test_id('dashboard')).to_be_visible()
 expect(page.get_by_text('DEMO · 45 days of fictional sample data, stored only on this device.',exact=True)).to_be_visible()
 data=page.evaluate('JSON.parse(localStorage.getItem("fitlens:data:fitlens-offline-demo"))')
 assert len(data['entries'])==256,len(data['entries'])
 assert len(set(e['log_date'] for e in data['entries']))==43
 assert len(data['water'])>300
 page.screenshot(path=str(out/'demo-dashboard.png'),full_page=True)
 page.get_by_test_id('tab-add').click();page.get_by_test_id('food-search').fill('poha')
 page.get_by_text('Kanda poha',exact=True).click()
 page.get_by_test_id('food-confirm').click()
 after=page.evaluate('JSON.parse(localStorage.getItem("fitlens:data:fitlens-offline-demo"))')
 assert after['progress']['xp']>data['progress']['xp']
 page.get_by_role('button',name='Go home',exact=True).click()
 page.get_by_test_id('talk-ember').click()
 expect(page.get_by_text('This is an offline demo. Sign in to a real account to use online chat.',exact=True)).to_be_visible()
 expect(page.get_by_test_id('chat-input')).to_be_visible()
 expect(page.get_by_role('button',name='Send message',exact=True)).to_be_disabled()
 page.screenshot(path=str(out/'demo-chat.png'),full_page=True)
 page.get_by_role('button',name='Close chat',exact=True).click()
 page.get_by_test_id('tab-profile').click()
 expect(page.get_by_text('Offline demo',exact=True)).to_be_visible()
 page.get_by_role('button',name='Home-screen widgets',exact=True).click()
 for name in ['widget-today','widget-water','widget-coach']:expect(page.get_by_test_id(name)).to_be_visible()
 page.get_by_role('button',name='Soft cream',exact=True).click()
 page.get_by_role('switch',name='Show widget nutrition').click()
 page.get_by_test_id('widget-today').click()
 expect(page.get_by_text('Android home-screen widgets are included in the APK.',exact=False)).to_be_visible()
 page.screenshot(path=str(out/'demo-widgets.png'),full_page=True)
 page.get_by_role('button',name='Go back',exact=True).click()
 page.get_by_role('button',name='My profile',exact=True).click()
 page.get_by_test_id('profile-name').fill('Demo Tester')
 page.get_by_test_id('profile-save').click()
 expect(page.get_by_text('Demo Tester',exact=True)).to_be_visible()
 page.get_by_test_id('logout').click();page.get_by_test_id('logout-confirm').click()
 expect(page.get_by_test_id('enter-demo')).to_be_visible()
 page.get_by_test_id('enter-demo').click();expect(page.get_by_test_id('dashboard')).to_be_visible()
 page.get_by_test_id('tab-profile').click();expect(page.get_by_text('Demo Tester',exact=True)).to_be_visible()
 assert not errors,errors
 assert not requests,requests
 print(json.dumps({'entries':len(data['entries']),'water':len(data['water']),'logged_days':43,'offline_requests':requests,'errors':errors}))
 browser.close()
