"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type React from "react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Signup failed");
      setLoading(false);
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    router.push("/dashboard");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card bg-[#fff0f7]">
        <p className="neo-eyebrow">Account</p>
        <h1 className="mt-4 text-3xl font-extrabold uppercase leading-none">Create account</h1>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm font-bold">
            Name
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} className="neo-input mt-2" />
          </label>
          <label className="block text-sm font-bold">
            Email
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="neo-input mt-2" />
          </label>
          <label className="block text-sm font-bold">
            Password (min 8 characters)
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="neo-input mt-2"
            />
          </label>
          {error && <p className="rounded-[12px] border-2 border-[var(--border)] bg-[#fff0f0] p-3 text-sm font-bold text-[var(--danger)]">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating..." : "Sign up"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm font-bold text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[var(--text)] underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
