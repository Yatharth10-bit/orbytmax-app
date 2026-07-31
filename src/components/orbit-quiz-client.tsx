"use client";

import { useMemo, useState } from "react";
import { ORBIT_QUIZ_BANK, type QuizQuestion } from "@/lib/education-content";

type RoundQuestion = QuizQuestion & {
  shuffledOptions: string[];
};

type AnswerRecord = {
  questionId: string;
  selected: string;
  correct: boolean;
};

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRound(): RoundQuestion[] {
  return shuffle(ORBIT_QUIZ_BANK)
    .slice(0, 5)
    .map((question) => ({
      ...question,
      shuffledOptions: shuffle(question.options),
    }));
}

function buildStableRound(): RoundQuestion[] {
  return ORBIT_QUIZ_BANK.slice(0, 5).map((question) => ({
    ...question,
    shuffledOptions: question.options,
  }));
}

function rankFor(score: number) {
  if (score === 5) return "Orbital Genius";
  if (score >= 4) return "Mission Specialist";
  if (score >= 2) return "Satellite Spotter";
  return "Orbit Rookie";
}

function playAnswerSound(correct: boolean) {
  if (typeof window === "undefined") return;
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;

  const context = new AudioCtor();
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (correct ? 0.44 : 0.34));

  const notes = correct ? [523.25, 659.25, 783.99] : [246.94, 196];
  notes.forEach((frequency, index) => {
    const osc = context.createOscillator();
    osc.type = correct ? "triangle" : "sine";
    osc.frequency.setValueAtTime(frequency, context.currentTime + index * 0.09);
    osc.connect(gain);
    osc.start(context.currentTime + index * 0.09);
    osc.stop(context.currentTime + index * 0.09 + 0.16);
  });

  window.setTimeout(() => void context.close(), correct ? 560 : 440);
}

export function OrbitQuizClient() {
  const [round, setRound] = useState<RoundQuestion[]>(() => buildStableRound());
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selected, setSelected] = useState("");
  const [finished, setFinished] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reaction, setReaction] = useState("Pick a launch path");

  const question = round[current];
  const answerRecord = answers.find((item) => item.questionId === question?.id);
  const score = useMemo(() => answers.filter((item) => item.correct).length, [answers]);
  const streak = useMemo(() => {
    let count = 0;
    for (let index = answers.length - 1; index >= 0; index -= 1) {
      if (!answers[index].correct) break;
      count += 1;
    }
    return count;
  }, [answers]);
  const progress = finished ? 100 : ((current + (answerRecord ? 1 : 0)) / round.length) * 100;

  function chooseAnswer(option: string) {
    if (answerRecord || finished) return;
    const correct = option === question.answer;
    setSelected(option);
    setAnswers((items) => [...items, { questionId: question.id, selected: option, correct }]);
    setReaction(correct ? "Nice lock-on!" : "Almost there");
    if (soundEnabled) playAnswerSound(correct);
  }

  function nextQuestion() {
    setSelected("");
    setReaction("Pick a launch path");
    if (current >= round.length - 1) {
      setFinished(true);
      return;
    }
    setCurrent((value) => value + 1);
  }

  function playAgain() {
    setAnswers([]);
    setSelected("");
    setCurrent(0);
    setFinished(false);
    setReaction("Pick a launch path");
  }

  function newQuestions() {
    setRound(buildRound());
    setAnswers([]);
    setSelected("");
    setCurrent(0);
    setFinished(false);
    setReaction("Pick a launch path");
  }

  if (finished) {
    return (
      <section className="quiz-shell quiz-finish-shell" aria-labelledby="quiz-finished-title">
        <div className="quiz-orbit-mascot" aria-hidden="true">
          <span />
        </div>
        <div className="quiz-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="sticker-tag">{rankFor(score)}</span>
        <h2 id="quiz-finished-title">Final score: {score} / 5</h2>
        <p>
          {score === 5
            ? "Perfect orbit. You tracked every concept cleanly."
            : "Review the explanations, then launch another round with fresh questions."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={playAgain}>
            Play Again
          </button>
          <button type="button" className="btn-secondary" onClick={newQuestions}>
            New Questions
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`quiz-shell ${answerRecord ? (answerRecord.correct ? "is-happy" : "is-learning") : ""}`} aria-labelledby="quiz-question-title">
      <div className="quiz-topbar">
        <div>
          <span className="sticker-tag">{question.topic}</span>
          <p className="quiz-reaction" aria-live="polite">{reaction}</p>
        </div>
        <button
          type="button"
          className={`quiz-sound-toggle ${soundEnabled ? "is-on" : ""}`}
          onClick={() => setSoundEnabled((value) => !value)}
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? "Sound on" : "Sound off"}
        </button>
      </div>

      <div className="quiz-status-row">
        <span>Question {current + 1} / {round.length}</span>
        <span>Score {score}</span>
        <span>Streak {streak}</span>
      </div>

      <div className="quiz-progress-wrap">
        <div className="quiz-progress" aria-label={`Progress ${Math.round(progress)} percent`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="quiz-progress-planets" aria-hidden="true">
          {round.map((item, index) => (
            <span key={item.id} className={index <= current ? "is-active" : ""} />
          ))}
        </div>
      </div>

      <div className="quiz-question-panel">
        <div className="quiz-orbit-mascot" aria-hidden="true">
          <span />
        </div>
        <h2 id="quiz-question-title">{question.question}</h2>
      </div>

      <div className="quiz-options-grid" role="radiogroup" aria-label="Answer options">
        {question.shuffledOptions.map((option, index) => {
          const isSelected = (answerRecord?.selected || selected) === option;
          const isCorrect = option === question.answer;
          const stateClass = answerRecord
            ? isCorrect
              ? "is-correct"
              : isSelected
                ? "is-wrong"
                : ""
            : "";
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`quiz-option ${stateClass}`}
              onClick={() => chooseAnswer(option)}
            >
              <em>{String.fromCharCode(65 + index)}</em>
              <span>{option}</span>
              {answerRecord && isCorrect && <strong>Correct</strong>}
              {answerRecord && isSelected && !isCorrect && <strong>Try this next time</strong>}
            </button>
          );
        })}
      </div>

      {answerRecord && (
        <div className={`quiz-feedback ${answerRecord.correct ? "is-correct" : "is-wrong"}`} aria-live="polite">
          <h3>{answerRecord.correct ? "Correct" : "Not quite"}</h3>
          <p>{question.explanation}</p>
        </div>
      )}

      <div className="quiz-bottom-row">
        <p>Score: {score} / {round.length}</p>
        <button type="button" className="btn-primary" onClick={nextQuestion} disabled={!answerRecord}>
          {current === round.length - 1 ? "Show score" : "Next question"}
        </button>
      </div>
    </section>
  );
}
