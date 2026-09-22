package expo.modules.fitlenswidgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FitLensWidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FitLensWidgets")
    Function("update") { json: String ->
      val context = appContext.reactContext ?: return@Function
      context.getSharedPreferences("fitlens_widgets", Context.MODE_PRIVATE).edit().putString("snapshot", json).apply()
      FitLensWidget.renderAll(context)
    }
    Function("pin") { kind: String ->
      val context = appContext.reactContext ?: return@Function false
      val manager = AppWidgetManager.getInstance(context)
      if (Build.VERSION.SDK_INT >= 26 && manager.isRequestPinAppWidgetSupported) {
        manager.requestPinAppWidget(ComponentName(context, when(kind) { "water" -> WaterWidget::class.java; "coach" -> CoachWidget::class.java; else -> TodayWidget::class.java }), null, null)
      } else false
    }
  }
}

abstract class FitLensWidget : AppWidgetProvider() {
  abstract val kind: String
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { render(context, manager, it, kind) }
  }
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == Intent.ACTION_DATE_CHANGED || intent.action == Intent.ACTION_TIMEZONE_CHANGED) renderAll(context)
  }
  companion object {
    fun renderAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      listOf(TodayWidget::class.java to "today", WaterWidget::class.java to "water", CoachWidget::class.java to "coach").forEach { (cls,kind) ->
        manager.getAppWidgetIds(ComponentName(context,cls)).forEach { render(context,manager,it,kind) }
      }
    }
    private fun link(context: Context, route: String): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("fitlens://$route"), context, Class.forName("${context.packageName}.MainActivity"))
      intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      return PendingIntent.getActivity(context,route.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    fun render(context: Context, manager: AppWidgetManager, id: Int, kind: String) {
      val raw=context.getSharedPreferences("fitlens_widgets",Context.MODE_PRIVATE).getString("snapshot","{}") ?: "{}"
      val data=try { JSONObject(raw) } catch(e:Exception) { JSONObject() }
      val signedIn=data.optBoolean("signedIn",false)
      val today=SimpleDateFormat("yyyy-MM-dd",Locale.US).format(Date())
      val fresh=data.optString("date")==today
      val hidden=!data.optBoolean("showNutrition",true)
      val cream=data.optString("theme")=="cream"
      val accent=Color.parseColor(if(cream) "#385321" else "#d1fa70")
      val ink=Color.parseColor(if(cream) "#192414" else "#f4f5ef")
      val muted=Color.parseColor(if(cream) "#596451" else "#a2a99e")
      val views=RemoteViews(context.packageName,R.layout.fitlens_widget)
      views.setInt(R.id.widget_root,"setBackgroundResource",if(cream)R.drawable.fitlens_widget_cream else R.drawable.fitlens_widget_dark)
      views.setTextColor(R.id.widget_brand,accent);views.setTextColor(R.id.widget_value,ink);views.setTextColor(R.id.widget_detail,muted)
      views.setTextColor(R.id.widget_action,accent);views.setTextColor(R.id.widget_secondary,accent)
      views.setTextViewText(R.id.widget_brand,if(data.optBoolean("demo")) "FITKIN · DEMO" else "FITKIN · ${if(kind=="water")"HYDRATION" else if(kind=="coach")"DAILY COACH" else "TODAY"}")
      val value=when { !signedIn -> "Your daily spark"; !fresh -> "A fresh day"; kind=="water" -> "${data.optInt("water")} ml"; kind=="coach" -> "${data.optInt("streak")} day streak"; hidden -> "${data.optInt("foods")} foods logged"; else -> "${data.optInt("calories")} kcal" }
      val detail=when { !signedIn -> "Open Fitkin to get started"; !fresh -> "Open the app to refresh today"; kind=="water" -> "of ${data.optInt("waterGoal",2000)} ml · last app update"; kind=="coach" -> "A private review, one little win at a time"; hidden -> "Your nutrition totals are hidden"; else -> "of ${data.optInt("goal",2000)} kcal · ${data.optInt("water")} ml water" }
      views.setTextViewText(R.id.widget_value,value);views.setTextViewText(R.id.widget_detail,detail)
      views.setTextViewText(R.id.widget_action,if(kind=="water")"LOG WATER  +" else if(kind=="coach")"REVIEW MY DAY  ›" else "LOG FOOD  +")
      views.setTextViewText(R.id.widget_secondary,if(kind=="today")"WATER  +" else "OPEN APP  ›")
      views.setOnClickPendingIntent(R.id.widget_action,link(context,if(kind=="water")"water" else if(kind=="coach")"coach" else "log"))
      views.setOnClickPendingIntent(R.id.widget_secondary,link(context,if(kind=="today")"water" else "dashboard"))
      views.setOnClickPendingIntent(R.id.widget_root,link(context,"dashboard"))
      manager.updateAppWidget(id,views)
    }
  }
}
class TodayWidget : FitLensWidget() { override val kind="today" }
class WaterWidget : FitLensWidget() { override val kind="water" }
class CoachWidget : FitLensWidget() { override val kind="coach" }
