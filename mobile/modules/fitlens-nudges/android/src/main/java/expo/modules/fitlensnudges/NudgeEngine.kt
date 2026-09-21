package expo.modules.fitlensnudges

import org.json.JSONObject
import org.json.JSONArray
import java.time.Instant
import java.time.ZoneId
import java.time.LocalDate
import kotlin.math.abs

/** Pure delivery decisions: no network, sensors, storage, or notification side effects. */
object NudgeEngine {
 data class Notice(val key:String,val title:String,val body:String,val route:String,val kind:String)
 fun minute(time:String):Int { val p=time.split(":");return p[0].toInt()*60+p[1].toInt() }
 fun quiet(value:Int,start:Int,end:Int):Boolean=if(start==end)false else if(start>end)value>=start||value<end else value>=start&&value<end
 private fun hash(s:String):Int = s.fold(0){h,c->31*h+c.code} and Int.MAX_VALUE
 @JvmStatic fun choose(config:JSONObject,ledger:JSONObject,now:Instant):Notice? {
  val s=config.getJSONObject("settings");if(!s.optBoolean("enabled"))return null
  val local=now.atZone(ZoneId.systemDefault());val date=local.toLocalDate().toString();val clock=local.hour*60+local.minute
  if(quiet(clock,minute(s.getString("quietStart")),minute(s.getString("quietEnd"))))return null
  val keys=ledger.keys().asSequence().toList()
  if(keys.count{it.startsWith("$date|")}>=8)return null
  val last=keys.maxOfOrNull{ledger.optLong(it,0)}?:0
  if(now.toEpochMilli()-last<30*60*1000)return null
  val day=config.optJSONObject("days")?.optJSONObject(date)?:JSONObject()
  val steps=if(day.isNull("steps"))null else day.optLong("steps",0)
  val goal=config.optInt("stepGoal",0)
  val tokens=mutableMapOf("name" to config.optString("name","friend"),"steps" to (steps?.toString()?:""),"goal" to goal.toString(),"remaining" to (goal-(steps?:0)).coerceAtLeast(0).toString(),"water" to day.optInt("water",0).toString())
  fun notice(kind:String,key:String,route:String,extra:Map<String,String> = emptyMap()):Notice? {
   if(ledger.has(key))return null
   val pool=config.getJSONObject("copy").getJSONArray(kind)
   val index=((local.toLocalDate().toEpochDay()+hash(config.optString("uid")+kind))%pool.length()).toInt()
   val pair=pool.getJSONArray(index)
   fun fill(text:String):String {var out=text;for((k,v) in tokens+extra)out=out.replace("{$k}",v);return out}
   return Notice(key,fill(pair.getString(0)),fill(pair.getString(1)),route,kind)
  }
  // Only new, completed sessions. First-time enable and history imports do not flood alerts.
  if(s.optBoolean("workouts")&&keys.count{it.startsWith("$date|workout:")}<2){
   val enabledAt=runCatching{Instant.parse(s.getString("enabledAt"))}.getOrDefault(now)
   val days=config.optJSONObject("days")?:JSONObject()
   val workouts=days.keys().asSequence().flatMap{d->val a=days.optJSONObject(d)?.optJSONArray("workouts")?:JSONArray();(0 until a.length()).asSequence().map{a.getJSONObject(it)}}.toList().sortedBy{it.optString("end")}
   for(w in workouts){
    val end=runCatching{Instant.parse(w.getString("end"))}.getOrNull()?:continue
    val start=runCatching{Instant.parse(w.getString("start"))}.getOrNull()?:continue
    if(end<=enabledAt||end>now||end<now.minusSeconds(86400)||w.optBoolean("reviewed"))continue
    val fingerprint="${start.epochSecond/300}:${end.epochSecond/300}"
    if(keys.any{it.contains("|workout:$fingerprint")})continue
    val manual=days.optJSONObject(start.atZone(ZoneId.systemDefault()).toLocalDate().toString())?.optJSONArray("manual")?:JSONArray()
    if((0 until manual.length()).any{ i->val m=manual.getJSONObject(i);val ms=runCatching{Instant.parse(m.getString("start"))}.getOrDefault(Instant.EPOCH);abs(ms.epochSecond-start.epochSecond)<600&&abs(m.optDouble("minutes")-w.optDouble("minutes"))<10})continue
    notice("workout","$date|workout:$fingerprint","health?date=${start.atZone(ZoneId.systemDefault()).toLocalDate()}",mapOf("workout" to w.optString("name","Workout").take(60),"minutes" to w.optDouble("minutes").toInt().toString()))?.let{return it}
   }
  }
  if(s.optBoolean("steps")&&steps!=null&&goal>0){
   if(steps>=goal){notice("stepGoal","$date|stepGoal","health?date=$date")?.let{return it}}
   else if(steps>=goal/2){notice("stepHalf","$date|stepHalf","health?date=$date")?.let{return it}}
  }
  val meals=day.optJSONArray("meals")?:JSONArray();val logged=(0 until meals.length()).map{meals.getString(it)}
  for(meal in listOf("breakfast","lunch","dinner")){
   val due=minute(s.getString(meal));if(clock in due..(due+90)&&meal !in logged)notice(meal,"$date|$meal","log?meal=$meal")?.let{return it}
  }
  if(s.optBoolean("water")&&day.optInt("water",0)<config.optInt("waterGoal",2000)){
   for(due in listOf(11*60,16*60))if(clock in due..(due+60))notice("water","$date|water:$due","water")?.let{return it}
  }
  if(day.optDouble("minutes",0.0)<=0 && !(goal>0&&steps!=null&&steps>=goal)){
   for(i in 0 until s.optInt("fitness",0).coerceIn(0,2)){
    val due=(if(i==0)10*60 else 15*60)+hash(config.optString("uid")+date+i)%121
    if(clock in due..(due+60))notice(if(steps!=null&&goal>0)"fitnessSteps" else "fitness","$date|fitness:$i","health")?.let{return it}
   }
  }
  return null
 }
}
