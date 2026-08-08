export default function AccessDeniedPage() {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--page-bg)", color: "var(--text-primary)" }}>
    <section style={{ maxWidth: 520, textAlign: "center", border: "1px solid var(--border-color)", borderRadius: 16, background: "var(--surface-color)", padding: 32 }}>
      <h1>Access Restricted</h1>
      <p style={{ color: "var(--text-secondary)" }}>Your account does not have permission to open this section. Ask the dashboard administrator to update your access.</p>
      <a href="/" style={{ color: "var(--brand-primary)", fontWeight: 800 }}>Return to Dashboard</a>
    </section>
  </main>;
}
