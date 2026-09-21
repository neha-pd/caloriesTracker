// Isolated com.fitlens.smoke instrumentation only. No production account or backend.
import React, {useEffect} from 'react';
import {Text} from 'react-native';
import {File,Paths} from 'expo-file-system';
import * as N from 'expo-notifications';
import {useAuthStore} from '../mobile/src/store/authStore';
import {localReminderDraft} from '../mobile/src/features/reminderDomain';
import {saveCustomReminder,listCustomReminders,pauseCustomReminder} from '../mobile/src/features/customReminders';
export default function ReminderSmoke(){
 useEffect(()=>{
  const result:Record<string,unknown>={};const uid='isolated-reminder-check';
  async function run(){
   await N.cancelAllScheduledNotificationsAsync();
   useAuthStore.setState({user:{id:uid} as any});
   for(const r of await listCustomReminders(uid)) await pauseCustomReminder(uid,r.id,true);
   const d=localReminderDraft('Drink water at regular intervals in 24hrs');
   await saveCustomReminder(uid,d);
   let [saved]=await listCustomReminders(uid);
   let pending=await N.getAllScheduledNotificationsAsync();
   if(pending.length!==7)throw new Error('Expected seven daytime notifications, got '+pending.length);
   result.initial=pending.map(n=>n.trigger);
   await saveCustomReminder(uid,{...d,intervalHours:4},saved);
   [saved]=await listCustomReminders(uid);pending=await N.getAllScheduledNotificationsAsync();
   if(pending.length!==4)throw new Error('Edit left stale notification IDs');
   result.editedCount=pending.length;
   await pauseCustomReminder(uid,saved.id);
   if((await N.getAllScheduledNotificationsAsync()).length)throw new Error('Pause left notifications');
   [saved]=await listCustomReminders(uid);
   await saveCustomReminder(uid,{...d,quietHours:false},saved);
   if((await N.getAllScheduledNotificationsAsync()).length!==12)throw new Error('Expected 12 around-the-clock notifications');
   result.overnightCount=12;
   [saved]=await listCustomReminders(uid);await pauseCustomReminder(uid,saved.id,true);
   if((await N.getAllScheduledNotificationsAsync()).length)throw new Error('Delete left notifications');
   result.status='passed';
  }
  run().catch(e=>{result.status='failed';result.error=String(e)}).finally(()=>{new File(Paths.document,'fitlens-ai-smoke.json').write(JSON.stringify(result));console.log('FITLENS_REMINDER_SMOKE',JSON.stringify(result));});
 },[]);
 return <Text>Testing interval reminders…</Text>;
}
