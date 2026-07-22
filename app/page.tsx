export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif",
        background: "#f5f6f8",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Ultra Teb Dashboard</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Choose a section to get started
      </p>
      <div style={{ display: "flex", gap: 20 }}>
        <a
          href="/customers"
          style={{
            padding: "20px 40px",
            borderRadius: 10,
            background: "#2d3748",
            color: "#fff",
            textDecoration: "none",
            fontSize: 18,
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        >
          Customers
        </a>
        <a
          href="/sales"
          style={{
            padding: "20px 40px",
            borderRadius: 10,
            background: "#2563eb",
            color: "#fff",
            textDecoration: "none",
            fontSize: 18,
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        >
          Sales
        </a>
      </div>
    </main>
  );
}