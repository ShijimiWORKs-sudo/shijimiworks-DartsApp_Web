import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../AppButton';
import { colors } from '../../constants/theme';
import type { AwardAsset, AwardEvent } from '../../features/awards/domain/types';

export function AwardOverlay({
  event,
  asset,
  onSkip,
}: {
  event: AwardEvent | null;
  asset: AwardAsset | null;
  onSkip: () => void;
}) {
  if (!event || !asset) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>再生待ちのAwardはありません。</Text>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <Text style={styles.label}>{asset.label}</Text>
      <Text style={styles.meta}>
        {asset.videoUri ? 'video' : 'fallback'} / {asset.audioUri ? 'audio' : 'silent'} /{' '}
        {asset.fallbackAnimation}
      </Text>
      <Text style={styles.meta}>再生PC: {event.playbackOwner}</Text>
      <AppButton label="スキップ" onPress={onSkip} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: 18,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  overlay: {
    gap: 10,
    paddingVertical: 18,
  },
  label: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
});
