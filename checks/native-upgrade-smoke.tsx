// Isolated com.fitlens.smoke only. Checks model cleanup and interval notifications.
import React, { useEffect } from "react";
import { Text } from "react-native";
import { File, Directory, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { removeRetiredModels } from "../mobile/src/features/retiredModels";
import * as N from "expo-notifications";
import { useAuthStore } from "../mobile/src/store/authStore";
import { localReminderDraft } from "../mobile/src/features/reminderDomain";
import {
  saveCustomReminder,
  saveReminderBatch,
  listCustomReminders,
  pauseCustomReminder,
} from "../mobile/src/features/customReminders";
export default function UpgradeSmoke() {
  useEffect(() => {
    const result: Record<string, unknown> = {},
      uid = "isolated-upgrade-check";
    async function run() {
      await AsyncStorage.removeItem("fitlens:models-removed-v2.2");
      const old = new Directory(Paths.document, "react-native-executorch");
      old.create({ idempotent: true, intermediates: true });
      new File(old, "retired-model-test").write("old");
      const keep = new File(Paths.document, "keep-diary-test.txt");
      keep.write("preserve");
      await removeRetiredModels();
      if (old.exists || !keep.exists || (await keep.text()) !== "preserve")
        throw new Error(
          "Model cleanup touched unrelated data or missed old files",
        );
      result.cleanup = "passed";
      await N.cancelAllScheduledNotificationsAsync();
      useAuthStore.setState({ user: { id: uid } as any });
      for (const r of await listCustomReminders(uid))
        await pauseCustomReminder(uid, r.id, true);
      const d = localReminderDraft("Drink water at regular intervals in 24hrs");
      await saveCustomReminder(uid, d);
      let [saved] = await listCustomReminders(uid);
      let pending = await N.getAllScheduledNotificationsAsync();
      if (pending.length !== 7)
        throw new Error("Expected seven daytime notifications");
      result.daytime = pending.length;
      await saveCustomReminder(uid, { ...d, intervalHours: 4 }, saved);
      [saved] = await listCustomReminders(uid);
      pending = await N.getAllScheduledNotificationsAsync();
      if (pending.length !== 4)
        throw new Error("Editing left stale notifications");
      result.edited = pending.length;
      await pauseCustomReminder(uid, saved.id);
      if ((await N.getAllScheduledNotificationsAsync()).length)
        throw new Error("Pause failed");
      [saved] = await listCustomReminders(uid);
      await saveCustomReminder(uid, { ...d, quietHours: false }, saved);
      if ((await N.getAllScheduledNotificationsAsync()).length !== 12)
        throw new Error("Expected 12 overnight notifications");
      result.overnight = 12;
      [saved] = await listCustomReminders(uid);
      await pauseCustomReminder(uid, saved.id, true);
      if ((await N.getAllScheduledNotificationsAsync()).length)
        throw new Error("Delete failed");
      const batch=[8,13,19].map((hour,i)=>({id:'meal-test-'+i,draft:{title:['Breakfast','Lunch','Dinner'][i],body:'Meal time',hour,minute:i===2?30:0,cadence:'daily' as const,quietHours:true}}));
      await saveReminderBatch(uid,batch);
      const mealTriggers=await N.getAllScheduledNotificationsAsync();
      if(mealTriggers.length!==3)throw Error('Expected three separate meal reminders');
      await saveReminderBatch(uid,batch);
      if((await N.getAllScheduledNotificationsAsync()).length!==3)throw Error('Batch retry duplicated reminders');
      result.mealBatch='passed';
      for(const r of await listCustomReminders(uid))await pauseCustomReminder(uid,r.id,true);
      result.status = "passed";
    }
    run()
      .catch((e) => {
        result.status = "failed";
        result.error = String(e);
      })
      .finally(() =>
        new File(Paths.document, "fitlens-ai-smoke.json").write(
          JSON.stringify(result),
        ),
      );
  }, []);
  return <Text>Testing FitLens upgrade…</Text>;
}
