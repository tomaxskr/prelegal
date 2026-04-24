"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && isLoggedIn) {
      router.replace("/");
    }
  }, [isAuthLoading, isLoggedIn, router]);

  const submitLabel = useMemo(
    () => (mode === "signin" ? "Prisijungti" : "Prisiregistruoti"),
    [mode]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(name, email, password);
      }
      router.push("/");
    } catch (submitError) {
      const fallbackMessage =
        submitError instanceof Error ? submitError.message : "Unable to complete request";
      setError(fallbackMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white grid place-items-center px-4">
        <p className="text-sm text-slate-200">Loading account...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_20%,_#dbeafe_0%,_#f8fafc_42%,_#e2e8f0_100%)]">
      <header className="px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold tracking-tight text-[--dark-navy]">Prelegal</h1>
        </div>
      </header>

      <main className="px-4 pb-10">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.2fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white/85 p-8 shadow-xl shadow-slate-300/40 backdrop-blur">
            <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              Draft smarter with AI guidance
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight text-slate-900">
              Build legal drafts in minutes, then review with counsel.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
              Sign in to continue prior work, keep all generated drafts in one timeline, and
              export polished documents for legal review.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Document history per account</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">AI-guided intake workflow</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">PDF exports from draft preview</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Temporary local DB reset on restart</div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-300/40">
            <div className="mb-6 flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-medium">
              <button
                type="button"
                className={`w-1/2 rounded-lg py-2 ${
                  mode === "signin" ? "bg-white text-slate-900 shadow" : "text-slate-600"
                }`}
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
              >
                Prisijungimas
              </button>
              <button
                type="button"
                className={`w-1/2 rounded-lg py-2 ${
                  mode === "signup" ? "bg-white text-slate-900 shadow" : "text-slate-600"
                }`}
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
              >
                Registracija
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Full name
                  </label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    placeholder="Alex Carter"
                    required
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Work email
                </label>
                <input
                  value={email}
                  type="email"
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password
                </label>
                <input
                  value={password}
                  type="password"
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-[var(--purple-secondary)] bg-[var(--purple-secondary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? "Please wait..." : submitLabel}
              </button>
            </form>

            <p className="mt-5 text-xs leading-5 text-slate-500">
              Disclaimer: All outputs are draft documents and should be reviewed by qualified legal counsel.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}