"use client";

import { Fragment, useMemo, useState } from "react";
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
  metadata: Record<string, unknown> | null;
  success: boolean;
  ip_address: string | null;
  created_at: string;
};

function displayKey(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function changedFields(metadata: Record<string, unknown> | null) {
  const result: Array<{ field: string; from: unknown; to: unknown }> = [];
  if (!metadata) return result;

  const explicit = metadata.changes;
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) {
    for (const [field, value] of Object.entries(explicit)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const change = value as { from?: unknown; to?: unknown };
        result.push({ field, from: change.from, to: change.to });
      }
    }
    return result;
  }

  const before = metadata.before;
  const after = metadata.after;
  if (
    before && typeof before === "object" && !Array.isArray(before) &&
    after && typeof after === "object" && !Array.isArray(after)
  ) {
    const oldValues = before as Record<string, unknown>;
    const newValues = after as Record<string, unknown>;
    for (const field of Object.keys(oldValues)) {
      if (field in newValues && JSON.stringify(oldValues[field]) !== JSON.stringify(newValues[field])) {
        result.push({ field, from: oldValues[field], to: newValues[field] });
      }
    }
  }
  return result;
}

export default function ActivityLogClient({ logs }: { logs: AuditLog[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [query, setQuery] = useState("");
  const [user, setUser] = useState("All");
  const [action, setAction] = useState("All");
  const [date, setDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const isArabic = lang === "ar";

  const users = useMemo(() => Array.from(new Set(logs.map((log) => log.username))).sort(), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))).sort(), [logs]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return logs.filter((log) =>
      (user === "All" || log.username === user) &&
      (action === "All" || log.action === action) &&
      (!date || log.created_at.slice(0, 10) === date) &&
      (!search || `${log.username} ${log.action} ${log.entity_type} ${log.entity_id ?? ""} ${log.description}`.toLowerCase().includes(search))
    );
  }, [logs, query, user, action, date]);

  const metadataEntries = selectedLog ? Object.entries(selectedLog.metadata ?? {}) : [];

  return (
    <div className="audit-page" dir={isArabic ? "rtl" : "ltr"}>
      <Header active="activity" lang={lang} onToggleLang={() => setLang(isArabic ? "en" : "ar")} />
      <main className="audit-layout">
        <div className="audit-heading">
          <div>
            <p>{isArabic ? "الإدارة والأمان" : "ADMINISTRATION & SECURITY"}</p>
            <h1>{isArabic ? "سجل النشاط" : "Activity Log"}</h1>
            <span>{isArabic ? "اضغط على عرض التفاصيل لمعرفة ما تم تغييره." : "Select View Details to see exactly what was changed."}</span>
          </div>
          <strong>{filtered.length} {isArabic ? "عملية" : "events"}</strong>
        </div>

        <section className="audit-filters">
          <label>{isArabic ? "بحث" : "Search"}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "المستخدم أو الإجراء أو التفاصيل" : "User, action, or details"} /></label>
          <label>{isArabic ? "المستخدم" : "User"}<select value={user} onChange={(event) => setUser(event.target.value)}><option value="All">{isArabic ? "كل المستخدمين" : "All Users"}</option>{users.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>{isArabic ? "الإجراء" : "Action"}<select value={action} onChange={(event) => setAction(event.target.value)}><option value="All">{isArabic ? "كل الإجراءات" : "All Actions"}</option>{actions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>{isArabic ? "التاريخ" : "Date"}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </section>

        <section className="audit-table-card">
          <div className="audit-table-wrap">
            <table>
              <thead><tr><th>{isArabic ? "الوقت" : "Date & Time"}</th><th>{isArabic ? "المستخدم" : "User"}</th><th>{isArabic ? "الإجراء" : "Action"}</th><th>{isArabic ? "القسم" : "Area"}</th><th>{isArabic ? "التفاصيل" : "Summary"}</th><th>{isArabic ? "الحالة" : "Status"}</th><th /></tr></thead>
              <tbody>
                {filtered.map((log) => (
                  <Fragment key={log.id}>
                  <tr className={selectedLog?.id === log.id ? "audit-row audit-row--open" : "audit-row"}>
                    <td>{new Date(log.created_at).toLocaleString(isArabic ? "ar-EG" : "en-GB")}</td>
                    <td><strong>{log.username}</strong><small>{log.user_role ?? "-"}</small></td>
                    <td><span className="audit-action">{displayKey(log.action)}</span></td>
                    <td>{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ""}</td>
                    <td>{log.description}</td>
                    <td><span className={log.success ? "audit-status audit-status--success" : "audit-status audit-status--failed"}>{log.success ? (isArabic ? "ناجح" : "Success") : (isArabic ? "فشل" : "Failed")}</span></td>
                    <td><button className="audit-view-button" type="button" aria-expanded={selectedLog?.id === log.id} onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}>{selectedLog?.id === log.id ? (isArabic ? "إخفاء التفاصيل" : "Hide Details") : (isArabic ? "عرض التفاصيل" : "View Details")}</button></td>
                  </tr>
                  {selectedLog?.id === log.id && (
                    <tr className="audit-inline-row">
                      <td colSpan={7}>
                        <div className="audit-inline-detail">
                          <div className="audit-inline-detail__header">
                            <div><span>{isArabic ? "تفاصيل العملية" : "ACTIVITY DETAILS"}</span><strong>{displayKey(log.action)}</strong></div>
                            <small>#{log.id}</small>
                          </div>
                          <div className="audit-detail-grid">
                            <div><span>{isArabic ? "المستخدم" : "User"}</span><strong>{log.username}</strong></div>
                            <div><span>{isArabic ? "الدور" : "Role"}</span><strong>{log.user_role ?? "—"}</strong></div>
                            <div><span>{isArabic ? "السجل" : "Record"}</span><strong>{displayKey(log.entity_type)} {log.entity_id ? `#${log.entity_id}` : ""}</strong></div>
                            <div><span>IP</span><strong>{log.ip_address ?? "—"}</strong></div>
                          </div>
                          <div className="audit-changes">
                            <h3>{isArabic ? "القيم والتغييرات" : "Values & Changes"}</h3>
                            {changedFields(log.metadata).length ? changedFields(log.metadata).map((change) => (
                              <div className="audit-change-row" key={change.field}>
                                <span>{displayKey(change.field)}</span>
                                <pre><b>{displayValue(change.from)}</b>  →  <b>{displayValue(change.to)}</b></pre>
                              </div>
                            )) : <p>{isArabic ? "لم يتم تسجيل تغيير في قيم الحقول." : "No field-value change was recorded for this event."}</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
                {!filtered.length && <tr><td colSpan={7} className="audit-empty">{isArabic ? "لا توجد عمليات مطابقة." : "No matching activity found."}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {selectedLog && (
        <div className="audit-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLog(null); }}>
          <section className="audit-modal" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
            <div className="audit-modal__header">
              <div><p>{isArabic ? "تفاصيل العملية" : "ACTIVITY DETAILS"}</p><h2 id="audit-detail-title">{displayKey(selectedLog.action)}</h2></div>
              <button type="button" onClick={() => setSelectedLog(null)} aria-label={isArabic ? "إغلاق" : "Close"}>×</button>
            </div>
            <div className="audit-modal__summary">{selectedLog.description}</div>
            <div className="audit-detail-grid">
              <div><span>{isArabic ? "المستخدم" : "User"}</span><strong>{selectedLog.username}</strong></div>
              <div><span>{isArabic ? "الدور" : "Role"}</span><strong>{selectedLog.user_role ?? "—"}</strong></div>
              <div><span>{isArabic ? "التاريخ والوقت" : "Date & Time"}</span><strong>{new Date(selectedLog.created_at).toLocaleString(isArabic ? "ar-EG" : "en-GB")}</strong></div>
              <div><span>{isArabic ? "الحالة" : "Status"}</span><strong>{selectedLog.success ? (isArabic ? "ناجح" : "Success") : (isArabic ? "فشل" : "Failed")}</strong></div>
              <div><span>{isArabic ? "نوع السجل" : "Record Type"}</span><strong>{displayKey(selectedLog.entity_type)}</strong></div>
              <div><span>{isArabic ? "رقم السجل" : "Record ID"}</span><strong>{selectedLog.entity_id ?? "—"}</strong></div>
              <div><span>IP</span><strong>{selectedLog.ip_address ?? "—"}</strong></div>
              <div><span>{isArabic ? "رقم العملية" : "Event ID"}</span><strong>{selectedLog.id}</strong></div>
            </div>
            <div className="audit-changes">
              <h3>{isArabic ? "القيم والتغييرات" : "Values & Changes"}</h3>
              {metadataEntries.length ? metadataEntries.map(([key, value]) => (
                <div className="audit-change-row" key={key}><span>{displayKey(key)}</span><pre>{displayValue(value)}</pre></div>
              )) : <p>{isArabic ? "لا توجد قيم إضافية مسجلة لهذه العملية." : "No additional field values were recorded for this event."}</p>}
            </div>
          </section>
        </div>
      )}
      <Footer lang={lang} />
    </div>
  );
}
