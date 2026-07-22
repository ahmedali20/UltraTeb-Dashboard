"use client";

type Props = {
  active: "home" | "customers" | "sales";
  lang: "en" | "ar";
  onToggleLang: () => void;
};

const labels = {
  en: { home: "Home", customers: "Customers", sales: "Sales", switchTo: "العربية" },
  ar: { home: "الرئيسية", customers: "العملاء", sales: "المبيعات", switchTo: "English" },
};

export default function Header({ active, lang, onToggleLang }: Props) {
  const t = labels[lang];

  const linkStyle = (page: string): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: active === page ? 600 : 400,
    color: active === page ? "#fff" : "#cbd5d9",
    background: active === page ? "#178A6B" : "transparent",
  });

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 28px",
        background: "#0F3B44",
        marginBottom: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>
          Ultra Teb
        </span>
        <nav style={{ display: "flex", gap: 6 }}>
          <a href="/" style={linkStyle("home")}>
            {t.home}
          </a>
          <a href="/customers" style={linkStyle("customers")}>
            {t.customers}
          </a>
          <a href="/sales" style={linkStyle("sales")}>
            {t.sales}
          </a>
        </nav>
      </div>
      <button
        onClick={onToggleLang}
        style={{
          padding: "6px 16px",
          borderRadius: 6,
          border: "1px solid #2f5a63",
          background: "transparent",
          color: "#fff",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        {t.switchTo}
      </button>
    </header>
  );
}