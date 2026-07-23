import "./globals.css";

export const metadata = {
  title: "Ultra Teb - Customers Dashboard",
  description: "Customers dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          fontFamily:
            "Arial, 'Segoe UI', Tahoma, sans-serif",
          background: "var(--page-bg)",
          color: "var(--text-primary)",
        }}
      >
        {children}
      </body>
    </html>
  );
}
