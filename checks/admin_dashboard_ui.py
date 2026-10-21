"""Render the embedded admin HTML with an explicit synthetic RPC fixture.
Backend owner authorization is separately tested against the bundled script.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json
out=Path('.data/admin-dashboard');out.mkdir(parents=True,exist_ok=True)
fixture={"configured":True,"ready":True,"days":7,"refreshedAt":"2026-10-21T12:00:00Z","counts":{"accounts":25,"food":286,"workouts":72,"water":193},"requests":642,"errors":8,"activeAccounts":18,"operations":321,"rejected":2,"median":845,"p95":2310,"timing":{"total":1040,"lock":80,"read":360,"write":240},"sheetUrl":"https://docs.google.com/spreadsheets/d/sample/edit","daily":[{"date":f"2026-10-{15+i}","requests":n}for i,n in enumerate([40,84,65,112,90,126,125])],"routes":[{"route":"/api/v3/batch","requests":310,"errors":2,"p95":2310},{"route":"/api/v3/snapshot","requests":220,"errors":6,"p95":1840}],"recent":[{"at":"2026-10-21T12:00:00Z","route":"/api/v3/batch","status":200,"ms":812,"operations":3},{"at":"2026-10-21T11:59:00Z","route":"/api/v3/snapshot","status":503,"ms":2100,"operations":0}],"storage":[{"kind":k,"count":n,"purpose":"App records"}for k,n in [('user',25),('entry',286),('fitness',72),('water',193),('xp',421),('receipt',286),('session',29)]]}
script='''window.__fixture=FIXTURE;window.__calls=[];window.__deny=false;window.google={script:{run:{withSuccessHandler(fn){this.success=fn;return this},withFailureHandler(fn){this.failure=fn;return this},getFitkinDashboardData(arg){window.__calls.push(arg);setTimeout(()=>window.__deny?this.failure(new Error('Only the configured owner can use this admin tool.')):this.success({...window.__fixture,days:arg.days}),15)},setupFitkinDashboard(){window.__fixture.configured=true;setTimeout(()=>this.success({ready:true}),15)}}}};'''.replace('FIXTURE',json.dumps(fixture))
with sync_playwright() as p:
 browser=p.chromium.launch()
 for label,width,height in [('desktop',1440,1000),('phone',390,844)]:
  context=browser.new_context(viewport={'width':width,'height':height});context.add_init_script(script);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(Path('apps-script/src/dashboard.html').resolve().as_uri());page.wait_for_load_state('networkidle');expect(page.locator('#accounts')).to_have_text('25');assert page.locator('body').evaluate('(e)=>e.scrollWidth<=innerWidth')
  page.locator('#errors-only').check();expect(page.locator('#recent tr')).to_have_count(1);expect(page.locator('#recent')).to_contain_text('503')
  page.locator('#period').select_option('1');expect(page.locator('#range-label')).to_have_text('Last 24 hours')
  page.get_by_role('button',name='Refresh data').click();page.wait_for_function('window.__calls.some(c=>c.refresh===true)');expect(page.get_by_role('button',name='Refresh data')).to_be_enabled()
  page.locator('#period').select_option('7');expect(page.locator('#range-label')).to_have_text('Last 7 days');page.locator('#errors-only').uncheck()
  page.evaluate("document.querySelector('h1').textContent='Fitkin admin · sample preview'");page.evaluate("document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)");page.screenshot(path=str(out/(label+'.png')),full_page=True)
  page.evaluate("window.__fixture={...window.__fixture,requests:0,errors:0,median:null,p95:null,timing:{total:null,lock:null,read:null,write:null},recent:[],daily:[],routes:[]}")
  page.get_by_role('button',name='Refresh data').click();expect(page.locator('#chart')).to_contain_text('No samples yet');expect(page.locator('#median')).to_have_text('No samples');page.screenshot(path=str(out/(label+'-empty.png')),full_page=True)
  assert not errors,errors;context.close()
 context=browser.new_context();context.add_init_script(script+'window.__deny=true;');page=context.new_page();page.goto(Path('apps-script/src/dashboard.html').resolve().as_uri());expect(page.locator('#error')).to_contain_text('Only the configured owner');expect(page.locator('#content')).to_be_hidden();context.close()
 context=browser.new_context();context.add_init_script(script+'window.__fixture.configured=false;');page=context.new_page();page.goto(Path('apps-script/src/dashboard.html').resolve().as_uri());page.get_by_role('button',name='Enable dashboard').click();expect(page.locator('#accounts')).to_have_text('25');context.close();browser.close()
print('PASS desktop/mobile layout, chart/table display, period selection, manual refresh, error filtering, empty state, owner denial and setup flow (synthetic RPC).')
