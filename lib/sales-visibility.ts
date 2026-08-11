export const NON_ADMIN_SALES_START_DATE = "2026-01-01";

export function canViewPre2026Sales(session: { role: "admin" | "user" } | null | undefined) {
  return session?.role === "admin";
}

