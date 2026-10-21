"""Browser regression checks. --live creates and removes one disposable account.
Run with a local export server or --base https://your-static-site.
"""
import argparse, json, os, secrets, uuid, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
args=argparse.ArgumentParser();args.add_argument('--base',default='http://localhost:5173');args.add_argument('--live',action='store_true');a=args.parse_args()
out=Path('.data/pwa-checks');out.mkdir(parents=True,exist_ok=True)
KEY=os.environ.get('EXPO_PUBLIC_FIREBASE_API_KEY','AIzaSyDsMmb8fF3tBvvCJ8Dy_7uGbp-nY8PQ_RY')
endpoint=os.environ.get('EXPO_PUBLIC_APPS_SCRIPT_URL','')
def post(url,body):
 req=urllib.request.Request(url,json.dumps(body).encode(),{'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=90) as r:return json.load(r)
def firebase(action,body):return post('https://identitytoolkit.googleapis.com/v1/accounts:'+action+'?key='+KEY,body)
def rpc(auth,session,path,method='GET',body=None):
 result=post(endpoint,dict(protocol=1,token=auth['idToken'],session=session,path=path,method=method,body=body or {},requestId=str(uuid.uuid4())))
 assert result['status']==200,(path,result['status'],result.get('data',{}).get('error'));return result['data']
def visit(page,path):
 page.goto(a.base+path);page.wait_for_load_state('networkidle')
def sample(page,context,name):
 visit(page,'/');page.get_by_test_id('enter-demo').click();page.get_by_test_id('dashboard').wait_for(timeout=30000)
 page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('!!navigator.serviceWorker.controller')
 assert page.locator('body').evaluate('(e)=>e.scrollWidth<=innerWidth')
 page.screenshot(path=str(out/(name+'-today.png')))
 visit(page,'/install');expect(page.get_by_text('Ready for offline use',exact=True)).to_be_visible();page.screenshot(path=str(out/(name+'-install.png')))
 context.set_offline(True);visit(page,'/log');page.get_by_test_id('food-search').fill('dosa');page.get_by_text('Dosa, plain',exact=True).click();page.get_by_test_id('food-confirm').click();expect(page.get_by_text('Dosa, plain',exact=True).last).to_be_visible()
 visit(page,'/reminders');page.get_by_role('button',name='Breakfast',exact=True).click()
 # Headless WebKit exposes a native Share API but has no OS share sheet.
 # Exercise the downloadable fallback; physical Safari sharing needs device QA.
 page.evaluate('Object.defineProperty(navigator,"canShare",{value:()=>false,configurable:true})')
 with page.expect_download() as d:page.get_by_role('button',name='Export calendar reminder').click()
 dest=out/(name+'-reminder.ics');d.value.save_as(dest);assert 'BEGIN:VALARM' in dest.read_text()
 visit(page,'/share')
 with page.expect_download(timeout=30000) as d:page.get_by_test_id('download-story').click()
 dest=out/(name+'-story.png');d.value.save_as(dest);assert dest.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
 visit(page,'/train');page.get_by_role('button',name='Continue',exact=True).click()
 page.get_by_role('button',name='I’m 18 or older',exact=True).click();page.get_by_role('button',name='I can exercise without restrictions, or have individual clearance',exact=True).click()
 for i in range(3):page.get_by_role('button',name='Continue',exact=True).click()
 page.get_by_role('button',name='Build my workout plan',exact=True).click()
 expect(page.get_by_text('Build my workout plan',exact=True)).not_to_be_visible()
 page.screenshot(path=str(out/(name+'-train.png')))
 context.set_offline(False)
 print('PASS',name,'install readiness, offline reload/search/food, PNG and reminder calendar')

def live(page,context):
 assert os.environ.get('FITKIN_LIVE_TEST')=='1' and endpoint,'Explicit live-test environment required'
 with urllib.request.urlopen(endpoint,timeout=60) as response:metadata=json.load(response)['data']
 paths=[]
 def capture(request):
  if request.method=='POST' and request.url==endpoint:
   try:paths.append(json.loads(request.post_data)['path'])
   except (ValueError,KeyError):pass
 page.on('request',capture)
 email='fitkin-pwa-'+str(uuid.uuid4())+'@example.invalid';password=secrets.token_urlsafe(24)
 auth=None;session=None
 try:
  auth=firebase('signUp',{'email':email,'password':password,'returnSecureToken':True})
  session=rpc(auth,None,'/api/auth/session','POST',{'display_name':'PWA Test','timezone':'Asia/Kolkata'})['sheet_session']
  rpc(auth,session,'/api/users/me/goals','PATCH',{'goal_type':'maintain','calorie_goal':2000,'protein_goal_g':100,'carbs_goal_g':250,'fat_goal_g':67})
  visit(page,'/');page.get_by_role('button',name='I already have an account').click()
  page.get_by_test_id('auth-email').fill(email);page.get_by_test_id('auth-password').fill(password);page.get_by_test_id('auth-submit').click();page.get_by_test_id('dashboard').wait_for(timeout=90000)
  page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('!!navigator.serviceWorker.controller')
  page.wait_for_function('!!localStorage.getItem("fitkin:session:v1:sheet_session")')
  # A new tab receives localStorage but not sessionStorage: persistent PWA login.
  other=context.new_page();visit(other,'/');other.get_by_test_id('dashboard').wait_for(timeout=90000);other.close()
  uid=page.evaluate('JSON.parse(localStorage.getItem("fitlens:profile")).id')
  page.wait_for_function('(uid)=>!!localStorage.getItem("fitlens:data:"+uid)',arg=uid)
  context.set_offline(True);visit(page,'/water');page.get_by_role('button',name='+ 250 ml',exact=True).click()
  visit(page,'/activity');page.get_by_label('Activity name',exact=True).fill('PWA offline walk');page.get_by_label('Active calories · optional',exact=True).fill('120');page.get_by_role('button',name='Save record',exact=True).click()
  page.wait_for_function('(uid)=>JSON.parse(localStorage.getItem("fitlens:data:"+uid)).queue.length>=2',arg=uid)
  visit(page,'/');page.get_by_test_id('dashboard').wait_for();expect(page.get_by_text('120',exact=True)).to_be_visible()
  paths.clear();context.set_offline(False);visit(page,'/')
  page.wait_for_function('(uid)=>JSON.parse(localStorage.getItem("fitlens:data:"+uid)).queue.length===0',arg=uid,timeout=90000)
  snapshot=rpc(auth,session,'/api/v3/snapshot');assert len(snapshot['water'])==1 and len(snapshot['fitness'])==1
  if 'batch-sync' in metadata.get('capabilities',[]):
   assert '/api/v3/batch' in paths,paths
   assert not any(p.startswith('/api/v2/water/') or p.startswith('/api/v2/fitness/') for p in paths),paths
   print('PASS deployed batch sync: queued water and workout accepted without individual mutation requests')
  page.reload();page.get_by_test_id('dashboard').wait_for(timeout=90000)
  snapshot=rpc(auth,session,'/api/v3/snapshot');assert len(snapshot['water'])==1 and len(snapshot['fitness'])==1
  # Service worker caches contain static app resources, never auth/API responses.
  cached=page.evaluate('''async()=>{let urls=[];for(const key of await caches.keys()){const cache=await caches.open(key);urls.push(...(await cache.keys()).map(r=>r.url))}return urls}''')
  assert all('google.com' not in url and 'googleapis.com' not in url for url in cached)
  visit(page,'/profile');page.get_by_test_id('logout').click();page.get_by_test_id('logout-confirm').click();page.get_by_test_id('enter-demo').wait_for(timeout=30000)
  assert page.evaluate('localStorage.getItem("fitkin:session:v1:sheet_session")') is None
  print('PASS WebKit live login, new-tab persistence, offline edits, sync without duplicates, private cache and logout')
 finally:
  if auth:
   try:
    auth=firebase('signInWithPassword',{'email':email,'password':password,'returnSecureToken':True})
    session=rpc(auth,None,'/api/auth/session','POST',{})['sheet_session']
    rpc(auth,session,'/api/users/me','DELETE');print('Cleaned disposable PWA account')
   except Exception:
    path=out/'cleanup-required.json';path.write_text(json.dumps({'email':email,'password':password}));path.chmod(0o600);raise RuntimeError('Disposable-account cleanup requires retry; credentials saved privately')

with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch(headless=True);context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='en-IN',timezone_id='Asia/Kolkata',accept_downloads=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:sample(page,context,name);assert not errors,errors
  except Exception:page.screenshot(path=str(out/(name+'-failure.png')));print(page.locator('body').inner_text()[:2000]);raise
  finally:browser.close()
 if a.live:
  browser=p.webkit.launch(headless=True);context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='en-IN',timezone_id='Asia/Kolkata');page=context.new_page()
  try:live(page,context)
  finally:browser.close()
print('All requested browser checks passed')
