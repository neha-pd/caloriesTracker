package expo.modules.fitlensvoice

import android.app.ActivityManager
import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.Promise
import java.util.Locale

class FitLensVoiceModule : Module() {
  private var tts: TextToSpeech? = null
  private var ready = false
  override fun definition() = ModuleDefinition {
    Name("FitLensVoice")
    Events("speechState")
    Function("memory") {
      val info = ActivityManager.MemoryInfo()
      (appContext.reactContext!!.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(info)
      mapOf("availableBytes" to info.availMem, "totalBytes" to info.totalMem)
    }
    AsyncFunction("prepare") { promise: Promise ->
      if (ready) { promise.resolve(true) }
      else if (tts != null) { promise.reject("BUSY", "Voice is starting. Try again.", null) }
      else {
        tts = TextToSpeech(appContext.reactContext!!) { status ->
          ready = status == TextToSpeech.SUCCESS
          if (ready) {
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
              override fun onStart(id: String?) { sendEvent("speechState", mapOf("speaking" to true)) }
              override fun onDone(id: String?) { sendEvent("speechState", mapOf("speaking" to false)) }
              @Deprecated("Legacy callback")
              override fun onError(id: String?) { sendEvent("speechState", mapOf("speaking" to false, "error" to "Could not play the offline voice.")) }
            })
            promise.resolve(true)
          } else {
            tts?.shutdown(); tts = null
            promise.reject("NO_VOICE", "Install an offline text-to-speech voice in Android settings.", null)
          }
        }
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("speak") { text: String, language: String ->
      val engine = tts ?: throw IllegalStateException("Prepare voice first.")
      val wanted = Locale.forLanguageTag(language)
      val voice = engine.voices?.filter { !it.isNetworkConnectionRequired && it.locale.language == wanted.language && !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) }
        ?.sortedWith(compareByDescending<android.speech.tts.Voice> { it.locale.country == wanted.country }.thenByDescending { it.quality })?.firstOrNull()
        ?: throw IllegalStateException("No offline voice for this language. Install voice data in Android text-to-speech settings.")
      if (engine.setVoice(voice) != TextToSpeech.SUCCESS) throw IllegalStateException("The offline voice could not load.")
      engine.setSpeechRate(0.95f)
      if (engine.speak(text.take(3500), TextToSpeech.QUEUE_FLUSH, null, "fitlens-reply") != TextToSpeech.SUCCESS) throw IllegalStateException("Could not speak. Check Android voice settings.")
    }.runOnQueue(Queues.MAIN)
    Function("stop") { tts?.stop(); sendEvent("speechState", mapOf("speaking" to false)) }
    OnDestroy { tts?.stop(); tts?.shutdown(); tts = null; ready = false }
  }
}
