"use client";

import { FormEvent, useEffect, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type ManagedUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  active: boolean;
  created_at: string;
};

export default function UsersPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
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
      body: JSON.stringify({ username, password, role }),
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
                  <td>{new Date(user.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-EG")}</td>
                  <td>
                    <div className="users-actions">
                      <button type="button" onClick={() => resetPassword(user)}>
                        {t.changePassword}
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
      </main>
      <Footer lang={lang} />
    </div>
  );
}
