import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../../contexts/AppStateContext';
import { webPrimaryNavigationItems } from './webLayout';

export function WebTopNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useAppState();

  return (
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="HOMEへ移動"
        onPress={() => router.push('/home')}
        style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
      >
        <Text style={[styles.brandText, { color: theme.onBackground }]}>DartsApp</Text>
        <Text style={[styles.brandSubtext, { color: theme.onBackgroundMuted }]}>PC Web</Text>
      </Pressable>
      <View style={styles.navItems}>
        {webPrimaryNavigationItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === '/game' && pathname.startsWith('/game/')) ||
            (item.href === '/account/profile' && pathname.startsWith('/account/'));

          return (
            <Pressable
              key={item.href}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}へ移動`}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [
                styles.navItem,
                active && { backgroundColor: theme.primarySoft },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.navLabel, { color: active ? theme.primaryDark : theme.textMuted }]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    borderBottomWidth: 1,
    paddingHorizontal: 32,
  },
  brand: {
    minHeight: 48,
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 20,
    fontWeight: '900',
  },
  brandSubtext: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  navItems: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navItem: {
    minWidth: 112,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
});
