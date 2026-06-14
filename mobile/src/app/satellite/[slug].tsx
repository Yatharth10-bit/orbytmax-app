import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, PageHeader, Pill, SectionTitle, StatusCard, textStyles } from '@/components/native-ui';
import { apiGet, type Satellite } from '@/lib/api';
import { colors } from '@/lib/theme';

export default function SatelliteDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [satellite, setSatellite] = useState<Satellite | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<{ satellite: Satellite }>(`/api/satellites/${slug}?fast=1`, { ttlMs: 10 * 60_000, staleTtlMs: 24 * 60 * 60_000, persist: true });
      setSatellite(data.satellite);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mission detail could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (loading) return <View style={styles.center}><StatusCard loading title="Loading mission" copy="Receiving spacecraft details…" /></View>;
  if (error || !satellite) return <View style={styles.center}><StatusCard title="Mission unavailable" copy={error || 'No mission found.'} onRetry={load} /></View>;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
      <PageHeader eyebrow={satellite.agency || 'Space mission'} title={satellite.name} copy={satellite.description || satellite.shortDescription || 'Mission profile'} />
      <Card color={colors.cyan}>
        <View style={styles.tags}>
          <Pill color={colors.white}>{satellite.orbitType || 'Orbit'}</Pill>
          <Pill color={colors.yellow}>{satellite.launchDate || 'Active mission'}</Pill>
        </View>
        <Text style={textStyles.body}>Altitude: {satellite.altitude || 'Mission dependent'} · Inclination: {satellite.inclination || 'Mission dependent'}</Text>
        <ActionButton href="/tonight" label="Find visible passes" />
      </Card>
      <SectionTitle>Key facts</SectionTitle>
      {(satellite.facts || []).map((fact, index) => <Card key={fact} color={index % 2 ? colors.white : colors.green}><Text style={textStyles.cardTitle}>{index + 1}. {fact}</Text></Card>)}
      {satellite.timeline?.length ? <SectionTitle>Mission timeline</SectionTitle> : null}
      {satellite.timeline?.map((item) => <Card key={`${item.date}-${item.title}`} color={colors.yellow}><Text style={textStyles.meta}>{item.date}</Text><Text style={textStyles.cardTitle}>{item.title}</Text></Card>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 70, gap: 16, backgroundColor: colors.paper },
  center: { flex: 1, padding: 18, justifyContent: 'center', backgroundColor: colors.paper },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
