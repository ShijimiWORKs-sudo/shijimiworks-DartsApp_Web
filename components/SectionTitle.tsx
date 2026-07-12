import { StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../contexts/AppStateContext';

type SectionTitleProps = {
  title: string;
  subtitle?: string;
  tone?: 'background' | 'card';
};

export function SectionTitle({ title, subtitle, tone = 'background' }: SectionTitleProps) {
  const { theme } = useAppState();
  const titleColor = tone === 'card' ? theme.onCard : theme.onBackground;
  const subtitleColor = tone === 'card' ? theme.onCardMuted : theme.onBackgroundMuted;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
});
