package expo.modules.fitlensmaintenance
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import java.io.File
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
class FitLensMaintenanceModule: Module() {
  override fun definition() = ModuleDefinition {
    Name("FitLensMaintenance")
    AsyncFunction("removeRetiredModels") {
      val context=appContext.reactContext ?: return@AsyncFunction false
      val roots=listOfNotNull(context.getExternalFilesDir(null),context.filesDir).map { File(it,"react-native-executorch").canonicalFile }
      val manager=context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      // DownloadManager only exposes downloads owned by this app. Cancel only the retired model directory.
      manager.query(DownloadManager.Query())?.use { cursor ->
        val pathIndex=cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)
        val idIndex=cursor.getColumnIndex(DownloadManager.COLUMN_ID)
        while(cursor.moveToNext()) {
          val path=if(pathIndex>=0) cursor.getString(pathIndex)?.let { Uri.parse(it).path } else null
          if(path!=null && roots.any { File(path).canonicalPath.startsWith(it.path+File.separator) }) manager.remove(cursor.getLong(idIndex))
        }
      }
      roots.all { !it.exists() || it.deleteRecursively() }
    }
  }
}
