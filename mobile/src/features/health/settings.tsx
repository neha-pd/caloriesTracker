import React,{useState} from "react";
import {Platform,View} from "react-native";
import {Banner,Button,Card,C,Page,Segments,T,Tap,Icon} from "../ui";
import {useHealth} from "./store";
import {useTracker} from "../tracker";
import * as adapter from "./adapter";
function Section({title,children}:{title:string;children:React.ReactNode}){
 const [open,setOpen]=useState(false);
 return <Card><Tap label={title} onPress={()=>setOpen(!open)} style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:8}}><T bold>{title}</T><Icon name={open?"chevron-up":"chevron-down"} size={18}/></Tap>{open&&children}</Card>;
}
export default function WatchSettings(){
 const s=useHealth(),date=useTracker(x=>x.date),day=s.days[date],[period,setPeriod]=useState("month"),[disconnect,setDisconnect]=useState(false);
 const native=Platform.OS!=="web", platform=Platform.OS==="ios"?"Apple Health":"Health Connect";
 return <Page back title="Your watch" subtitle="Fitkin reads the activity your watch shares with your phone.">
  <Card><T bold size={20}>{s.enabled?"Watch sync is on":"Connect your watch"}</T>
   <T color={C.muted}>{s.enabled?"Open Fitkin after your watch syncs. Your readings refresh automatically.":`First sync your watch with its companion app. Then connect ${platform} to bring your activity into Fitkin.`}</T>
   {s.lastSync&&<T size={12} color={C.muted}>Last synced {new Date(s.lastSync).toLocaleString()}</T>}
   {native?<Button title={s.enabled?"Sync now":"Connect watch"} loading={s.busy} onPress={()=>void(s.enabled?s.sync():s.connect())}/>:<T color={C.muted}>Use the Fitkin phone app to connect your watch.</T>}
  </Card>
  {s.error&&<Banner error text={s.error}/>}
  {s.enabled&&s.permissionVersion<2&&<Card><T>Allow workout and calorie access to complete your connection.</T><Button title="Continue setup" onPress={()=>void s.connect()}/></Card>}
  {s.enabled&&<>
   <Section title="Bring in past activity"><T color={C.muted}>Choose how far back to look. Keep Fitkin open while it imports the readings your watch has shared.</T><Segments value={period} onChange={setPeriod} values={[{key:"month",label:"30 days"},{key:"year",label:"This past year"}]}/><Button title={s.importing?`Importing · ${s.importProgress}%`:"Import activity"} disabled={s.importing||!native} onPress={()=>void s.importHistory(period==="year")}/></Section>
   <Section title="Connection help"><T color={C.muted}>Missing a reading? Sync your watch in its companion app, then check that Fitkin has permission to read it.</T>
    {native&&<><Button secondary title="Review permissions" onPress={()=>void s.connect()}/><Tap label="Open phone health settings" onPress={()=>void adapter.settings()}><T color={C.lime}>Open phone health settings</T></Tap></>}
    {day&&Object.entries(day.permissions).map(([metric,status])=><T key={metric} size={12} color={C.muted}>{({Steps:"Steps",ActiveCaloriesBurned:"Movement calories",TotalCaloriesBurned:"Total calories",ExerciseSession:"Workouts",activeCalories:"Movement calories",totalCalories:"Total calories",restingCalories:"Resting calories",steps:"Steps",workouts:"Workouts"} as Record<string,string>)[metric]||"Health reading"}: {({allowed:"Connected","not allowed":"Permission needed","no records":"No readings for this day",unavailable:"Couldn’t read this data","readable":"Connected","no data or denied":"No readings shared"} as Record<string,string>)[status]||"No readings shared"}</T>)}
   </Section>
   <Tap label="Disconnect watch" onPress={()=>setDisconnect(!disconnect)} style={{paddingVertical:16}}><T color={C.muted}>Disconnect watch</T></Tap>
   {disconnect&&<Card><T>Stop syncing this watch? Your previously saved readings will stay in Fitkin.</T><Button danger title="Yes, disconnect" onPress={()=>void s.disconnect()}/><Tap label="Keep connected" onPress={()=>setDisconnect(false)}><T color={C.lime}>Keep connected</T></Tap></Card>}
  </>}
 </Page>;
}
