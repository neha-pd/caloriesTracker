import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { MicronutrientTotal } from '@/store/logStore';

interface Props {
  micronutrients?: Record<string, MicronutrientTotal>;
  entryCount: number;
}

/**
 * Micronutrient totals exactly as the API reports them. Which nutrients exist
 * is decided server-side by what food data actually stores — nothing is
 * estimated here, and the section hides when the API sends none.
 */
export default function MicronutrientsCard({ micronutrients, entryCount }: Props) {
  const rows = Object.entries(micronutrients ?? {});
  if (rows.length === 0) return null;

  return (
    <View style={styles.section} testID="micronutrients">
      <View style={styles.sectionHeader}>
        <Text variant="subheading">Micronutrients</Text>
      </View>
      <Card>
        {entryCount === 0 ? (
          <Text variant="caption">Log food to see micronutrients.</Text>
        ) : (
          rows.map(([key, m], i) => {
            const hasData = m.entries_with_data > 0;
            const partial = hasData && m.entries_with_data < entryCount;
            return (
              <View key={key} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={styles.label}>
                  <Text variant="body" color={Colors.textPrimary}>
                    {m.label}
                  </Text>
                  {(partial || !hasData) && (
                    <Text variant="caption">
                      {hasData
                        ? `From ${m.entries_with_data} of ${entryCount} foods with data`
                        : 'No data for foods logged today'}
                    </Text>
                  )}
                </View>
                <Text variant="body" weight="bold" color={hasData ? Colors.textPrimary : Colors.textMuted}>
                  {hasData ? `${Math.round(m.total).toLocaleString()} ${m.unit}` : '—'}
                </Text>
              </View>
            );
          })
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  label: {
    flex: 1,
  },
});
