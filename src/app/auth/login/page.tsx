"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type React from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("Invalid email or password");
    else router.push(params.get("callbackUrl") || "/dashboard");
  };

  return (
    <>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm font-bold">
          Email
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="neo-input mt-2" />
        </label>
        <label className="block text-sm font-bold">
          Password
          <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="neo-input mt-2" />
        </label>
        {error && <p className="rounded-[12px] border-2 border-[var(--border)] bg-[#fff0f0] p-3 text-sm font-bold text-[var(--danger)]">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <button type="button" className="btn-secondary mt-4 w-full" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
        Continue with Google
      </button>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card bg-[#e9f7ff]">
        <p className="neo-eyebrow">Account</p>
        <h1 className="mt-4 text-3xl font-extrabold uppercase leading-none">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Save favorites, alerts, and your sky location.</p>
        <Suspense fallback={<p className="mt-8 text-[var(--muted)]">Loading...</p>}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm font-bold text-[var(--muted)]">
          No account?{" "}
          <Link href="/auth/signup" className="text-[var(--text)] underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
