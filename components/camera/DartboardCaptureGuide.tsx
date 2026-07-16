import { StyleSheet, Text, View } from 'react-native';

export function DartboardCaptureGuide() {
  return (
    <View pointerEvents="none" style={styles.overlay} testID="dartboard-capture-guide">
      <View style={styles.boardRing}>
        <View style={styles.innerRing} />
      </View>
      <Text style={styles.guideText}>ボード全体を枠内に合わせて撮影</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  boardRing: {
    width: '76%',
    maxWidth: 420,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  innerRing: {
    width: '42%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  guideText: {
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
