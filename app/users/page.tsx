"use client";

import { FormEvent, useEffect, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";
import { dashboardModules, normalizePermissions, type DashboardModule, type DashboardPermissions } from "../../lib/dashboard-permissions";

type ManagedUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  active: boolean;
  created_at: string;
  sales_rep_id: number | null;
  sales_reps: { name: string } | null;
  permissions: DashboardPermissions;
};
type SalesRepOption = { id: number; name: string };
const permissionLabels: Record<DashboardModule, string> = {
  home: "Home", customers: "Customers", sales: "Invoices", reps: "Sales Reps",
  reports: "Reports", teams: "Sales Teams", wht: "Collected WHT", collections: "Collections", cogs: "Invoices COGS",
  vat: "VAT Report", incomeStatement: "Income Statement Data", authorization: "Authorization Letters",
};

export default function UsersPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [salesRepId, setSalesRepId] = useState("");
  const [salesReps, setSalesReps] = useState<SalesRepOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [permissionUser, setPermissionUser] = useState<ManagedUser | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<DashboardPermissions>({});
  const dir = lang === "ar" ? "rtl" : "ltr";
  const t = lang === "ar" ? {
    administration: "الإدارة", title: "إدارة المستخدمين",
    subtitle: "إضافة المستخدمين وتغيير كلمات المرور والأدوار وصلاحية الحساب.",
    users: "مستخدمون", addNew: "إضافة مستخدم جديد", username: "اسم المستخدم",
    password: "كلمة المرور", role: "الدور", user: "مستخدم", admin: "مسؤول",
    adding: "جارٍ الإضافة...", add: "إضافة مستخدم", status: "الحالة",
    created: "تاريخ الإنشاء", actions: "الإجراءات", active: "نشط",
    disabled: "معطل", changePassword: "تغيير كلمة المرور", delete: "حذف",
    loading: "جارٍ تحميل المستخدمين...", empty: "لا يوجد مستخدمون.",
    newPassword: "أدخل كلمة مرور جديدة لـ", minimum: "بحد أدنى 8 أحرف",
    confirmDelete: "هل تريد حذف المستخدم",
  } : {
    administration: "ADMINISTRATION", title: "User Management",
    subtitle: "Add users, change passwords, roles, and account access.",
    users: "users", addNew: "Add New User", username: "Username",
    password: "Password", role: "Role", user: "User", admin: "Admin",
    adding: "Adding...", add: "Add User", status: "Status",
    created: "Created", actions: "Actions", active: "Active",
    disabled: "Disabled", changePassword: "Change Password", delete: "Delete",
    loading: "Loading users...", empty: "No managed users found.",
    newPassword: "Enter a new password for", minimum: "minimum 8 characters",
    confirmDelete: "Delete user",
  };

  async function loadUsers() {
    setLoading(true);
    const response = await fetch("/api/auth/users");
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(result.error || "Could not load users.");
      return;
    }
    setUsers(result.data ?? []);
    setSalesReps(result.salesReps ?? []);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role, salesRepId }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error || "Could not add user.");
      return;
    }
    setUsername("");
    setPassword("");
    setRole("user");
    setSalesRepId("");
    setMessage("User created successfully.");
    await loadUsers();
  }

  async function updateUser(id: string, changes: Record<string, unknown>) {
    setMessage("");
    const response = await fetch("/api/auth/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...changes }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Could not update user.");
      return;
    }
    setMessage("User updated successfully.");
    await loadUsers();
  }

  async function resetPassword(user: ManagedUser) {
    const newPassword = prompt(
      `${t.newPassword} ${user.username} (${t.minimum}):`
    );
    if (!newPassword) return;
    await updateUser(user.id, { password: newPassword });
  }

  async function deleteUser(user: ManagedUser) {
    if (!confirm(`${t.confirmDelete} ${user.username}?`)) return;
    const response = await fetch(
      `/api/auth/users?id=${encodeURIComponent(user.id)}`,
      { method: "DELETE" }
    );
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Could not delete user.");
      return;
    }
    setMessage("User deleted.");
    await loadUsers();
  }

  function openPermissions(user: ManagedUser) {
    setPermissionUser(user);
    setPermissionDraft(normalizePermissions(user.permissions));
  }

  function changePermission(module: DashboardModule, field: "view" | "edit", checked: boolean) {
    setPermissionDraft((current) => {
      const previous = current[module] ?? { view: false, edit: false };
      const next = { ...previous, [field]: checked };
      if (field === "edit" && checked) next.view = true;
      if (field === "view" && !checked) next.edit = false;
      return { ...current, [module]: next };
    });
  }

  async function savePermissions() {
    if (!permissionUser) return;
    await updateUser(permissionUser.id, { permissions: permissionDraft });
    setPermissionUser(null);
  }

  return (
    <div className="users-page" dir={dir}>
      <Header
        active="users"
        lang={lang}
        onToggleLang={() => setLang(lang === "en" ? "ar" : "en")}
      />
      <main className="users-layout">
        <div className="users-heading">
          <div>
            <p>{t.administration}</p>
            <h1>{t.title}</h1>
            <span>{t.subtitle}</span>
          </div>
          <strong>{users.length} {t.users}</strong>
        </div>

        <section className="users-add-card">
          <h2>{t.addNew}</h2>
          <form onSubmit={addUser}>
            <label>
              {t.username}
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={3}
                required
              />
            </label>
            <label>
              Sales Representative
              <select value={salesRepId} onChange={(event) => setSalesRepId(event.target.value)} disabled={role === "admin"}>
                <option value="">Full access user</option>
                {salesReps.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
              </select>
            </label>
            <label>
              {t.password}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <label>
              {t.role}
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as "admin" | "user")
                }
              >
                <option value="user">{t.user}</option>
                <option value="admin">{t.admin}</option>
              </select>
            </label>
            <button type="submit" disabled={saving}>
              {saving ? t.adding : t.add}
            </button>
          </form>
          {message && <p className="users-message">{message}</p>}
        </section>

        <section className="users-table-card">
          <table>
            <thead>
              <tr>
                <th>{t.username}</th>
                <th>{t.role}</th>
                <th>{t.status}</th>
                <th>Sales Representative</th>
                <th>{t.created}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.username}</strong></td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(event) =>
                        updateUser(user.id, { role: event.target.value })
                      }
                    >
                      <option value="user">{t.user}</option>
                      <option value="admin">{t.admin}</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={user.active ? "user-active" : "user-disabled"}
                      onClick={() =>
                        updateUser(user.id, { active: !user.active })
                      }
                    >
                      {user.active ? t.active : t.disabled}
                    </button>
                  </td>
                  <td>
                    <select value={user.sales_rep_id ?? ""} disabled={user.role === "admin"} onChange={(event) => updateUser(user.id, { salesRepId: event.target.value })}>
                      <option value="">Full access</option>
                      {salesReps.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
                    </select>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-EG")}</td>
                  <td>
                    <div className="users-actions">
                      <button type="button" onClick={() => resetPassword(user)}>
                        {t.changePassword}
                      </button>
                      <button type="button" onClick={() => openPermissions(user)} disabled={user.role === "admin"}>
                        Permissions
                      </button>
                      <button
                        type="button"
                        className="users-delete"
                        onClick={() => deleteUser(user)}
                      >
                        {t.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="users-empty">{t.loading}</div>}
          {!loading && !users.length && (
            <div className="users-empty">{t.empty}</div>
          )}
        </section>
        {permissionUser && (
          <div className="permissions-modal" role="dialog" aria-modal="true" aria-label={`Permissions for ${permissionUser.username}`}>
            <section className="permissions-card">
              <div className="permissions-card__heading"><div><p>USER ACCESS</p><h2>{permissionUser.username}</h2><span>Choose what this user can view or edit.</span></div><button onClick={() => setPermissionUser(null)}>×</button></div>
              <div className="permissions-grid permissions-grid--header"><strong>Module</strong><strong>View</strong><strong>Edit</strong></div>
              {dashboardModules.map((module) => {
                const access = permissionDraft[module] ?? { view: false, edit: false };
                return <div className="permissions-grid" key={module}><span>{permissionLabels[module]}</span><input type="checkbox" checked={access.view} onChange={(event) => changePermission(module, "view", event.target.checked)} /><input type="checkbox" checked={access.edit} onChange={(event) => changePermission(module, "edit", event.target.checked)} /></div>;
              })}
              <p className="permissions-note">The user must sign out and sign in again after permissions are changed.</p>
              <div className="permissions-actions"><button onClick={() => setPermissionUser(null)}>Cancel</button><button className="primary" onClick={savePermissions}>Save Permissions</button></div>
            </section>
          </div>
        )}
      </main>
      <Footer lang={lang} />
    </div>
  );
}
