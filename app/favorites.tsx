import { useRouter } from 'expo-router';
import { Text, StyleSheet } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { PracticeMenuCard } from '../components/PracticeMenuCard';
import { ScreenShell } from '../components/ScreenShell';
import { SectionTitle } from '../components/SectionTitle';
import { practiceMenus } from '../constants/practiceMenus';
import { colors } from '../constants/theme';
import { useAppState } from '../contexts/AppStateContext';

export default function FavoritesScreen() {
  const router = useRouter();
  const { favoritePracticeMenuIds, isFavoritePracticeMenu, toggleFavoritePracticeMenu } =
    useAppState();
  const favoriteMenus = practiceMenus.filter((menu) => favoritePracticeMenuIds.includes(menu.id));

  return (
    <ScreenShell>
      <SectionTitle title="お気に入り練習" subtitle="よく使う練習メニューをすぐ開けます。" />

      {favoriteMenus.length === 0 ? (
        <Card muted>
          <Text style={styles.emptyTitle}>お気に入り練習はまだありません</Text>
          <Text style={styles.emptyText}>
            今日の練習や練習詳細で「☆ お気に入り」を押すとここに表示されます。
          </Text>
        </Card>
      ) : (
        favoriteMenus.map((menu) => (
          <PracticeMenuCard
            key={menu.id}
            menu={menu}
            isFavorite={isFavoritePracticeMenu(menu.id)}
            onViewDetails={() => router.push(`/practice/${menu.id}`)}
            onRecord={() =>
              router.push({ pathname: '/record', params: { practiceMenuId: menu.id } })
            }
            onToggleFavorite={() => void toggleFavoritePracticeMenu(menu.id)}
          />
        ))
      )}

      <AppButton
        label="今日の練習へ"
        onPress={() => router.push('/practice')}
        variant="secondary"
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
});
