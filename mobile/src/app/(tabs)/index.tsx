import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, PageHeader, Pill, SectionTitle, StatusCard, textStyles } from '@/components/native-ui';
import { apiGet, type Satellite } from '@/lib/api';
import { colors } from '@/lib/theme';

export default function HomeScreen() {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<{ satellites: Satellite[] }>('/api/satellites?fast=1', { ttlMs: 5 * 60_000, staleTtlMs: 24 * 60 * 60_000, persist: true });
      setSatellites(data.satellites.slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the OrbytMax server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.ink} />}
      contentContainerStyle={styles.page}>
      <PageHeader eyebrow="Native satellite companion" title="OrbytMax" copy="Track spacecraft, find visible passes, and learn how orbit works from your phone." />
      <Card color={colors.yellow} style={styles.hero}>
        <Text style={styles.heroSymbol}>◉</Text>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Your sky has traffic.</Text>
          <Text style={textStyles.body}>Use Live to refresh satellite positions or search your city in Tonight.</Text>
        </View>
      </Card>
      <View style={styles.actions}>
        <ActionButton href="/tracker" label="Open live tracker" tone={colors.cyan} />
        <ActionButton href="/tonight" label="What can I see?" tone={colors.pink} />
      </View>
      <SectionTitle>Featured missions</SectionTitle>
      {loading && satellites.length === 0 ? <StatusCard loading title="Calling mission control" copy="Loading the satellite catalog…" /> : null}
      {error ? <StatusCard title="Server out of range" copy={`${error} Check that the Next.js API is running on your computer.`} onRetry={load} /> : null}
      {satellites.map((sat, index) => (
        <Card key={sat.slug} color={[colors.white, colors.green, colors.cyan][index % 3]}>
          <View style={styles.cardTop}>
            <Pill>{sat.orbitType || sat.category || 'Mission'}</Pill>
            <Text style={textStyles.meta}>{sat.agency || 'Spacecraft'}</Text>
          </View>
          <Text style={textStyles.cardTitle}>{sat.name}</Text>
          <Text style={textStyles.body}>{sat.shortDescription || sat.description || 'Explore this mission.'}</Text>
          <ActionButton href={`/satellite/${sat.slug}`} label="View mission" />
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 120, gap: 16, backgroundColor: colors.paper },
  hero: { flexDirection: 'row', alignItems: 'center' },
  heroSymbol: { color: colors.ink, fontSize: 54, lineHeight: 60 },
  heroCopy: { flex: 1, gap: 5 },
  heroTitle: { color: colors.ink, fontSize: 22, lineHeight: 26, fontWeight: '900' },
  actions: { gap: 12 },
  cardTop: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'center' },
});
