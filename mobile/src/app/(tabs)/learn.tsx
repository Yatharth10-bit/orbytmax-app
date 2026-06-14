import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, PageHeader, Pill, SectionTitle, StatusCard, textStyles } from '@/components/native-ui';
import { apiGet, type Satellite } from '@/lib/api';
import { satelliteParts } from '@/lib/education';
import { colors } from '@/lib/theme';

export default function LearnScreen() {
  const [missions, setMissions] = useState<Satellite[]>([]);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiGet<{ satellites: Satellite[] }>('/api/satellites?fast=1', { ttlMs: 5 * 60_000, staleTtlMs: 24 * 60 * 60_000, persist: true });
      setMissions(data.satellites);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mission library could not be loaded.');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  const isro = missions.filter((item) => item.agency?.toLowerCase().includes('isro')).slice(0, 4);
  const global = missions.filter((item) => !item.agency?.toLowerCase().includes('isro')).slice(0, 4);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
      <PageHeader eyebrow="Education hub" title="Learn space" copy="Open real mission details, inspect satellite parts, or test your orbit knowledge." />
      <Card color={colors.pink}>
        <Text style={textStyles.cardTitle}>Orbit Basics Quiz</Text>
        <Text style={textStyles.body}>Five randomized questions. Immediate feedback. New round every time.</Text>
        <ActionButton href="/quiz" label="Start quiz" />
      </Card>
      {error ? <StatusCard title="Library unavailable" copy={error} onRetry={load} /> : null}
      <SectionTitle>ISRO mission library</SectionTitle>
      {isro.map((mission) => <MissionCard key={mission.slug} mission={mission} color={colors.yellow} />)}
      <SectionTitle>NASA & global missions</SectionTitle>
      {global.map((mission) => <MissionCard key={mission.slug} mission={mission} color={colors.cyan} />)}
      <SectionTitle>Parts of a satellite</SectionTitle>
      {satelliteParts.map(([name, summary, why], index) => (
        <Card key={name} color={index % 2 ? colors.white : colors.green}>
          <View style={styles.partTop}>
            <Text style={styles.partNumber}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={[textStyles.cardTitle, styles.grow]}>{name}</Text>
          </View>
          <Text style={textStyles.body}>{summary}</Text>
          {expanded === name ? <Text style={styles.why}>Why it matters: {why}</Text> : null}
          <ActionButton label={expanded === name ? 'Close' : 'Why it matters'} tone={colors.white} onPress={() => setExpanded(expanded === name ? '' : name)} />
        </Card>
      ))}
    </ScrollView>
  );
}

function MissionCard({ mission, color }: { mission: Satellite; color: string }) {
  return (
    <Card color={color}>
      <Pill color={colors.white}>{mission.orbitType || mission.category || 'Mission'}</Pill>
      <Text style={textStyles.cardTitle}>{mission.name}</Text>
      <Text style={textStyles.body}>{mission.shortDescription || mission.description}</Text>
      <ActionButton href={`/satellite/${mission.slug}`} label="Open mission" />
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 120, gap: 16, backgroundColor: colors.paper },
  partTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  partNumber: { color: colors.ink, fontSize: 24, lineHeight: 28, fontWeight: '900' },
  grow: { flex: 1 },
  why: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '800' },
});
