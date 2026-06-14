import { Link, type Href } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, shadow } from '@/lib/theme';

export function PageHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.copy}>{copy}</Text>
    </View>
  );
}

export function SectionTitle({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function Card({ children, color = colors.white, style }: PropsWithChildren<{ color?: string; style?: ViewStyle }>) {
  return <View style={[styles.card, { backgroundColor: color }, style]}>{children}</View>;
}

export function Pill({ children, color = colors.yellow }: PropsWithChildren<{ color?: string }>) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  href,
  tone = colors.ink,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  href?: Href;
  tone?: string;
  disabled?: boolean;
}) {
  const button = (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: tone },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Text style={[styles.buttonText, { color: tone === colors.ink ? colors.white : colors.ink }]}>{label}</Text>
    </Pressable>
  );
  return href ? <Link href={href} asChild>{button}</Link> : button;
}

export function StatusCard({
  title,
  copy,
  loading,
  onRetry,
}: {
  title: string;
  copy: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <Card color={colors.white} style={styles.status}>
      {loading ? <ActivityIndicator color={colors.ink} size="large" /> : <Text style={styles.statusSymbol}>✦</Text>}
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusCopy}>{copy}</Text>
      {onRetry ? <ActionButton label="Try again" onPress={onRetry} tone={colors.yellow} /> : null}
    </Card>
  );
}

export const textStyles = StyleSheet.create({
  cardTitle: { color: colors.ink, fontSize: 19, lineHeight: 23, fontWeight: '900' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.ink, fontSize: 12, lineHeight: 16, fontWeight: '800', textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  header: { gap: 8, paddingTop: 8, paddingBottom: 8 },
  eyebrow: { color: colors.ink, fontSize: 12, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 38, lineHeight: 40, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 560 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  sectionTitle: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: '900', flexShrink: 1 },
  card: { borderWidth: 2, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 10, ...shadow },
  pill: { alignSelf: 'flex-start', borderWidth: 2, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { color: colors.ink, fontWeight: '900', fontSize: 11, lineHeight: 14, textTransform: 'uppercase' },
  button: { minHeight: 46, borderWidth: 2, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', ...shadow },
  buttonText: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  pressed: { transform: [{ translateX: 3 }, { translateY: 3 }], shadowOffset: { width: 1, height: 1 } },
  disabled: { opacity: 0.45 },
  status: { alignItems: 'center', paddingVertical: 28 },
  statusSymbol: { color: colors.ink, fontSize: 30 },
  statusTitle: { color: colors.ink, fontSize: 20, lineHeight: 24, fontWeight: '900', textAlign: 'center' },
  statusCopy: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
