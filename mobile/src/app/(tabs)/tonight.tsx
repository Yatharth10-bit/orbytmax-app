import { memo, useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, Card, PageHeader, Pill, StatusCard, textStyles } from '@/components/native-ui';
import { apiGet, countdown, readableTime, type Pass } from '@/lib/api';
import { colors, shadow } from '@/lib/theme';

type Location = { label: string; lat: number; lng: number };
const QUICK_CITIES = ['Bengaluru', 'Mumbai', 'Houston'];
const PASS_COLORS = [colors.white, colors.pink, colors.green];

export default function TonightScreen() {
  const [city, setCity] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const activeSearch = useRef<AbortController | null>(null);

  const search = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError('Enter a city name, such as Bengaluru or Houston.');
      return;
    }

    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    setLoading(true);
    setError('');
    try {
      const geoPath = `/api/geocode?query=${encodeURIComponent(trimmed)}`;
      const geo = await apiGet<{ location: Location }>(geoPath, { signal: controller.signal, ttlMs: 24 * 60 * 60_000, staleTtlMs: 30 * 24 * 60 * 60_000, persist: true });
      if (controller.signal.aborted) return;
      setLocation(geo.location);
      const passPath = `/api/passes?lat=${geo.location.lat}&lng=${geo.location.lng}`;
      const data = await apiGet<{ passes: Pass[] }>(passPath, { signal: controller.signal, ttlMs: 5 * 60_000, staleTtlMs: 60 * 60_000, persist: true });
      if (!controller.signal.aborted) setPasses(data.passes || []);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'City lookup failed. Check the spelling and try again.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const runSearch = useCallback(() => void search(city), [city, search]);
  const renderPass = useCallback(({ item, index }: { item: Pass; index: number }) => <PassCard pass={item} color={PASS_COLORS[index % PASS_COLORS.length]} />, []);

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.page}
      data={passes}
      initialNumToRender={3}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => `${item.name}-${item.start}`}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageHeader eyebrow="Visible passes" title="Tonight" copy="Searches are cached, so recent cities and pass results open immediately." />
          <Card color={colors.cyan}>
            <Text style={textStyles.meta}>City</Text>
            <TextInput
              accessibilityLabel="City name"
              autoCapitalize="words"
              enterKeyHint="search"
              onChangeText={setCity}
              onSubmitEditing={runSearch}
              placeholder="Bengaluru"
              placeholderTextColor={colors.muted}
              value={city}
              style={styles.input}
            />
            <View style={styles.quick}>
              {QUICK_CITIES.map((item) => (
                <ActionButton key={item} label={item} tone={colors.white} onPress={() => { setCity(item); void search(item); }} />
              ))}
            </View>
            <ActionButton label={loading ? 'Searching sky...' : 'Find visible passes'} onPress={runSearch} disabled={loading} />
          </Card>
          {loading ? <StatusCard loading title={location ? `Updating sky above ${location.label}` : 'Finding your city'} copy={passes.length ? 'Keeping current results visible while fresh passes load...' : 'Resolving location and calculating passes...'} /> : null}
          {error ? <StatusCard title="Could not search that sky" copy={error} onRetry={runSearch} /> : null}
          {!loading && !error && location && passes.length === 0 ? <StatusCard title="Quiet sky tonight" copy={`No visible satellite passes were found near ${location.label}. Try again later or search another city.`} onRetry={runSearch} /> : null}
        </View>
      }
      maxToRenderPerBatch={3}
      removeClippedSubviews
      renderItem={renderPass}
      updateCellsBatchingPeriod={40}
      windowSize={5}
    />
  );
}

const PassCard = memo(function PassCard({ pass, color }: { pass: Pass; color: string }) {
  return (
    <Card color={color}>
      <View style={styles.passTop}>
        <Pill>{countdown(pass.start)}</Pill>
        <Text style={textStyles.meta}>{pass.direction || 'Sky pass'}</Text>
      </View>
      <Text style={textStyles.cardTitle}>{pass.name}</Text>
      <Text style={styles.time}>{readableTime(pass.start)}</Text>
      <Text style={textStyles.body}>
        {pass.maxElevation ? `${Math.round(pass.maxElevation)} deg max elevation` : 'Elevation estimate pending'}
        {pass.durationSec ? ` · ${Math.round(pass.durationSec / 60)} min` : ''}
        {pass.brightness ? ` · ${pass.brightness}` : ''}
      </Text>
      <ActionButton href={pass.slug ? `/satellite/${pass.slug}` : '/tracker'} label={pass.slug ? 'View satellite' : 'Follow live'} />
    </Card>
  );
});

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 120, gap: 16, backgroundColor: colors.paper },
  header: { gap: 16 },
  input: { minHeight: 52, borderWidth: 2, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.white, color: colors.ink, paddingHorizontal: 14, fontSize: 18, fontWeight: '800', ...shadow },
  quick: { gap: 10 },
  passTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  time: { color: colors.ink, fontSize: 28, lineHeight: 32, fontWeight: '900' },
});
