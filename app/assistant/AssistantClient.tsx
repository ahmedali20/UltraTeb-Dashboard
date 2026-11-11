"use client";

import { FormEvent, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Show me invoice 1475",
  "Summarize sales for the current month",
  "Which recent invoices are overdue?",
  "Compare invoices, credit notes, and debit notes",
];

export default function AssistantClient() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const question = (suggested ?? input).trim();
    if (!question || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content: question }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-8) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The assistant could not answer.");
      setMessages((current) => [...current, { role: "assistant", content: result.answer }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The assistant could not answer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Header active="assistant" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
      <main className="ai-assistant-page">
        <section className="ai-assistant-hero">
          <div><p>READ-ONLY FINANCIAL ASSISTANT</p><h1>UltraTeb AI Assistant</h1><span>Ask questions about invoices, customers, representatives, tax, and sales performance.</span></div>
          <strong>Safe mode</strong>
        </section>
        <section className="ai-assistant-card">
          <div className="ai-assistant-notice"><strong>Read-only:</strong> the assistant can analyze your permitted dashboard data, but it cannot edit, delete, allocate, or approve anything.</div>
          {!messages.length && <div className="ai-assistant-welcome"><span className="ai-assistant-orb">AI</span><h2>How can I help?</h2><p>Try one of these questions or write your own.</p><div className="ai-assistant-suggestions">{suggestions.map((item) => <button key={item} type="button" onClick={() => sendMessage(undefined, item)}>{item}</button>)}</div></div>}
          <div className="ai-assistant-messages" aria-live="polite">{messages.map((message, index) => <article key={`${message.role}-${index}`} className={`ai-message ai-message--${message.role}`}><span>{message.role === "user" ? "You" : "AI"}</span><div>{message.content}</div></article>)}{loading && <article className="ai-message ai-message--assistant"><span>AI</span><div>Checking the dashboard data…</div></article>}</div>
          {error && <p className="ai-assistant-error">{error}</p>}
          <form className="ai-assistant-composer" onSubmit={(event) => sendMessage(event)}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about an invoice, customer, balance, sales rep, or monthly performance…" rows={3} maxLength={1000} /><button type="submit" disabled={loading || !input.trim()}>Send</button></form>
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
