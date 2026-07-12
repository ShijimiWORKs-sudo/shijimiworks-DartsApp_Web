import { StyleSheet, Text, View } from 'react-native';

import { machineLabels } from '../constants/labels';
import { levelLabels } from '../constants/levels';
import { colors } from '../constants/theme';
import type { PracticeMenu } from '../types';
import { AppButton } from './AppButton';
import { Card } from './Card';
import { RoundIconButton } from './RoundIconButton';

type PracticeMenuCardProps = {
  menu: PracticeMenu;
  reason?: string;
  isFavorite?: boolean;
  onViewDetails: () => void;
  onRecord: () => void;
  onToggleFavorite?: () => void;
};

export function PracticeMenuCard({
  menu,
  reason,
  isFavorite = false,
  onViewDetails,
  onRecord,
  onToggleFavorite,
}: PracticeMenuCardProps) {
  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>{menu.title}</Text>
        <Text style={styles.badge}>{menu.durationMinutes}分</Text>
      </View>
      <Text style={styles.meta}>
        {levelLabels[menu.level]} /{' '}
        {menu.machineTypes.map((machine) => machineLabels[machine]).join('・')} /{' '}
        {menu.gameTypes.join('・')}
      </Text>
      {reason ? <Text style={styles.reason}>{trimSummary(reason, 58)}</Text> : null}
      <Text style={styles.purpose}>{trimSummary(menu.purpose, 68)}</Text>
      <View style={styles.tags}>
        {menu.tags.slice(0, 4).map((tag) => (
          <Text key={tag} style={styles.tag}>
            {tag}
          </Text>
        ))}
      </View>
      <View style={styles.actions}>
        <View style={styles.secondaryActions}>
          {onToggleFavorite ? (
            <AppButton
              label={isFavorite ? '★ 登録済み' : '☆ お気に入り'}
              onPress={onToggleFavorite}
              variant="secondary"
            />
          ) : null}
          <RoundIconButton
            accessibilityLabel={`${menu.title}の詳細を開く`}
            onPress={onViewDetails}
          />
        </View>
        <AppButton label="この練習を記録" onPress={onRecord} />
      </View>
    </Card>
  );
}

function trimSummary(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: colors.primarySoft,
  },
  meta: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  reason: {
    marginTop: 10,
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  purpose: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: colors.primarySoft,
  },
  actions: {
    gap: 10,
    marginTop: 14,
  },
  secondaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
