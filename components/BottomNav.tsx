import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../contexts/AppStateContext';

const tabs = [
  { href: '/home', icon: '⌂', label: 'ホーム' },
  { href: '/practice', icon: '◎', label: '練習' },
  { href: '/records', icon: '+', label: '記録' },
  { href: '/analysis', icon: '↗', label: '分析' },
  { href: '/consult', icon: '?', label: '相談' },
] as const;

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useAppState();

  return (
    <View style={[styles.nav, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || (tab.href !== '/home' && pathname.startsWith(`${tab.href}/`));

        return (
          <Pressable
            key={tab.href}
            accessibilityRole="button"
            accessibilityLabel={`${tab.label}へ移動`}
            onPress={() => router.push(tab.href)}
            style={({ pressed }) => [
              styles.item,
              active && { backgroundColor: theme.primarySoft },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.icon, { color: active ? theme.primaryDark : theme.textMuted }]}>
              {tab.icon}
            </Text>
            <Text style={[styles.label, { color: active ? theme.primaryDark : theme.textMuted }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    gap: 6,
    padding: 7,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  item: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  pressed: {
    opacity: 0.75,
  },
  icon: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  label: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '800',
  },
});
