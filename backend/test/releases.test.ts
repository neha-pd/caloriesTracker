import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseManifest, createReleaseLookup} from '../src/core/releases';
import {validRelease, needsUpdate} from '../../mobile/src/features/updates/domain';
const version='2.5.0', tag='v2.5.0-team.1', name='FitLens-2.5.0-team-arm64.apk';
const url=`https://github.com/neha-pd/caloriesTracker/releases/download/${tag}/${name}`;
const release={tag_name:tag,draft:false,prerelease:false,assets:[{name,state:'uploaded',size:123,browser_download_url:url},{name:name+'.sha256',state:'uploaded',size:95}]};
test('only published complete team APK releases can require an update',()=>{
 const manifest=releaseManifest(release)!;
 assert.equal(manifest.url,url);assert.equal(validRelease(manifest),true);
 for(const bad of [{...release,draft:true},{...release,prerelease:true},{...release,assets:release.assets.slice(0,1)},{...release,tag_name:'v2.5.0'},{...release,assets:[{...release.assets[0],browser_download_url:'https://evil.example/app.apk'},release.assets[1]]}]) assert.equal(releaseManifest(bad),null);
 assert.equal(validRelease({...manifest,url:url+'?redirect=elsewhere'}),false);
 assert.equal(validRelease({...manifest,required:false}),false);
});
test('required updates compare numeric versions and never downgrade',()=>{
 const m={version,url,required:true as const};
 assert.equal(needsUpdate('2.4.0',m),true);assert.equal(needsUpdate('2.5.0',m),false);assert.equal(needsUpdate('2.10.0',m),false);assert.equal(needsUpdate('invalid',m),false);
 const next={version:'2.10.0',url:url.replaceAll('2.5.0','2.10.0'),required:true as const};assert.equal(needsUpdate('2.9.9',next),true);
});
test('release checks share and cache one request; outages do not invent a requirement',async()=>{
 let calls=0;
 const lookup=createReleaseLookup((async()=>{calls++;return {ok:true,json:async()=>release} as Response;}) as typeof fetch);
 const results=await Promise.all([lookup(),lookup(),lookup()]);assert.equal(calls,1);assert.deepEqual(results[0],results[2]);await lookup();assert.equal(calls,1);
 const offline=createReleaseLookup((async()=>{throw Error('offline')}) as typeof fetch);assert.equal(await offline(),null);
});
