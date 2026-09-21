package expo.modules.fitlensvoice

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.DataType
import java.nio.ByteBuffer
import java.nio.ByteOrder

class FitLensFoodModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FitLensFood")
    AsyncFunction("classify") { encoded: String ->
      require(encoded.length < 8_000_000) { "Photo is too large. Choose a smaller image." }
      val assets = appContext.reactContext!!.assets
      val bytes = assets.open("aiy-food-v1.tflite").use { it.readBytes() }
      val model = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).put(bytes)
      model.rewind()
      val imageBytes = Base64.decode(encoded, Base64.DEFAULT)
      val original = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
        ?: throw IllegalArgumentException("Could not read this photo.")
      try {
        Interpreter(model, Interpreter.Options().setNumThreads(2)).use { engine ->
          val tensor = engine.getInputTensor(0)
          require(tensor.dataType() == DataType.UINT8 && tensor.shape().contentEquals(intArrayOf(1,192,192,3))) { "Unexpected food model input." }
          val resized = Bitmap.createScaledBitmap(original, 192, 192, true)
          val pixels = IntArray(192 * 192)
          resized.getPixels(pixels, 0, 192, 0, 0, 192, 192)
          if (resized !== original) resized.recycle()
          val input = ByteBuffer.allocateDirect(pixels.size * 3).order(ByteOrder.nativeOrder())
          for (pixel in pixels) {
            input.put(((pixel shr 16) and 255).toByte())
            input.put(((pixel shr 8) and 255).toByte())
            input.put((pixel and 255).toByte())
          }
          input.rewind()
          val output = ByteBuffer.allocateDirect(2024).order(ByteOrder.nativeOrder())
          engine.run(input, output)
          val labels = JSONArray(assets.open("aiy-food-labels.json").bufferedReader().use { it.readText() })
          val quant = engine.getOutputTensor(0).quantizationParams()
          (0 until 2024).map { index ->
            val score = ((output.get(index).toInt() and 255) - quant.zeroPoint) * quant.scale
            Triple(index, labels.getString(index), score.toDouble())
          }.sortedByDescending { it.third }.take(5).map {
            mapOf("index" to it.first, "name" to it.second, "score" to it.third)
          }
        }
      } finally { original.recycle() }
    }
  }
}
