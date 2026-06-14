import Link from "next/link";
import type React from "react";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  copy?: string;
  action?: React.ReactNode;
};

export function SectionHeader({ eyebrow, title, copy, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <p className="neo-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {copy && <p>{copy}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

export function NeoLinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} className={variant === "primary" ? "neo-button" : "neo-button neo-button-secondary"}>
      {children}
    </Link>
  );
}

export function SatelliteCard({
  href,
  category,
  title,
  description,
  meta,
  featured,
}: {
  href: string;
  category: string;
  title: string;
  description?: string | null;
  meta?: string;
  featured?: boolean;
}) {
  return (
    <Link href={href} className={`satellite-card ${featured ? "is-featured" : ""}`}>
      <span className="sticker-tag">{category}</span>
      <div className="satellite-cutout" aria-hidden="true">
        <span />
      </div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {meta && <small>{meta}</small>}
    </Link>
  );
}

export function MissionCard({
  label,
  title,
  copy,
}: {
  label: string;
  title: string;
  copy: string;
}) {
  return (
    <article className="mission-card">
      <span className="sticker-tag">{label}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </article>
  );
}

export function QuizCard({
  index,
  question,
  options,
  answerIndex,
  explanation,
}: {
  index: number;
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string | null;
}) {
  return (
    <article className="quiz-card">
      <span className="quiz-number">{String(index + 1).padStart(2, "0")}</span>
      <h3>{question}</h3>
      <ul>
        {options.map((option, optionIndex) => (
          <li key={option} className={optionIndex === answerIndex ? "is-answer" : ""}>
            <span>{String.fromCharCode(65 + optionIndex)}</span>
            {option}
          </li>
        ))}
      </ul>
      {explanation && <p>{explanation}</p>}
    </article>
  );
}

export function LoadingSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state-card" aria-busy="true">
      <div className="skeleton skeleton-disc" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something drifted off course",
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="state-card is-error">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="state-card">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}
