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

function rankFor(score: number) {
  if (score === 5) return "Orbital Genius";
  if (score >= 4) return "Mission Specialist";
  if (score >= 2) return "Satellite Spotter";
  return "Orbit Rookie";
}

export function OrbitQuizClient() {
  const [round, setRound] = useState<RoundQuestion[]>(() => buildRound());
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selected, setSelected] = useState("");
  const [finished, setFinished] = useState(false);

  const question = round[current];
  const answerRecord = answers.find((item) => item.questionId === question?.id);
  const score = useMemo(() => answers.filter((item) => item.correct).length, [answers]);
  const progress = finished ? 100 : ((current + (answerRecord ? 1 : 0)) / round.length) * 100;

  function chooseAnswer(option: string) {
    if (answerRecord || finished) return;
    const correct = option === question.answer;
    setSelected(option);
    setAnswers((items) => [...items, { questionId: question.id, selected: option, correct }]);
  }

  function nextQuestion() {
    setSelected("");
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
  }

  function newQuestions() {
    setRound(buildRound());
    setAnswers([]);
    setSelected("");
    setCurrent(0);
    setFinished(false);
  }

  if (finished) {
    return (
      <section className="quiz-shell" aria-labelledby="quiz-finished-title">
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
    <section className="quiz-shell" aria-labelledby="quiz-question-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="sticker-tag">{question.topic}</span>
        <span className="font-mono text-sm font-bold text-[var(--muted)]">
          Question {current + 1} / {round.length}
        </span>
      </div>

      <div className="quiz-progress" aria-label={`Progress ${Math.round(progress)} percent`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <h2 id="quiz-question-title">{question.question}</h2>

      <div className="grid gap-3" role="radiogroup" aria-label="Answer options">
        {question.shuffledOptions.map((option) => {
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-sm font-bold text-[var(--muted)]">Score: {score}</p>
        <button type="button" className="btn-primary" onClick={nextQuestion} disabled={!answerRecord}>
          {current === round.length - 1 ? "Show score" : "Next question"}
        </button>
      </div>
    </section>
  );
}
