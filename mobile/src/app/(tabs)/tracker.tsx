import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, PageHeader, Pill, StatusCard, textStyles } from '@/components/native-ui';
import { apiGet, type Position } from '@/lib/api';
import { colors } from '@/lib/theme';

const TRACKER_PATH = '/api/tracker/positions?limit=12';

export default function TrackerScreen() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [followed, setFollowed] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setInitialLoading(true);
    setError('');
    try {
      const path = force ? `${TRACKER_PATH}&refresh=1` : TRACKER_PATH;
      const data = await apiGet<{ positions: Position[] }>(path, {
        ttlMs: force ? 5_000 : 30_000,
        staleTtlMs: force ? 5_000 : 6 * 60 * 60_000,
        force,
        persist: !force,
      });
      setPositions(data.positions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Live positions could not be loaded.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const sortedPositions = useMemo(
    () => followed ? [...positions].sort((a, b) => Number(b.name === followed) - Number(a.name === followed)) : positions,
    [followed, positions],
  );

  const renderPosition = useCallback(
    ({ item }: { item: Position }) => (
      <PositionCard position={item} followed={item.name === followed} onFollow={setFollowed} />
    ),
    [followed],
  );

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.page}
      data={sortedPositions}
      initialNumToRender={4}
      keyExtractor={(item) => item.name}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageHeader eyebrow="Live orbit board" title="Right now" copy="Cached positions appear immediately. Pull to request fresh orbit data." />
          {followed ? <Card color={colors.yellow}><Text style={textStyles.meta}>Following</Text><Text style={textStyles.cardTitle}>{followed}</Text></Card> : null}
          {initialLoading && positions.length === 0 ? <StatusCard loading title="Opening orbit board" copy="Loading the latest cached positions..." /> : null}
          {error ? <StatusCard title="Live data unavailable" copy={error} onRetry={() => void load()} /> : null}
        </View>
      }
      ListEmptyComponent={!initialLoading && !error ? <StatusCard title="No positions found" copy="Refresh to ask mission control again." onRetry={() => void load(true)} /> : null}
      maxToRenderPerBatch={4}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.ink} />}
      removeClippedSubviews
      renderItem={renderPosition}
      updateCellsBatchingPeriod={40}
      windowSize={5}
    />
  );
}

const PositionCard = memo(function PositionCard({
  position,
  followed,
  onFollow,
}: {
  position: Position;
  followed: boolean;
  onFollow: (name: string) => void;
}) {
  return (
    <Card color={followed ? colors.green : colors.white}>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Pill color={colors.cyan}>{position.category || 'orbiting'}</Pill>
          <Text style={textStyles.cardTitle}>{position.name}</Text>
        </View>
        <Text style={styles.alt}>{Math.round(position.alt)} km</Text>
      </View>
      <Text style={textStyles.body}>Lat {position.lat.toFixed(2)} deg · Lon {position.lon.toFixed(2)} deg</Text>
      <ActionButton label={followed ? 'Following' : 'Follow'} onPress={() => onFollow(position.name)} tone={followed ? colors.green : colors.ink} />
    </Card>
  );
});

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 120, gap: 16, backgroundColor: colors.paper },
  header: { gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  grow: { flex: 1, gap: 8 },
  alt: { color: colors.ink, fontSize: 16, lineHeight: 20, fontWeight: '900' },
});
