import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { Directory, Paths } from "expo-file-system";
export async function removeRetiredModels() {
  try {
    if ((await AsyncStorage.getItem("fitlens:models-removed-v2.2")) === "done")
      return;
    if (Platform.OS === "android") {
      const maintenance = requireOptionalNativeModule("FitLensMaintenance");
      if (!maintenance || !(await maintenance.removeRetiredModels())) return;
    } else if (Platform.OS === "ios") {
      const folder = new Directory(Paths.document, "react-native-executorch");
      if (folder.exists) folder.delete();
    }
    await AsyncStorage.multiRemove([
      "fitlens:local-ai",
      "fitlens:conversation-ai",
    ]);
    await AsyncStorage.setItem("fitlens:models-removed-v2.2", "done");
  } catch {
    /* Retry next launch; never block access to the diary. */
  }
}
