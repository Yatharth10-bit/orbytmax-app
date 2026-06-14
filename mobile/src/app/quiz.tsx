import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Pill, textStyles } from '@/components/native-ui';
import { quizBank, shuffled, type QuizQuestion } from '@/lib/education';
import { colors } from '@/lib/theme';

function createRound() {
  return shuffled(quizBank).slice(0, 5).map((question) => ({ ...question, options: shuffled(question.options) }));
}

export default function QuizScreen() {
  const [round, setRound] = useState<QuizQuestion[]>(createRound);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [score, setScore] = useState(0);
  const question = round[index];
  const finished = index >= round.length;
  const rank = useMemo(() => score === 5 ? 'Orbital Genius' : score >= 4 ? 'Mission Specialist' : score >= 2 ? 'Satellite Spotter' : 'Orbit Rookie', [score]);

  function answer(option: string) {
    if (selected) return;
    setSelected(option);
    if (option === question.answer) setScore((value) => value + 1);
  }

  function next() {
    setIndex((value) => value + 1);
    setSelected('');
  }

  function restart(newQuestions: boolean) {
    if (newQuestions) setRound(createRound());
    setIndex(0);
    setSelected('');
    setScore(0);
  }

  if (finished) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
        <Card color={score >= 4 ? colors.green : colors.yellow} style={styles.result}>
          <Text style={styles.resultScore}>{score}/5</Text>
          <Text style={styles.resultRank}>{rank}</Text>
          <Text style={textStyles.body}>Round complete. Every new round selects five questions from a bank of twenty.</Text>
          <ActionButton label="Play again" onPress={() => restart(false)} />
          <ActionButton label="New questions" tone={colors.cyan} onPress={() => restart(true)} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((index + 1) / 5) * 100}%` }]} /></View>
      <View style={styles.top}><Pill>{question.topic}</Pill><Text style={textStyles.meta}>{index + 1} / 5 · Score {score}</Text></View>
      <Card color={colors.white}>
        <Text style={styles.question}>{question.question}</Text>
      </Card>
      {question.options.map((option) => {
        const isSelected = selected === option;
        const isCorrect = selected && option === question.answer;
        const tone = isCorrect ? colors.green : isSelected ? colors.red : colors.white;
        return <ActionButton key={option} label={option} tone={tone} onPress={() => answer(option)} disabled={Boolean(selected) && !isSelected && !isCorrect} />;
      })}
      {selected ? (
        <Card color={selected === question.answer ? colors.green : colors.pink}>
          <Text style={textStyles.cardTitle}>{selected === question.answer ? 'Correct!' : `Correct answer: ${question.answer}`}</Text>
          <Text style={textStyles.body}>{question.explanation}</Text>
          <ActionButton label={index === 4 ? 'See result' : 'Next question'} onPress={next} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 80, gap: 16, backgroundColor: colors.paper },
  progressTrack: { height: 16, borderWidth: 2, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.white, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.pink },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  question: { color: colors.ink, fontSize: 26, lineHeight: 32, fontWeight: '900' },
  result: { alignItems: 'stretch', marginTop: 30 },
  resultScore: { color: colors.ink, fontSize: 70, lineHeight: 74, fontWeight: '900', textAlign: 'center' },
  resultRank: { color: colors.ink, fontSize: 26, lineHeight: 32, fontWeight: '900', textAlign: 'center' },
});
