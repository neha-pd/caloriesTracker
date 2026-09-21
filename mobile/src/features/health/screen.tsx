import React, {useEffect} from "react";
import {View} from "react-native";
import {router, useLocalSearchParams} from "expo-router";
import {localDateKey} from "../../lib/dates";
import {useAuthStore} from "../../store/authStore";
import {useTracker, totalNutrition} from "../tracker";
import {useHealth} from "./store";
import {energyForDay} from "../fitness/domain";
import {DatePicker} from "../home";
import {Button, Card, C, Icon, Meter, Page, S, T, Tap} from "../ui";
export function SettingsRow({title, detail, onPress}: {title:string;detail?:string;onPress:()=>void}) {
 return <Tap label={title} onPress={onPress} style={{flexDirection:"row",alignItems:"center",paddingVertical:14,gap:12}}>
   <View style={{flex:1,gap:3}}><T bold>{title}</T>{detail && <T size={12} color={C.muted}>{detail}</T>}</View><Icon name="chevron-forward" size={18} color={C.muted}/>
 </Tap>;
}
export default function Health() {
 const params=useLocalSearchParams<{date?:string}>(), s=useHealth(), t=useTracker(), u=useAuthStore(x=>x.user), device=s.days[t.date], energy=energyForDay(t.date,t.fitness,device);
 useEffect(()=>{if(params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date<=localDateKey() && localDateKey(new Date(params.date+"T12:00:00"))===params.date)t.setDate(params.date);},[params.date]);
 useEffect(()=>{if(s.enabled)void s.readDay(t.date)},[t.date,s.enabled,s.uid]);
 const eaten=totalNutrition(t.entries.filter(e=>e.log_date===t.date&&!e.deleted_at)).calories;
 return <Page back title="Your activity" subtitle="Food, movement and progress in one place." refresh={{loading:s.busy,run:()=>void s.sync()}}>
   <DatePicker/>
   <View style={S.two}>
     <Card style={{flex:1}}><T bold size={26}>{Math.round(eaten).toLocaleString()}</T><T color={C.lime}>kcal eaten</T></Card>
     <Card style={{flex:1}}><T bold size={26}>{energy.totalCalories==null?"—":Math.round(energy.totalCalories).toLocaleString()}</T><T color={C.orange}>kcal burned</T></Card>
   </View>
   <Card>
     <T bold size={20}>Movement</T>
     {[["Movement calories",energy.activeCalories,"kcal"],["Activity time",energy.exerciseMinutes,"min"],["Steps",device?.steps,"steps"]].map(([label,value,unit])=><View key={String(label)} style={[S.row,{justifyContent:"space-between"}]}><T>{label}</T><T bold>{value==null?"—":Math.round(Number(value)).toLocaleString()+" "+unit}</T></View>)}
     {u?.settings.step_goal && <><Meter value={device?.steps==null?0:Math.min(100,device.steps/u.settings.step_goal*100)}/><T size={12} color={C.lime}>{device?.steps==null ? "Waiting for steps from your watch" : device.steps>=u.settings.step_goal?"You reached your step goal 🎉":`${Math.max(0,u.settings.step_goal-Math.round(device.steps)).toLocaleString()} steps to go`} · {u.settings.step_goal.toLocaleString()} daily goal</T></>}
     <T size={12} color={C.muted}>Total burned includes movement and resting energy. A dash means no reading yet.</T>
   </Card>
   <Button title="Log activity" onPress={()=>router.push("/activity")}/>
   {!s.enabled && <Card><T bold>Let your watch fill in the details</T><T color={C.muted}>Bring in steps, calories and workouts from your watch.</T><Button title="Connect watch" onPress={()=>router.push("/watch-settings")}/></Card>}
   {(device?.workouts.length || energy.workouts.length) ? <Card><T bold size={20}>Activities</T>
     {device?.workouts.map(w=><View key={w.id} style={{gap:3,paddingVertical:8}}><T bold>{w.name}</T><T size={12} color={C.muted}>{Math.round(w.minutes)} min · From your watch</T></View>)}
     {energy.workouts.map(w=><SettingsRow key={w.id} title={w.name} detail={`${w.minutes} min · Added by you`} onPress={()=>router.push({pathname:"/activity",params:{id:w.id}})}/>)}
   </Card>:null}
   <Card>
     <SettingsRow title="Edit goals" detail={u?.settings.step_goal?`${u.settings.step_goal.toLocaleString()} steps a day`:"Set a step or movement goal"} onPress={()=>router.push("/movement-goals")}/>
     {s.enabled && <SettingsRow title="Watch settings" detail={s.error?"Sync needs attention":s.busy?"Syncing…":"Connected · syncs when you open FitLens"} onPress={()=>router.push("/watch-settings")}/>}
     <SettingsRow title="Reminders & celebrations" detail="Choose when Ember cheers you on" onPress={()=>router.push("/smart-nudges")}/>
   </Card>
 </Page>;
}
