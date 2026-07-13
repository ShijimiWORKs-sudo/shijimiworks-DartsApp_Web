import { StyleSheet, Text } from 'react-native';

import { Card } from '../Card';
import { colors } from '../../constants/theme';
import { localAccountNotice } from './accountUiModel';

export function AccountLocalNotice() {
  return (
    <Card muted>
      <Text style={styles.title}>ローカルAccount</Text>
      <Text style={styles.body}>{localAccountNotice}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  body: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
