// Called only for a tested main commit. Never prints credentials or API response bodies.
const key=process.env.RENDER_API_KEY, commit=process.env.DEPLOY_COMMIT;
if(!key || !/^[a-f0-9]{40}$/.test(commit||'')) throw new Error('Render credential and full commit SHA are required.');
async function render(path,body) {
 const response=await fetch('https://api.render.com/v1/'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 if(!response.ok) throw new Error(`Render request failed (${response.status})`);
 return response.json();
}
const ids=['srv-daogq6ajnfac738tslf0','srv-daogqhid0e5s7387engg'];
await Promise.all(ids.map(async id=>{
 const deploy=await render(`services/${id}/deploys`,{commitId:commit,clearCache:'do_not_clear'});
 console.log(`Deployment started: ${id} / ${deploy.id}`);
 for(let attempt=0;attempt<70;attempt++) {
  const state=await render(`services/${id}/deploys/${deploy.id}`);
  if(state.status==='live') {console.log(`${id}: live`);return;}
  if(['build_failed','update_failed','canceled','deactivated'].includes(state.status)) throw new Error(`${id}: ${state.status}`);
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 throw new Error(`${id}: deploy timeout`);
}));
for (const url of ['https://fitlens-api.onrender.com/ready','https://fitlens-kpph.onrender.com/']) {
 const response=await fetch(url,{signal:AbortSignal.timeout(70000)});
 if(!response.ok) throw new Error(`Readiness check failed: ${response.status}`);
}
console.log('API and web readiness checks passed.');
