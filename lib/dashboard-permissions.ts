export const dashboardModules = [
  "home", "customers", "sales", "reps", "reports", "teams", "wht",
  "collections", "cheques", "cogs", "vat", "incomeStatement", "authorization",
] as const;

export type DashboardModule = (typeof dashboardModules)[number];
export type ModuleAccess = { view: boolean; edit: boolean };
export type DashboardPermissions = Partial<Record<DashboardModule, ModuleAccess>>;

export const defaultUserPermissions: DashboardPermissions = {
  home: { view: true, edit: false },
  customers: { view: true, edit: true },
  sales: { view: true, edit: true },
  reps: { view: true, edit: false },
  reports: { view: true, edit: false },
};

export function normalizePermissions(value: unknown): DashboardPermissions {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const normalized: DashboardPermissions = {};
  dashboardModules.forEach((module) => {
    const item = source[module];
    const fallback = defaultUserPermissions[module] ?? { view: false, edit: false };
    if (item && typeof item === "object") {
      const access = item as Record<string, unknown>;
      const edit = access.edit === true;
      normalized[module] = { view: access.view === true || edit, edit };
    } else {
      normalized[module] = fallback;
    }
  });
  return normalized;
}

export function hasDashboardPermission(
  session: { role: "admin" | "user"; permissions?: DashboardPermissions },
  module: DashboardModule,
  access: "view" | "edit" = "view"
) {
  if (session.role === "admin") return true;
  return normalizePermissions(session.permissions)[module]?.[access] === true;
}
