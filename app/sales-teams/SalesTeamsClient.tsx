"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../Header";
import Footer from "../Footer";

const currentTeamMonth = `${new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", month: "short" }).format(new Date())}.${new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", year: "numeric" }).format(new Date())}`;

type Team = {
  id: number;
  name: string;
  leader_rep_id: number | null;
};

type SalesRep = {
  id: number;
  name: string;
  team_id: number | null;
  bonus_type:
    | "PERCENTAGE"
    | "FIXED_MONTHLY"
    | "DUAL_PERCENTAGE"
    | "TIERED_EXCESS";
  bonus_percentage: number;
  secondary_bonus_percentage: number;
  fixed_monthly_bonus: number;
  monthly_salary: number;
};

type TeamSale = {
  id: string;
  month: string;
  sales_rep: string | null;
  total_sales: number;
  document_type: "INVOICE" | "CR_NOTE" | "DR_NOTE" | null;
};

type SalaryDeduction = {
  sales_rep_id: number;
  month: string;
  amount: number;
  reason: string | null;
};

type BonusDraft = {
  type: SalesRep["bonus_type"];
  percentage: string;
  secondary: string;
  fixed: string;
  salary: string;
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
    dualPercentage: "Own Sales + Mostafa Sales",
    tieredExcess: "Tiered + Excess Percentage",
    ownSalesPercentage: "Own Sales %",
    mostafaSalesPercentage: "Mostafa Sales %",
    excessPercentage: "Excess Above 300K %",
    tieredNote:
      "0 below 100K; 1,000 at 100K; +500 for every additional 50K up to 300K; then 3,000 plus the excess percentage.",
    value: "Value",
    calculated: "Calculated Bonus",
    salary: "Monthly Salary",
    deduction: "Salary Deduction",
    deductionReason: "Deduction Reason",
    selectMonthDeduction: "Select a specific month to enter its salary deduction.",
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
    dualPercentage: "المبيعات الخاصة + مبيعات مصطفى",
    tieredExcess: "شرائح + نسبة الزيادة",
    ownSalesPercentage: "نسبة المبيعات الخاصة",
    mostafaSalesPercentage: "نسبة مبيعات مصطفى",
    excessPercentage: "نسبة الزيادة فوق 300 ألف",
    tieredNote:
      "صفر أقل من 100 ألف، و1000 عند 100 ألف، و500 لكل 50 ألف إضافية حتى 300 ألف، ثم 3000 + نسبة الزيادة.",
    value: "القيمة",
    calculated: "البونص المحسوب",
    salary: "الراتب الشهري",
    deduction: "خصم الراتب",
    deductionReason: "سبب الخصم",
    selectMonthDeduction: "اختر شهراً محدداً لإدخال خصم الراتب.",
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
  deductions,
}: {
  teams: Team[];
  reps: SalesRep[];
  sales: TeamSale[];
  deductions: SalaryDeduction[];
}) {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [month, setMonth] = useState(currentTeamMonth);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [teamName, setTeamName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [savingBonusId, setSavingBonusId] = useState<number | null>(null);
  const [deductionDrafts, setDeductionDrafts] = useState<Record<string, string>>(
    () => Object.fromEntries(deductions.map((item) => [`${item.sales_rep_id}:${item.month}`, String(item.amount ?? 0)]))
  );
  const [deductionReasonDrafts, setDeductionReasonDrafts] = useState<Record<string, string>>(
    () => Object.fromEntries(deductions.map((item) => [`${item.sales_rep_id}:${item.month}`, item.reason ?? ""]))
  );
  const [bonusDrafts, setBonusDrafts] = useState<Record<number, BonusDraft>>(
    () =>
      Object.fromEntries(
        reps.map((rep) => [
          rep.id,
          {
            type: rep.bonus_type ?? "PERCENTAGE",
            percentage: String(rep.bonus_percentage ?? 0),
            secondary: String(rep.secondary_bonus_percentage ?? 0),
            fixed: String(rep.fixed_monthly_bonus ?? 0),
            salary: String(rep.monthly_salary ?? 0),
          },
        ])
      )
  );
  const t = text[lang];

  const months = useMemo(
    () =>
      Array.from(new Set([currentTeamMonth, ...sales.map((sale) => sale.month).filter(Boolean)])).sort(
        (a, b) => monthSortValue(b) - monthSortValue(a)
      ),
    [sales]
  );

  const representativeResults = useMemo(() => {
    const netForMonth = (repName: string, targetMonth: string) =>
      sales
        .filter(
          (sale) =>
            normalizedName(sale.sales_rep) === normalizedName(repName) &&
            sale.month === targetMonth
        )
        .reduce((sum, sale) => {
          const amount = Math.abs(Number(sale.total_sales || 0));
          if (sale.document_type === "CR_NOTE") return sum - amount;
          if (sale.document_type === "DR_NOTE") return sum + amount;
          return sum + amount;
        }, 0);

    const bonusMonths = month === "All" ? months : [month];

    return new Map<number, RepPerformance>(
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
          const bonus = bonusMonths.reduce((sum, bonusMonth) => {
            const ownNet = Math.max(netForMonth(rep.name, bonusMonth), 0);

            if (rep.bonus_type === "FIXED_MONTHLY") {
              return (
                sum +
                (ownNet > 0 ? Number(rep.fixed_monthly_bonus || 0) : 0)
              );
            }

            if (rep.bonus_type === "DUAL_PERCENTAGE") {
              const mostafaNet = Math.max(
                netForMonth("Mostafa", bonusMonth),
                0
              );
              return (
                sum +
                ownNet * (Number(rep.bonus_percentage || 0) / 100) +
                mostafaNet *
                  (Number(rep.secondary_bonus_percentage || 0) / 100)
              );
            }

            if (rep.bonus_type === "TIERED_EXCESS") {
              if (ownNet < 100000) return sum;
              if (ownNet <= 300000) {
                return sum + Math.floor(ownNet / 50000) * 500;
              }
              return (
                sum +
                3000 +
                (ownNet - 300000) *
                  (Number(rep.bonus_percentage || 0) / 100)
              );
            }

            return (
              sum + ownNet * (Number(rep.bonus_percentage || 0) / 100)
            );
          }, 0);
          return [rep.id, { ...rep, ...totals, net, bonus }] as [
            number,
            RepPerformance,
          ];
        })
      );
  }, [reps, sales, month, months]);

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
        secondary: current[repId]?.secondary ?? "0",
        fixed: current[repId]?.fixed ?? "0",
        salary: current[repId]?.salary ?? "0",
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
        secondaryBonusPercentage: Number(draft.secondary || 0),
        fixedMonthlyBonus: Number(draft.fixed || 0),
        monthlySalary: Number(draft.salary || 0),
        deductionMonth: month,
        salaryDeduction: Number(deductionDrafts[`${repId}:${month}`] || 0),
        deductionReason: deductionReasonDrafts[`${repId}:${month}`] ?? "",
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
      secondary: String(member.secondary_bonus_percentage ?? 0),
      fixed: String(member.fixed_monthly_bonus ?? 0),
      salary: String(member.monthly_salary ?? 0),
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
        <label className="team-bonus__method">
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
            <option value="DUAL_PERCENTAGE">{t.dualPercentage}</option>
            <option value="TIERED_EXCESS">{t.tieredExcess}</option>
          </select>
        </label>
        {draft.type === "FIXED_MONTHLY" ? (
          <label>
            {t.value}
            <div className="team-bonus__value">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.fixed}
                onChange={(event) =>
                  changeBonus(member.id, { fixed: event.target.value })
                }
              />
              <span>EGP</span>
            </div>
          </label>
        ) : (
          <label>
            {draft.type === "DUAL_PERCENTAGE"
              ? t.ownSalesPercentage
              : draft.type === "TIERED_EXCESS"
                ? t.excessPercentage
                : t.value}
            <div className="team-bonus__value">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={draft.percentage}
                onChange={(event) =>
                  changeBonus(member.id, { percentage: event.target.value })
                }
              />
              <span>%</span>
            </div>
          </label>
        )}
        {draft.type === "DUAL_PERCENTAGE" && (
          <label>
            {t.mostafaSalesPercentage}
            <div className="team-bonus__value">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={draft.secondary}
                onChange={(event) =>
                  changeBonus(member.id, { secondary: event.target.value })
                }
              />
              <span>%</span>
            </div>
          </label>
        )}
        {draft.type === "TIERED_EXCESS" && (
          <small className="team-bonus__rule-note">{t.tieredNote}</small>
        )}
        {month !== "All" ? (<>
          <label>
            {t.deduction} ({month})
            <div className="team-bonus__value">
              <input
                type="number"
                min="0"
                step="0.01"
                value={deductionDrafts[`${member.id}:${month}`] ?? "0"}
                onChange={(event) =>
                  setDeductionDrafts((current) => ({
                    ...current,
                    [`${member.id}:${month}`]: event.target.value,
                  }))
                }
              />
              <span>EGP</span>
            </div>
          </label>
          <label>
            {t.deductionReason}
            <input
              type="text"
              value={deductionReasonDrafts[`${member.id}:${month}`] ?? ""}
              onChange={(event) =>
                setDeductionReasonDrafts((current) => ({
                  ...current,
                  [`${member.id}:${month}`]: event.target.value,
                }))
              }
              placeholder={t.deductionReason}
            />
          </label>
        </>) : (
          <small className="team-bonus__rule-note">{t.selectMonthDeduction}</small>
        )}
        <label>
          {t.salary}
          <div className="team-bonus__value">
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.salary}
              onChange={(event) =>
                changeBonus(member.id, { salary: event.target.value })
              }
            />
            <span>EGP</span>
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
                <div className="team-card__heading-actions">
                  <strong>
                    {team.members.length} {t.memberCount}
                  </strong>
                  <div className="team-card__actions">
                    <button type="button" onClick={() => startEdit(team)}>
                      {t.edit}
                    </button>
                    <button type="button" onClick={() => deleteTeam(team)}>
                      {t.delete}
                    </button>
                  </div>
                </div>
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
