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
      `Enter a new password for ${user.username} (minimum 8 characters):`
    );
    if (!newPassword) return;
    await updateUser(user.id, { password: newPassword });
  }

  async function deleteUser(user: ManagedUser) {
    if (!confirm(`Delete user ${user.username}?`)) return;
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
    <div className="users-page">
      <Header
        active="users"
        lang={lang}
        onToggleLang={() => setLang(lang === "en" ? "ar" : "en")}
      />
      <main className="users-layout">
        <div className="users-heading">
          <div>
            <p>ADMINISTRATION</p>
            <h1>User Management</h1>
            <span>Add users, change passwords, roles, and account access.</span>
          </div>
          <strong>{users.length} users</strong>
        </div>

        <section className="users-add-card">
          <h2>Add New User</h2>
          <form onSubmit={addUser}>
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={3}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <label>
              Role
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as "admin" | "user")
                }
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button type="submit" disabled={saving}>
              {saving ? "Adding..." : "Add User"}
            </button>
          </form>
          {message && <p className="users-message">{message}</p>}
        </section>

        <section className="users-table-card">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
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
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
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
                      {user.active ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString("en-EG")}</td>
                  <td>
                    <div className="users-actions">
                      <button type="button" onClick={() => resetPassword(user)}>
                        Change Password
                      </button>
                      <button
                        type="button"
                        className="users-delete"
                        onClick={() => deleteUser(user)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="users-empty">Loading users...</div>}
          {!loading && !users.length && (
            <div className="users-empty">No managed users found.</div>
          )}
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

