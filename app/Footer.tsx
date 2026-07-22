"use client";

const text = {
  en: "Ultra Teb for Trade — Internal Dashboard",
  ar: "الترا طب للتجارة — لوحة تحكم داخلية",
};

export default function Footer({ lang }: { lang: "en" | "ar" }) {
  return (
    <footer
      style={{
        marginTop: 40,
        padding: "18px 28px",
        textAlign: "center",
        fontSize: 12,
        color: "#8a99a3",
        borderTop: "1px solid #e2e8ec",
      }}
    >
      {text[lang]} · {new Date().getFullYear()}
    </footer>
  );
}