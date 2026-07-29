"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../Header";
import Footer from "../Footer";

type Team = {
  id: number;
  name: string;
  leader_rep_id: number | null;
};

type SalesRep = {
  id: number;
  name: string;
  team_id: number | null;
};

type TeamSale = {
  id: string;
  month: string;
  sales_rep: string | null;
  total_sales: number;
  document_type: "INVOICE" | "CR_NOTE" | "DR_NOTE" | null;
};

const copy = {
  en: {
    eyebrow: "SALES ORGANIZATION",
    title: "Sales Teams",
    subtitle: "Create teams, assign one team per representative, and track net sales.",
    newTeam: "Create Sales Team",
    editTeam: "Edit Sales Team",
    teamName: "Team Name",
    leader: "Team Leader",
    members: "Team Members",
    selectLeader: "Select team leader",
    save: "Save Team",
    update: "Update Team",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    month: "Performance Month",
    allMonths: "All Months",
    invoices: "Invoice Sales",
    credit: "Credit Notes",
    debit: "Debit Notes",
    net: "Net Sales",
    memberCount: "members",
    noTeams: "No sales teams created yet.",
    unassigned: "Unassigned Representatives",
    moveWarning: "Selecting a representative assigned elsewhere will move them to this team.",
  },
  ar: {
    eyebrow: "إدارة المبيعات",
    title: "فرق المبيعات",
    subtitle: "أنشئ الفرق وعيّن فريقاً واحداً لكل مندوب وتابع صافي المبيعات.",
    newTeam: "إنشاء فريق مبيعات",
    editTeam: "تعديل فريق المبيعات",
    teamName: "اسم الفريق",
    leader: "قائد الفريق",
    members: "أعضاء الفريق",
    selectLeader: "اختر قائد الفريق",
    save: "حفظ الفريق",
    update: "تحديث الفريق",
    cancel: "إلغاء",
    edit: "تعديل",
    delete: "حذف",
    month: "شهر الأداء",
    allMonths: "كل الشهور",
    invoices: "مبيعات الفواتير",
    credit: "الإشعارات الدائنة",
    debit: "الإشعارات المدينة",
    net: "صافي المبيعات",
    memberCount: "أعضاء",
    noTeams: "لم يتم إنشاء فرق مبيعات بعد.",
    unassigned: "مندوبون بدون فريق",
    moveWarning: "اختيار مندوب تابع لفريق آخر سينقله إلى هذا الفريق.",
  },
};

function normalizeName(value: string | null) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function money(value: number, lang: "en" | "ar") {
  return value.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SalesTeamsClient({
  teams,
  reps,
  sales,
}: {
  teams: Team[];
  reps: SalesRep[];
  sales: TeamSale[];
}) {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [month, setMonth] = useState("All");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [leaderRepId, setLeaderRepId] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const t = copy[lang];

  const months = useMemo(
    () =>
      Array.from(new Set(sales.map((sale) => sale.month).filter(Boolean))).sort(
        (a, b) => b.localeCompare(a)
      ),
    [sales]
  );

  const teamResults = useMemo(
    () =>
      teams.map((team) => {
        const members = reps.filter((rep) => rep.team_id === team.id);
        const names = new Set(members.map((rep) => normalizeName(rep.name)));
        const relevantSales = sales.filter(
          (sale) =>
            names.has(normalizeName(sale.sales_rep)) &&
            (month === "All" || sale.month === month)
        );
        const totals = relevantSales.reduce(
          (result, sale) => {
            const value = Math.abs(Number(sale.total_sales || 0));
            if (sale.document_type === "CR_NOTE") result.credit += value;
            else if (sale.document_type === "DR_NOTE") result.debit += value;
            else result.invoices += value;
            return result;
          },
          { invoices: 0, credit: 0, debit: 0 }
        );
        return {
          ...team,
          members,
          leader: reps.find((rep) => rep.id === team.leader_rep_id) ?? null,
          ...totals,
          net: totals.invoices - totals.credit + totals.debit,
        };
      }),
    [teams, reps, sales, month]
  );

  const unassigned = reps.filter((rep) => rep.team_id === null);

  function resetForm() {
    setEditingId(null);
    setName("");
    setLeaderRepId("");
    setMemberIds([]);
  }

  function startEdit(team: Team) {
    setEditingId(team.id);
    setName(team.name);
    setLeaderRepId(team.leader_rep_id ? String(team.leader_rep_id) : "");
    setMemberIds(
      reps.filter((rep) => rep.team_id === team.id).map((rep) => rep.id)
    );
    document.getElementById("team-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  function toggleMember(id: number) {
    setMemberIds((current) =>
      current.includes(id)
        ? current.filter((memberId) => memberId !== id)
        : [...current, id]
    );
  }

  function chooseLeader(value: string) {
    setLeaderRepId(value);
    const id = Number(value);
    if (id && !memberIds.includes(id)) setMemberIds((current) => [...current, id]);
  }

  async function saveTeam() {
    if (!name.trim() || !leaderRepId) return;
    setSaving(true);
    const response = await fetch("/api/sales-teams", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        name: name.trim(),
        leaderRepId: Number(leaderRepId),
        memberIds,
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      alert(result.error || "Unable to save sales team.");
      return;
    }
    resetForm();
    router.refresh();
  }

  async function deleteTeam(team: Team) {
    if (!confirm(`${t.delete} ${team.name}?`)) return;
    const response = await fetch(`/api/sales-teams?id=${team.id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || "Unable to delete sales team.");
      return;
    }
    if (editingId === team.id) resetForm();
    router.refresh();
  }

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="records-page"
      style={{ minHeight: "100vh", background: "var(--page-bg)", color: "var(--text-primary)" }}
    >
      <Header
        active="teams"
        lang={lang}
        onToggleLang={() => setLang(lang === "en" ? "ar" : "en")}
      />
      <main className="records-layout sales-teams-page">
        <div className="records-heading">
          <div>
            <p>{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <span>{t.subtitle}</span>
          </div>
          <label className="team-month-filter">
            {t.month}
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="All">{t.allMonths}</option>
              {months.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <section id="team-editor" className="team-editor">
          <div className="team-editor__heading">
            <div>
              <p>{editingId ? t.editTeam : t.newTeam}</p>
              <h2>{editingId ? name : t.newTeam}</h2>
            </div>
            {editingId && <button type="button" onClick={resetForm}>{t.cancel}</button>}
          </div>
          <div className="team-editor__fields">
            <label>
              {t.teamName}
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              {t.leader}
              <select value={leaderRepId} onChange={(event) => chooseLeader(event.target.value)}>
                <option value="">{t.selectLeader}</option>
                {reps.map((rep) => (
                  <option key={rep.id} value={rep.id}>{rep.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="team-editor__members">
            <strong>{t.members}</strong>
            <small>{t.moveWarning}</small>
            <div>
              {reps.map((rep) => {
                const assignedTeam = teams.find((team) => team.id === rep.team_id);
                return (
                  <label key={rep.id}>
                    <input
                      type="checkbox"
                      checked={memberIds.includes(rep.id)}
                      onChange={() => toggleMember(rep.id)}
                    />
                    <span>{rep.name}</span>
                    {assignedTeam && assignedTeam.id !== editingId && (
                      <small>{assignedTeam.name}</small>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            className="team-editor__save"
            disabled={saving || !name.trim() || !leaderRepId}
            onClick={saveTeam}
          >
            {saving ? "..." : editingId ? t.update : t.save}
          </button>
        </section>

        <section className="team-grid">
          {teamResults.map((team) => (
            <article key={team.id} className="team-card">
              <div className="team-card__heading">
                <div>
                  <p>{team.name}</p>
                  <span>{team.leader?.name || "-"}</span>
                </div>
                <strong>{team.members.length} {t.memberCount}</strong>
              </div>
              <div className="team-card__metrics">
                <div><span>{t.invoices}</span><strong>{money(team.invoices, lang)}</strong></div>
                <div><span>{t.credit}</span><strong>{money(team.credit, lang)}</strong></div>
                <div><span>{t.debit}</span><strong>{money(team.debit, lang)}</strong></div>
                <div className="team-card__net"><span>{t.net}</span><strong>{money(team.net, lang)}</strong></div>
              </div>
              <div className="team-card__members">
                {team.members.map((member) => (
                  <span key={member.id}>{member.name}</span>
                ))}
              </div>
              <div className="team-card__actions">
                <button type="button" onClick={() => startEdit(team)}>{t.edit}</button>
                <button type="button" onClick={() => deleteTeam(team)}>{t.delete}</button>
              </div>
            </article>
          ))}
          {!teamResults.length && <p className="team-grid__empty">{t.noTeams}</p>}
        </section>

        <section className="unassigned-reps">
          <strong>{t.unassigned}</strong>
          <div>
            {unassigned.map((rep) => <span key={rep.id}>{rep.name}</span>)}
            {!unassigned.length && <span>—</span>}
          </div>
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

