import React, { useState } from "react";
import { Modal, Platform, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Button, Card, C, T, Tap } from "../ui";
import { localDateKey } from "../../lib/dates";
export type PickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode: "date" | "time";
  maximumDate?: Date;
  testID?: string;
  compact?: boolean;
};
export function DateTimeField({
  label,
  value,
  onChange,
  mode,
  maximumDate,
  testID,
  compact,
}: PickerProps) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(new Date());
  function date() {
    const d = new Date(
      mode === "date" ? value + "T12:00:00" : "2000-01-01T" + value + ":00",
    );
    return Number.isFinite(+d) ? d : new Date();
  }
  function accept(d: Date) {
    onChange(
      mode === "date"
        ? localDateKey(d)
        : String(d.getHours()).padStart(2, "0") +
            ":" +
            String(d.getMinutes()).padStart(2, "0"),
    );
  }
  function show() {
    const v = date();
    setDraft(v);
    if (Platform.OS === "android")
      DateTimePickerAndroid.open({
        value: v,
        mode,
        maximumDate: mode === "date" ? maximumDate : undefined,
        is24Hour: false,
        onChange: (e, d) => {
          if (e.type === "set" && d) accept(d);
        },
      });
    else setOpen(true);
  }
  const display =
    mode === "time"
      ? date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : value === localDateKey()
        ? "Today"
        : date().toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
  return (
    <View style={{ gap: 8 }}>
      {!compact && (
        <T color={C.muted} size={13}>
          {label}
        </T>
      )}
      <Tap
        label={label}
        testID={testID}
        onPress={show}
        style={{
          padding: compact ? 8 : 16,
          borderRadius: 16,
          borderColor: C.border,
          borderWidth: compact ? 0 : 1,
          backgroundColor: C.elevated,
        }}
      >
        <T bold>{display} ▾</T>
      </Tap>
      <Modal visible={open} transparent onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "#0009",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card>
            <T bold>{label}</T>
            <DateTimePicker
              value={draft}
              mode={mode}
              display="spinner"
              themeVariant="dark"
              maximumDate={mode === "date" ? maximumDate : undefined}
              onChange={(_, d) => {
                if (d) setDraft(d);
              }}
            />
            <Button
              title="Done"
              onPress={() => {
                accept(draft);
                setOpen(false);
              }}
            />
            <Button secondary title="Cancel" onPress={() => setOpen(false)} />
          </Card>
        </View>
      </Modal>
    </View>
  );
}
