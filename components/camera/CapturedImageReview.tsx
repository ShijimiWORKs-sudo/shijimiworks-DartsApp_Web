import { Image, StyleSheet, Text, View } from 'react-native';

import { Card } from '../Card';
import { SectionTitle } from '../SectionTitle';
import { colors } from '../../constants/theme';
import type { CapturedBoardImage } from '../../features/camera/domain/types';

type CapturedImageReviewProps = {
  image: CapturedBoardImage;
};

export function CapturedImageReview({ image }: CapturedImageReviewProps) {
  return (
    <Card>
      <SectionTitle
        title="撮影画像"
        subtitle="画像はDBへ保存せず、この画面セッション内だけで扱います。"
        tone="card"
      />
      <Image source={{ uri: image.uri }} resizeMode="contain" style={styles.preview} />
      <View style={styles.metaList}>
        <Text style={styles.metaText}>
          {image.width} x {image.height}
        </Text>
        <Text style={styles.metaText}>
          {image.platform === 'web' ? 'Web base64 image' : 'Native cache URI'}
        </Text>
        <Text style={styles.metaText}>Camera: {image.facing}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  metaList: {
    gap: 4,
    marginTop: 12,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
