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
          background: "#f5f6f8",
          color: "#1a1a1a",
        }}
      >
        {children}
      </body>
    </html>
  );
}
