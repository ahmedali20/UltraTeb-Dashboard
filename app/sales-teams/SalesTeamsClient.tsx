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
  bonus_type: "PERCENTAGE" | "FIXED_MONTHLY";
  bonus_percentage: number;
  fixed_monthly_bonus: number;
};

type TeamSale = {
  id: string;
  month: string;
  sales_rep: string | null;
  total_sales: number;
  document_type: "INVOICE" | "CR_NOTE" | "DR_NOTE" | null;
};

type BonusDraft = {
  type: "PERCENTAGE" | "FIXED_MONTHLY";
  percentage: string;
  fixed: string;
};

type RepPerformance = SalesRep & {
  invoices: number;
  credit: number;
  debit: number;
  net: number;
  bonus: number;
};

const text = {
  en: {
    eyebrow: "SALES ORGANIZATION",
    title: "Sales Teams",
    subtitle:
      "Create teams, assign one team per representative, and manage bonuses.",
    performanceMonth: "Performance Month",
    allMonths: "All Months",
    create: "Create Sales Team",
    editTeam: "Edit Sales Team",
    teamName: "Team Name",
    leader: "Team Leader",
    selectLeader: "Select team leader",
    members: "Team Members",
    moveWarning:
      "Selecting a representative assigned elsewhere will move them to this team.",
    saveTeam: "Save Team",
    updateTeam: "Update Team",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    memberCount: "members",
    invoices: "Invoice Sales",
    credit: "Credit Notes",
    debit: "Debit Notes",
    net: "Net Sales",
    totalBonus: "Total Bonus",
    bonusSettings: "Representative Bonus",
    method: "Method",
    percentage: "Percentage",
    fixed: "Fixed Monthly",
    value: "Value",
    calculated: "Calculated Bonus",
    save: "Save",
    allMonthsNote:
      "For All Months, fixed bonus is counted once per month containing sales.",
    unassigned: "Unassigned Representatives",
    noTeams: "No sales teams created yet.",
  },
  ar: {
    eyebrow: "إدارة المبيعات",
    title: "فرق المبيعات",
    subtitle: "أنشئ الفرق وعيّن فريقاً واحداً لكل مندوب وتحكم في البونص.",
    performanceMonth: "شهر الأداء",
    allMonths: "كل الشهور",
    create: "إنشاء فريق مبيعات",
    editTeam: "تعديل فريق المبيعات",
    teamName: "اسم الفريق",
    leader: "قائد الفريق",
    selectLeader: "اختر قائد الفريق",
    members: "أعضاء الفريق",
    moveWarning: "اختيار مندوب من فريق آخر سينقله إلى هذا الفريق.",
    saveTeam: "حفظ الفريق",
    updateTeam: "تحديث الفريق",
    cancel: "إلغاء",
    edit: "تعديل",
    delete: "حذف",
    memberCount: "أعضاء",
    invoices: "مبيعات الفواتير",
    credit: "الإشعارات الدائنة",
    debit: "الإشعارات المدينة",
    net: "صافي المبيعات",
    totalBonus: "إجمالي البونص",
    bonusSettings: "بونص المندوب",
    method: "الطريقة",
    percentage: "نسبة مئوية",
    fixed: "مبلغ شهري ثابت",
    value: "القيمة",
    calculated: "البونص المحسوب",
    save: "حفظ",
    allMonthsNote:
      "عند اختيار كل الشهور، يحتسب المبلغ الثابت مرة لكل شهر به مبيعات.",
    unassigned: "مندوبون بدون فريق",
    noTeams: "لم يتم إنشاء فرق مبيعات بعد.",
  },
};

function normalizedName(value: string | null) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function currency(value: number, lang: "en" | "ar") {
  return value.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function monthSortValue(value: string) {
  const parsed = Date.parse(`1 ${value.replace(/[._/-]+/g, " ").trim()}`);
  return Number.isNaN(parsed) ? 0 : parsed;
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
  const [teamName, setTeamName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [savingBonusId, setSavingBonusId] = useState<number | null>(null);
  const [bonusDrafts, setBonusDrafts] = useState<Record<number, BonusDraft>>(
    () =>
      Object.fromEntries(
        reps.map((rep) => [
          rep.id,
          {
            type: rep.bonus_type ?? "PERCENTAGE",
            percentage: String(rep.bonus_percentage ?? 0),
            fixed: String(rep.fixed_monthly_bonus ?? 0),
          },
        ])
      )
  );
  const t = text[lang];

  const months = useMemo(
    () =>
      Array.from(new Set(sales.map((sale) => sale.month).filter(Boolean))).sort(
        (a, b) => monthSortValue(b) - monthSortValue(a)
      ),
    [sales]
  );

  const representativeResults = useMemo(
    () =>
      new Map<number, RepPerformance>(
        reps.map((rep) => {
          const repSales = sales.filter(
            (sale) =>
              normalizedName(sale.sales_rep) === normalizedName(rep.name) &&
              (month === "All" || sale.month === month)
          );
          const totals = repSales.reduce(
            (sum, sale) => {
              const amount = Math.abs(Number(sale.total_sales || 0));
              if (sale.document_type === "CR_NOTE") sum.credit += amount;
              else if (sale.document_type === "DR_NOTE") sum.debit += amount;
              else sum.invoices += amount;
              return sum;
            },
            { invoices: 0, credit: 0, debit: 0 }
          );
          const net = totals.invoices - totals.credit + totals.debit;
          const activeMonths =
            month === "All"
              ? new Set(repSales.map((sale) => sale.month).filter(Boolean)).size
              : 1;
          const bonus =
            rep.bonus_type === "FIXED_MONTHLY"
              ? Number(rep.fixed_monthly_bonus || 0) *
                (repSales.length ? activeMonths : 0)
              : Math.max(net, 0) *
                (Number(rep.bonus_percentage || 0) / 100);
          return [rep.id, { ...rep, ...totals, net, bonus }] as [
            number,
            RepPerformance,
          ];
        })
      ),
    [reps, sales, month]
  );

  const teamResults = useMemo(
    () =>
      teams.map((team) => {
        const members = reps
          .filter((rep) => rep.team_id === team.id)
          .map((rep) => representativeResults.get(rep.id)!)
          .filter(Boolean);

        const totals = members.reduce(
          (sum, member) => ({
            invoices: sum.invoices + member.invoices,
            credit: sum.credit + member.credit,
            debit: sum.debit + member.debit,
            net: sum.net + member.net,
            bonus: sum.bonus + member.bonus,
          }),
          { invoices: 0, credit: 0, debit: 0, net: 0, bonus: 0 }
        );

        return {
          ...team,
          members,
          leader: reps.find((rep) => rep.id === team.leader_rep_id) ?? null,
          ...totals,
        };
      }),
    [teams, reps, representativeResults]
  );

  const unassigned = reps
    .filter((rep) => rep.team_id === null)
    .map((rep) => representativeResults.get(rep.id)!)
    .filter(Boolean);

  function resetEditor() {
    setEditingId(null);
    setTeamName("");
    setLeaderId("");
    setMemberIds([]);
  }

  function selectLeader(value: string) {
    setLeaderId(value);
    const numericId = Number(value);
    if (numericId) {
      setMemberIds((current) =>
        current.includes(numericId) ? current : [...current, numericId]
      );
    }
  }

  function toggleMember(id: number) {
    setMemberIds((current) =>
      current.includes(id)
        ? current.filter((memberId) => memberId !== id)
        : [...current, id]
    );
  }

  function startEdit(team: Team) {
    setEditingId(team.id);
    setTeamName(team.name);
    setLeaderId(team.leader_rep_id ? String(team.leader_rep_id) : "");
    setMemberIds(
      reps.filter((rep) => rep.team_id === team.id).map((rep) => rep.id)
    );
    document
      .getElementById("team-editor")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function saveTeam() {
    if (!teamName.trim() || !leaderId) return;
    setSavingTeam(true);
    const response = await fetch("/api/sales-teams", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        name: teamName.trim(),
        leaderRepId: Number(leaderId),
        memberIds,
      }),
    });
    const result = await response.json();
    setSavingTeam(false);
    if (!response.ok) {
      alert(result.error || "Unable to save sales team.");
      return;
    }
    resetEditor();
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
    if (editingId === team.id) resetEditor();
    router.refresh();
  }

  function changeBonus(repId: number, changes: Partial<BonusDraft>) {
    setBonusDrafts((current) => ({
      ...current,
      [repId]: {
        type: current[repId]?.type ?? "PERCENTAGE",
        percentage: current[repId]?.percentage ?? "0",
        fixed: current[repId]?.fixed ?? "0",
        ...changes,
      },
    }));
  }

  async function saveBonus(repId: number) {
    const draft = bonusDrafts[repId];
    if (!draft) return;
    setSavingBonusId(repId);
    const response = await fetch("/api/sales-reps/bonus", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: repId,
        bonusType: draft.type,
        bonusPercentage: Number(draft.percentage || 0),
        fixedMonthlyBonus: Number(draft.fixed || 0),
      }),
    });
    const result = await response.json();
    setSavingBonusId(null);
    if (!response.ok) {
      alert(result.error || "Unable to save bonus.");
      return;
    }
    router.refresh();
  }

  function renderBonusRow(member: RepPerformance) {
    const draft = bonusDrafts[member.id] ?? {
      type: member.bonus_type,
      percentage: String(member.bonus_percentage ?? 0),
      fixed: String(member.fixed_monthly_bonus ?? 0),
    };
    return (
      <div key={member.id} className="team-bonus__row">
        <div>
          <strong>{member.name}</strong>
          <small>
            {t.net}: {currency(member.net, lang)}
          </small>
          <div className="team-bonus__inline-calculated">
            <span>{t.calculated}</span>
            <strong>{currency(member.bonus, lang)}</strong>
          </div>
        </div>
        <label>
          {t.method}
          <select
            value={draft.type}
            onChange={(event) =>
              changeBonus(member.id, {
                type: event.target.value as BonusDraft["type"],
              })
            }
          >
            <option value="PERCENTAGE">{t.percentage}</option>
            <option value="FIXED_MONTHLY">{t.fixed}</option>
          </select>
        </label>
        <label>
          {t.value}
          <div className="team-bonus__value">
            <input
              type="number"
              min="0"
              max={draft.type === "PERCENTAGE" ? 100 : undefined}
              step={draft.type === "PERCENTAGE" ? "0.1" : "0.01"}
              value={
                draft.type === "PERCENTAGE"
                  ? draft.percentage
                  : draft.fixed
              }
              onChange={(event) =>
                changeBonus(
                  member.id,
                  draft.type === "PERCENTAGE"
                    ? { percentage: event.target.value }
                    : { fixed: event.target.value }
                )
              }
            />
            <span>{draft.type === "PERCENTAGE" ? "%" : "EGP"}</span>
          </div>
        </label>
        <div className="team-bonus__save-row">
          <button
            type="button"
            disabled={savingBonusId === member.id}
            onClick={() => saveBonus(member.id)}
          >
            {savingBonusId === member.id ? "..." : t.save}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="records-page"
      style={{
        minHeight: "100vh",
        background: "var(--page-bg)",
        color: "var(--text-primary)",
      }}
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
            {t.performanceMonth}
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              <option value="All">{t.allMonths}</option>
              {months.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section id="team-editor" className="team-editor">
          <div className="team-editor__heading">
            <div>
              <p>{editingId ? t.editTeam : t.create}</p>
              <h2>{editingId ? teamName : t.create}</h2>
            </div>
            {editingId && (
              <button type="button" onClick={resetEditor}>
                {t.cancel}
              </button>
            )}
          </div>
          <div className="team-editor__fields">
            <label>
              {t.teamName}
              <input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
              />
            </label>
            <label>
              {t.leader}
              <select
                value={leaderId}
                onChange={(event) => selectLeader(event.target.value)}
              >
                <option value="">{t.selectLeader}</option>
                {reps.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="team-editor__members">
            <strong>{t.members}</strong>
            <small>{t.moveWarning}</small>
            <div>
              {reps.map((rep) => {
                const assignedTeam = teams.find(
                  (team) => team.id === rep.team_id
                );
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
            disabled={savingTeam || !teamName.trim() || !leaderId}
            onClick={saveTeam}
          >
            {savingTeam
              ? "..."
              : editingId
                ? t.updateTeam
                : t.saveTeam}
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
                <strong>
                  {team.members.length} {t.memberCount}
                </strong>
              </div>
              <div className="team-card__metrics">
                <div>
                  <span>{t.invoices}</span>
                  <strong>{currency(team.invoices, lang)}</strong>
                </div>
                <div>
                  <span>{t.credit}</span>
                  <strong>{currency(team.credit, lang)}</strong>
                </div>
                <div>
                  <span>{t.debit}</span>
                  <strong>{currency(team.debit, lang)}</strong>
                </div>
                <div className="team-card__net">
                  <span>{t.net}</span>
                  <strong>{currency(team.net, lang)}</strong>
                </div>
                <div className="team-card__bonus">
                  <span>{t.totalBonus}</span>
                  <strong>{currency(team.bonus, lang)}</strong>
                </div>
              </div>

              <div className="team-bonus">
                <div className="team-bonus__heading">
                  <strong>{t.bonusSettings}</strong>
                  {month === "All" && <small>{t.allMonthsNote}</small>}
                </div>
                {team.members.map(renderBonusRow)}
              </div>

              <div className="team-card__actions">
                <button type="button" onClick={() => startEdit(team)}>
                  {t.edit}
                </button>
                <button type="button" onClick={() => deleteTeam(team)}>
                  {t.delete}
                </button>
              </div>
            </article>
          ))}
          {!teamResults.length && (
            <p className="team-grid__empty">{t.noTeams}</p>
          )}
        </section>

        <section className="unassigned-reps">
          <strong>{t.unassigned}</strong>
          {month === "All" && <small>{t.allMonthsNote}</small>}
          <div className="team-bonus">
            {unassigned.map(renderBonusRow)}
            {!unassigned.length && <span>-</span>}
          </div>
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
