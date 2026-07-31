"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type AuditLog = {
  id: number;
  username: string;
  user_role: "admin" | "user" | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  metadata: Record<string, unknown>;
  success: boolean;
  ip_address: string | null;
  created_at: string;
};

export default function ActivityLogClient({ logs }: { logs: AuditLog[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [query, setQuery] = useState("");
  const [user, setUser] = useState("All");
  const [action, setAction] = useState("All");
  const [date, setDate] = useState("");
  const isArabic = lang === "ar";

  const users = useMemo(
    () => Array.from(new Set(logs.map((log) => log.username))).sort(),
    [logs]
  );
  const actions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort(),
    [logs]
  );
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return logs.filter(
      (log) =>
        (user === "All" || log.username === user) &&
        (action === "All" || log.action === action) &&
        (!date || log.created_at.slice(0, 10) === date) &&
        (!search ||
          `${log.username} ${log.action} ${log.entity_type} ${log.entity_id ?? ""} ${log.description}`
            .toLowerCase()
            .includes(search))
    );
  }, [logs, query, user, action, date]);

  return (
    <div className="audit-page" dir={isArabic ? "rtl" : "ltr"}>
      <Header
        active="activity"
        lang={lang}
        onToggleLang={() => setLang(isArabic ? "en" : "ar")}
      />
      <main className="audit-layout">
        <div className="audit-heading">
          <div>
            <p>{isArabic ? "الإدارة والأمان" : "ADMINISTRATION & SECURITY"}</p>
            <h1>{isArabic ? "سجل النشاط" : "Activity Log"}</h1>
            <span>
              {isArabic
                ? "راجع إجراءات المستخدمين والتغييرات المهمة."
                : "Review user actions and important dashboard changes."}
            </span>
          </div>
          <strong>{filtered.length} {isArabic ? "عملية" : "events"}</strong>
        </div>

        <section className="audit-filters">
          <label>
            {isArabic ? "بحث" : "Search"}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isArabic ? "المستخدم أو الإجراء أو التفاصيل" : "User, action, or details"}
            />
          </label>
          <label>
            {isArabic ? "المستخدم" : "User"}
            <select value={user} onChange={(event) => setUser(event.target.value)}>
              <option value="All">{isArabic ? "كل المستخدمين" : "All Users"}</option>
              {users.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            {isArabic ? "الإجراء" : "Action"}
            <select value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="All">{isArabic ? "كل الإجراءات" : "All Actions"}</option>
              {actions.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            {isArabic ? "التاريخ" : "Date"}
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </section>

        <section className="audit-table-card">
          <div className="audit-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{isArabic ? "الوقت" : "Date & Time"}</th>
                  <th>{isArabic ? "المستخدم" : "User"}</th>
                  <th>{isArabic ? "الإجراء" : "Action"}</th>
                  <th>{isArabic ? "القسم" : "Area"}</th>
                  <th>{isArabic ? "التفاصيل" : "Details"}</th>
                  <th>{isArabic ? "الحالة" : "Status"}</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString(isArabic ? "ar-EG" : "en-GB")}</td>
                    <td><strong>{log.username}</strong><small>{log.user_role ?? "-"}</small></td>
                    <td><span className="audit-action">{log.action.replace(/_/g, " ")}</span></td>
                    <td>{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ""}</td>
                    <td>{log.description}</td>
                    <td><span className={log.success ? "audit-status audit-status--success" : "audit-status audit-status--failed"}>{log.success ? (isArabic ? "ناجح" : "Success") : (isArabic ? "فشل" : "Failed")}</span></td>
                    <td>{log.ip_address ?? "-"}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={7} className="audit-empty">{isArabic ? "لا توجد عمليات مطابقة." : "No matching activity found."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
