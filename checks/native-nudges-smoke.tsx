// Runs only in the isolated com.fitlens.smoke APK, never the release app entry point.
import React,{useEffect} from 'react';
import {Text} from 'react-native';
import {requireNativeModule} from 'expo';
import {File,Paths} from 'expo-file-system';
import {defaultNudges,nudgeCopy} from '../mobile/src/features/nudges/domain';
export default function Smoke(){useEffect(()=>{const result:any={};async function run(){
 const n=requireNativeModule('FitLensNudges');await n.stop();
 const now=new Date(),date=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
 await n.configure(JSON.stringify({uid:'isolated-nudge-test',name:'Tester',settings:{...defaultNudges,enabled:true,workouts:true,quietStart:'00:00',quietEnd:'00:00',enabledAt:new Date(+now-3600000).toISOString()},days:{[date]:{meals:[],water:0,steps:1000,workouts:[{id:'watch-fixture',name:'Fixture walk',start:new Date(+now-1800000).toISOString(),end:new Date(+now-1200000).toISOString(),minutes:10}]}},stepGoal:6000,healthEnabled:false,copy:nudgeCopy}));
 await n.checkNow();
 let status:any;for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,300));status=await n.status();if(status.lastNotice)break}
 if(!status.lastNotice)throw Error('Offline native worker did not deliver workout notice');
 result.worker=status;await n.checkNow();await new Promise(r=>setTimeout(r,1500));result.status='passed';
 }run().catch(e=>{result.status='failed';result.error=String(e)}).finally(()=>new File(Paths.document,'fitlens-nudges-smoke.json').write(JSON.stringify(result)));},[]);return <Text>Testing offline dynamic nudges…</Text>}
