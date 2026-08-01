"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NEWSLETTER } from "@/lib/newsletter";

type SubmitState = "idle" | "saving" | "saved" | "error";
type ApiResponse = {
  status?: "subscribed" | "already_subscribed" | "accepted" | "demo";
  message?: string;
  error?: string;
};

export function NewsletterSignup({ compact = false, source }: { compact?: boolean; source?: string }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState(NEWSLETTER.microcopy);

  const isEmailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "saving") return;
    if (!isEmailValid) {
      setState("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setState("saving");
    setMessage("Joining The Downlink...");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          website,
          source: source || (compact ? "inline-form" : "newsletter-page"),
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.error || "Could not join right now.");
      setState("saved");
      setMessage(data.message || `You are on ${NEWSLETTER.name}.`);
      if (data.status !== "already_subscribed") setEmail("");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not join right now. Please try again in a moment."
      );
    }
  }

  return (
    <form className={`newsletter-form ${compact ? "is-compact" : ""}`} onSubmit={submit}>
      <div className="newsletter-fields">
        <label>
          <span>Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="student@example.com"
            type="email"
            autoComplete="email"
            aria-invalid={state === "error" && !isEmailValid}
          />
        </label>
        <label className="newsletter-honeypot" aria-hidden="true">
          <span>Website</span>
          <input
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={state === "saving"}>
          {state === "saving" ? "Joining..." : compact ? "Join" : "Join The Downlink"}
        </button>
      </div>

      <p className={`newsletter-message is-${state}`} role="status" aria-live="polite">
        {message}
      </p>
      <p className="newsletter-consent">
        By joining, you agree to receive {NEWSLETTER.name}. If you are under 18, ask a parent or teacher first. Read the{" "}
        <Link href="/privacy">privacy note</Link>.
      </p>
    </form>
  );
}
