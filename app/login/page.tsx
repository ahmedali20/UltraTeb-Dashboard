"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = lang === "ar" ? {
    title: "تسجيل الدخول إلى لوحة التحكم",
    subtitle: "أدخل اسم المستخدم وكلمة المرور المصرح بهما.",
    username: "اسم المستخدم", password: "كلمة المرور",
    signing: "جارٍ تسجيل الدخول...", signIn: "تسجيل الدخول",
    failed: "فشل تسجيل الدخول.", connection: "تعذر الاتصال. حاول مرة أخرى.",
    language: "English",
  } : {
    title: "Dashboard Login",
    subtitle: "Enter your authorized username and password.",
    username: "Username", password: "Password",
    signing: "Signing in...", signIn: "Sign In",
    failed: "Login failed.", connection: "Could not connect. Please try again.",
    language: "العربية",
  };

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || t.failed);
        return;
      }

      const requestedPage = new URLSearchParams(window.location.search).get(
        "next"
      );
      window.location.href =
        requestedPage?.startsWith("/") && !requestedPage.startsWith("//")
          ? requestedPage
          : "/";
    } catch {
      setError(t.connection);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page" dir={lang === "ar" ? "rtl" : "ltr"}>
      <section className="login-card">
        <button
          type="button"
          className="login-language"
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
        >
          {t.language}
        </button>
        <div className="login-brand">UT</div>
        <p>ULTRA TEB</p>
        <h1>{t.title}</h1>
        <span>{t.subtitle}</span>

        <form onSubmit={login}>
          <label>
            {t.username}
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            {t.password}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? t.signing : t.signIn}
          </button>
        </form>
      </section>
    </main>
  );
}
