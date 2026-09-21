import React from "react";
import { View } from "react-native";
import { T, C } from "../ui";
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
  return (
    <View style={{ gap: 8 }}>
      {!compact && (
        <T color={C.muted} size={13}>
          {label}
        </T>
      )}
      <input
        aria-label={label}
        data-testid={testID}
        type={mode}
        value={value}
        max={
          mode === "date" && maximumDate ? localDateKey(maximumDate) : undefined
        }
        onChange={(e) => {
          if (e.target.validity.valid && e.target.value)
            onChange(e.target.value);
        }}
        style={{
          fontFamily: "inherit",
          fontSize: compact ? 14 : 16,
          color: C.text,
          colorScheme: "dark",
          background: C.elevated,
          border: "1px solid " + C.border,
          borderRadius: 14,
          padding: compact ? 8 : 15,
          minWidth: 0,
          width: "100%",
          boxSizing: "border-box",
        }}
      />
    </View>
  );
}
