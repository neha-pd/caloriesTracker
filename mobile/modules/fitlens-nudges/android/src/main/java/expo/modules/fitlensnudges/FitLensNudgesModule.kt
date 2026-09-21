package expo.modules.fitlensnudges

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.*
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine
import org.json.JSONObject
import org.json.JSONArray
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

object NudgeStorage {
 val lock=Any()
 val execution=Mutex()
 const val WORK="fitlens-smart-nudges"
 const val CHANNEL="fitlens-smart"
 fun prefs(c:Context)=c.getSharedPreferences("fitlens-smart-nudges",Context.MODE_PRIVATE)
 fun stop(c:Context){synchronized(lock){prefs(c).edit().clear().commit();WorkManager.getInstance(c).cancelUniqueWork(WORK);WorkManager.getInstance(c).cancelUniqueWork(WORK+"-now");val nm=c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager;nm.activeNotifications.filter{it.tag==CHANNEL}.forEach{nm.cancel(CHANNEL,it.id)}}}
 fun schedule(c:Context){
  // Deliberately no network constraint: all decisions and health reads are local.
  val periodic=PeriodicWorkRequestBuilder<NudgeWorker>(15,TimeUnit.MINUTES).build()
  WorkManager.getInstance(c).enqueueUniquePeriodicWork(WORK,ExistingPeriodicWorkPolicy.KEEP,periodic)
 }
 suspend fun capabilities(c:Context):Map<String,Any>{
  if(HealthConnectClient.getSdkStatus(c)!=HealthConnectClient.SDK_AVAILABLE)return mapOf("available" to false,"background" to false,"granted" to false)
  val h=HealthConnectClient.getOrCreate(c)
  val feature=h.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND)==HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
  val permissions=h.permissionController.getGrantedPermissions()
  return mapOf("available" to true,"background" to feature,"granted" to permissions.contains("android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"),"exercise" to permissions.contains(HealthPermission.getReadPermission(ExerciseSessionRecord::class)),"steps" to permissions.contains(HealthPermission.getReadPermission(StepsRecord::class)))
 }
}
class FitLensNudgesModule:Module(){
 override fun definition()=ModuleDefinition {
  Name("FitLensNudges")
  AsyncFunction("configure") { raw:String ->
   val c=appContext.reactContext?:throw Exception("App unavailable")
   val config=JSONObject(raw);require(config.getString("uid").isNotBlank());require(raw.length<500000)
   synchronized(NudgeStorage.lock){
    val p=NudgeStorage.prefs(c);val old=runCatching{JSONObject(p.getString("config","{}")!!)}.getOrDefault(JSONObject())
    if(old.optString("uid")!=config.getString("uid"))NudgeStorage.stop(c)
    p.edit().putString("config",raw).commit()
    if(config.getJSONObject("settings").optBoolean("enabled"))NudgeStorage.schedule(c) else {WorkManager.getInstance(c).cancelUniqueWork(NudgeStorage.WORK);WorkManager.getInstance(c).cancelUniqueWork(NudgeStorage.WORK+"-now")}
   }
   true
  }
  AsyncFunction("stop") {appContext.reactContext?.let{NudgeStorage.stop(it)};true}
  AsyncFunction("capabilities") Coroutine { -> NudgeStorage.capabilities(appContext.reactContext?:throw Exception("App unavailable"))}
  AsyncFunction("checkNow") {
   val c=appContext.reactContext?:throw Exception("App unavailable")
   WorkManager.getInstance(c).enqueueUniqueWork(NudgeStorage.WORK+"-now",ExistingWorkPolicy.KEEP,OneTimeWorkRequestBuilder<NudgeWorker>().build());true
  }
  AsyncFunction("status") {
   val c=appContext.reactContext?:throw Exception("App unavailable");val p=NudgeStorage.prefs(c)
   mapOf("lastCheck" to p.getString("lastCheck",null),"healthStatus" to p.getString("healthStatus","Not checked"),"lastNotice" to p.getString("lastNotice",null),"enabled" to runCatching{JSONObject(p.getString("config","{}")!!).getJSONObject("settings").optBoolean("enabled")}.getOrDefault(false))
  }
 }
}
class NudgeWorker(c:Context,params:WorkerParameters):CoroutineWorker(c,params){
 override suspend fun doWork():Result=NudgeStorage.execution.withLock {
  val c=applicationContext;val p=NudgeStorage.prefs(c)
  val original=synchronized(NudgeStorage.lock){p.getString("config",null)}?:return@withLock Result.success()
  try {
   val config=JSONObject(original);if(!config.getJSONObject("settings").optBoolean("enabled"))return@withLock Result.success()
   val now=Instant.now();val date=now.atZone(ZoneId.systemDefault()).toLocalDate();val updates=JSONObject();var healthStatus="Health sync is off"
   if(config.optBoolean("healthEnabled")) {
    try {
     val caps=NudgeStorage.capabilities(c)
     if(caps["background"]!=true||caps["granted"]!=true)healthStatus="Allow background Health Connect access for watch updates while closed"
     else {
      val h=HealthConnectClient.getOrCreate(c);val day=JSONObject();val start=date.atStartOfDay(ZoneId.systemDefault()).toInstant()
      if(caps["steps"]==true){val a=h.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL),TimeRangeFilter.between(start,now)));day.put("steps",a[StepsRecord.COUNT_TOTAL]?:JSONObject.NULL)}
      if(caps["exercise"]==true){
       var page:String?=null;val workouts=JSONArray();var pages=0
       do {
        val result=h.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class,TimeRangeFilter.between(now.minusSeconds(86400),now),pageSize=500,pageToken=page))
        for(w in result.records)if(w.endTime<=now){
         val minutes=java.time.Duration.between(w.startTime,w.endTime).seconds/60.0
         workouts.put(JSONObject().put("id",w.metadata.id).put("name",w.title?:"Workout").put("start",w.startTime.toString()).put("end",w.endTime.toString()).put("minutes",minutes))
        }
        page=result.pageToken;pages++
       }while(!page.isNullOrEmpty()&&pages<5)
       day.put("workouts",workouts)
       day.put("minutes",(0 until workouts.length()).map{workouts.getJSONObject(it)}.filter{Instant.parse(it.getString("end"))>=start}.sumOf{it.optDouble("minutes",0.0)})
      }
      updates.put(date.toString(),day);healthStatus="Background health check completed"
     }
    }catch(e:Exception){healthStatus="Health read unavailable; check Health Connect permissions"}
   }
   synchronized(NudgeStorage.lock){
    val latest=runCatching{JSONObject(p.getString("config","{}")!!)}.getOrDefault(JSONObject())
    if(latest.optString("uid")!=config.optString("uid")||latest.optJSONObject("settings")?.optBoolean("enabled")!=true||latest.getJSONObject("settings").optString("enabledAt")!=config.getJSONObject("settings").optString("enabledAt"))return@synchronized
    val days=latest.optJSONObject("days")?:JSONObject()
    for(d in updates.keys()){val value=days.optJSONObject(d)?:JSONObject();val update=updates.getJSONObject(d);for(k in update.keys()){
      if(k=="minutes")value.put(k,maxOf(value.optDouble(k,0.0),update.optDouble(k,0.0))) else value.put(k,update.get(k))
     };days.put(d,value)}
    latest.put("days",days)
    val ledger=JSONObject(p.getString("ledger","{}")!!)
    for(k in ledger.keys().asSequence().toList())if(ledger.optLong(k)<now.minusSeconds(14*86400).toEpochMilli())ledger.remove(k)
    val notice=NudgeEngine.choose(latest,ledger,now)
    p.edit().putString("lastCheck",now.toString()).putString("healthStatus",healthStatus).commit()
    if(notice!=null&&NotificationManagerCompat.from(c).areNotificationsEnabled()){
     val manager=c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
     manager.createNotificationChannel(NotificationChannel(NudgeStorage.CHANNEL,"Ember smart nudges",NotificationManager.IMPORTANCE_DEFAULT))
     val intent=Intent(Intent.ACTION_VIEW,Uri.parse("fitlens://${notice.route}")).setPackage(c.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
     val id=notice.key.hashCode() and Int.MAX_VALUE
     val action=PendingIntent.getActivity(c,id,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
     val notification=NotificationCompat.Builder(c,NudgeStorage.CHANNEL).setSmallIcon(R.drawable.fitlens_nudge_icon).setContentTitle(notice.title).setContentText(notice.body).setStyle(NotificationCompat.BigTextStyle().bigText(notice.body)).setContentIntent(action).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setOnlyAlertOnce(true).build()
     manager.notify(NudgeStorage.CHANNEL,id,notification)
     ledger.put(notice.key,now.toEpochMilli());p.edit().putString("ledger",ledger.toString()).putString("lastNotice",notice.title).commit()
    }
   }
   Result.success()
  }catch(e:Exception){synchronized(NudgeStorage.lock){if(p.getString("config",null)==original)p.edit().putString("healthStatus","Check could not complete; it will retry later").commit()};Result.retry()}
 }
}
