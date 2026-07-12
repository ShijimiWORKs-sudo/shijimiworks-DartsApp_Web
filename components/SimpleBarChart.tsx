import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { useAppState } from '../contexts/AppStateContext';

export type SimpleBarChartItem = {
  label: string;
  value: number;
  color?: string;
};

type SimpleBarChartProps = {
  data: SimpleBarChartItem[];
  emptyMessage?: string;
  maxValue?: number;
};

export function SimpleBarChart({
  data,
  emptyMessage = 'まだグラフを表示できる記録がありません',
  maxValue,
}: SimpleBarChartProps) {
  const { theme } = useAppState();
  const visibleData = data.filter((item) => Number.isFinite(item.value));
  const chartMax = Math.max(maxValue ?? 0, ...visibleData.map((item) => item.value), 1);

  if (visibleData.length === 0) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: theme.surfaceMuted }]}>
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.chart}>
        {visibleData.map((item, index) => {
          const maxBarHeight = visibleData.length === 1 ? 64 : 88;
          const height = Math.max(12, Math.round((item.value / chartMax) * maxBarHeight));

          return (
            <View key={`${item.label}-${index}`} style={styles.item}>
              <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: item.color ?? colors.primary,
                    },
                  ]}
                />
              </View>
              <Text numberOfLines={1} style={[styles.value, { color: theme.text }]}>
                {item.value}
              </Text>
              <Text numberOfLines={1} style={[styles.label, { color: theme.textMuted }]}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
      {visibleData.length === 1 ? (
        <Text style={[styles.hintText, { color: theme.textMuted }]}>
          記録が増えると推移を比較できます
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    minHeight: 136,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  item: {
    flex: 1,
    minWidth: 24,
    alignItems: 'center',
  },
  track: {
    width: '100%',
    height: 96,
    justifyContent: 'flex-end',
    borderRadius: 8,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  value: {
    marginTop: 6,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  label: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  hintText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    minHeight: 96,
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
