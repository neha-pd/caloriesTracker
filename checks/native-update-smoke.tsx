// Isolated com.fitlens.smoke entry only. Never bundled into the team APK.
import React, {useEffect, useState} from 'react';
import {Text} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UpdateGate from '../mobile/src/features/updates/gate';
export default function Smoke() {
 const [ready,setReady]=useState(false);
 useEffect(()=>{void (async()=>{
   const used=await AsyncStorage.getItem('update-smoke:ran');
   if (!used) { await AsyncStorage.removeItem('fitlens:required-release:v1'); await AsyncStorage.setItem('update-smoke:ran','yes'); }
   global.fetch=(async()=> { if (used) throw Error('offline fixture'); return {ok:true,json:async()=>({android:{version:'9.0.0',required:true,url:'https://github.com/neha-pd/caloriesTracker/releases/download/v9.0.0-team.1/Fitkin-9.0.0-team-arm64.apk'}})} as Response; }) as typeof fetch;
   setReady(true);
 })()},[]);
 return <><Text>Isolated update check</Text>{ready && <UpdateGate/>}</>;
}
