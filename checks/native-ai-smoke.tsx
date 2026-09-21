// Opt-in native instrumentation harness. Never imported by the shipped app.
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { download, models, createLLMChatSession } from '../mobile/node_modules/react-native-executorch';
import { File, Paths } from 'expo-file-system';
import { decode } from 'jpeg-js';
import { toByteArray } from 'base64-js';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { ExpoSpeechRecognitionModule as SR } from 'expo-speech-recognition';
import * as N from 'expo-notifications';
import { assistantText, foodPrompt, parseFoodSuggestions } from '../mobile/src/features/aiDomain';
import { conversationSystem, conversationContext, boundedHistory } from '../mobile/src/features/chat/domain';
import { parseTipIds } from '../mobile/src/features/coach/domain';
import { reminderPrompt, parseReminder } from '../mobile/src/features/reminderDomain';
export default function NativeSmoke() {
  useEffect(() => {
    const result: Record<string, unknown> = {};
    const out = new File(Paths.document, 'fitlens-ai-smoke.json');
    async function run() {
      const chat = await download(models.llm.LFM2_5_1_2B.XNNPACK_8DA4W);
      async function ask(prompt: string, system?: string) {
        const session = await createLLMChatSession(chat, { initialMessages: system ? [{role:'system',content:system}] : [], generationConfig: {maxNewTokens:220,temperature:0.1} });
        try { const r = assistantText((await session.sendMessage(prompt)).messages); if (!r) throw new Error('Empty model output'); return r; } finally { session.dispose(); }
      }
      result.chat = await ask('I logged dosa for breakfast and 1200 ml of water today. Say hello and suggest one easy habit.', 'You are Ember, a kind companion. Answer in two short sentences.');
      const context = conversationContext({date:'2026-09-21', entries:Array.from({length:15},(_,i)=>({log_date:'2026-09-21',name:'Dosa with sambar and coconut chutney '+i,calories:100,protein_g:5,carbs_g:15,fat_g:3,meal_type:'breakfast'})) as any,water:[],complete:false,goals:{calories:2000,protein:100,carbs:250,fat:70,water:2000}}, {display_name:'Neha',weight_kg:70,weight_goal_kg:65},{steps:null,activeCalories:null,lastSync:null});
      const history = boundedHistory([{role:'user',content:'I want practical meal ideas.'},{role:'assistant',content:'What ingredients do you have?'},{role:'user',content:'Rice, dal, eggs and vegetables.'},{role:'assistant',content:'You could make dal, rice and vegetables, with eggs if you like.'}]);
      const contextual = await createLLMChatSession(chat, {initialMessages:[{role:'system',content:conversationSystem(context)},...history],generationConfig:{maxNewTokens:200,temperature:0.1}});
      try { result.contextualChat = assistantText((await contextual.sendMessage('How many calories have I logged, and what ingredients did I mention?')).messages); } finally { contextual.dispose(); }
      result.review = parseTipIds(await ask('Return only JSON: {"tip_ids":["water","reflect"]}'), ['water','reflect']);
      result.reminderRaw = await ask(reminderPrompt('Remind me to drink water at 3 pm on weekdays'));
      try { result.reminder = parseReminder(String(result.reminderRaw), 'Remind me to drink water at 3 pm on weekdays'); } catch (e) { result.reminderError = String(e); }
      const food = requireOptionalNativeModule('FitLensFood');
      if (!food) throw new Error('Food module missing');
      const start = Date.now();
      result.food = await food.classify(require('../.data/ai-smoke-photo.json').base64);
      result.foodMs = Date.now() - start;
      if (!Array.isArray(result.food) || !(result.food as any[]).some(r=>r.name === 'Sambar')) throw new Error('Food fixture did not identify sambar');
      result.offlineDictationAvailable = SR.supportsOnDeviceRecognition();
      const voice = requireOptionalNativeModule('FitLensVoice');
      if (!voice) throw new Error('Offline voice module missing');
      try { await voice.prepare(); await voice.speak('Hello, I am Ember. Your local voice is ready.', 'en-US'); result.voice = 'speech accepted'; } catch (e) { result.voice = String(e); }
      await N.setNotificationChannelAsync('daily-habits', {name:'Daily habits',importance:N.AndroidImportance.DEFAULT});
      const id = await N.scheduleNotificationAsync({content:{title:'FitLens native test',body:'Notification scheduler check'},trigger:{type:N.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:60,channelId:'daily-habits'}});
      if (!(await N.getAllScheduledNotificationsAsync()).some(n=>n.identifier===id)) throw new Error('Notification missing from scheduler');
      await N.cancelScheduledNotificationAsync(id); result.notification = 'scheduled and cancelled';
      result.status = result.reminderError ? 'failed' : 'passed';
    }
    run().catch(e => { result.status='failed'; result.error=String(e); }).finally(() => { out.write(JSON.stringify(result)); console.log('FITLENS_NATIVE_SMOKE', JSON.stringify(result)); });
  }, []);
  return <View><Text>Running FitLens native AI checks…</Text></View>;
}
