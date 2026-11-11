import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { readDashboardSession } from "../../../lib/dashboard-auth";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../../lib/sales-visibility";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is not configured in Vercel." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const messages = Array.isArray(body.messages)
    ? body.messages.filter((item: ChatMessage) => (item?.role === "user" || item?.role === "assistant") && typeof item.content === "string").slice(-8)
    : [];
  const question = String(messages.at(-1)?.content ?? "").trim();
  if (!question) return NextResponse.json({ error: "Please enter a question." }, { status: 400 });

  const invoiceNumbers = [...new Set(question.match(/\b\d{1,12}(?:\.\d+)?\b/g) ?? [])].slice(0, 12);
  const { data: customers } = await supabase.from("customers").select("customer_code, customer_name, sales_rep_name").order("customer_name");
  const normalizedQuestion = question.toLocaleLowerCase();
  const matchedCustomer = (customers ?? []).filter((customer) => String(customer.customer_name || "").length > 3 && normalizedQuestion.includes(String(customer.customer_name).toLocaleLowerCase())).sort((a, b) => String(b.customer_name).length - String(a.customer_name).length)[0];

  let query = supabase.from("sales_view").select("invoice_no, sales_date, due_date, customer_name, sales_rep, sales_item_total, tax, total_sales, document_type, original_invoice_no, note_reason").order("sales_date", { ascending: false }).limit(invoiceNumbers.length || matchedCustomer ? 250 : 300);
  if (!canViewPre2026Sales(session)) query = query.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  if (session.salesRepName) query = query.eq("sales_rep", session.salesRepName);
  if (invoiceNumbers.length) query = query.in("invoice_no", invoiceNumbers);
  else if (matchedCustomer) query = query.eq("customer_name", matchedCustomer.customer_name);
  const { data: sales, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = sales ?? [];
  const summary = rows.reduce((total, row) => {
    const type = row.document_type || "INVOICE";
    const amount = Number(row.total_sales || 0);
    if (type === "CR_NOTE") total.creditNotes += Math.abs(amount);
    else if (type === "DR_NOTE") total.debitNotes += Math.abs(amount);
    else total.invoices += amount;
    return total;
  }, { invoices: 0, creditNotes: 0, debitNotes: 0 });

  const instructions = `You are the read-only UltraTeb dashboard financial assistant. Answer only from the supplied dashboard data. Never claim to edit, delete, allocate, approve, or save records. Be concise, use EGP, show calculations when useful, and clearly say when the available data is insufficient. The signed-in user is ${session.username} (${session.role})${session.salesRepName ? ` and may only see ${session.salesRepName}'s records` : ""}.`;
  const context = { matchedCustomer: matchedCustomer?.customer_name ?? null, visibleRecordCount: rows.length, summary, records: rows };
  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      max_output_tokens: 900,
      instructions,
      input: [...messages.slice(0, -1), { role: "user", content: `${question}\n\nDashboard data (JSON):\n${JSON.stringify(context)}` }],
    }),
  });
  const result = await apiResponse.json();
  if (!apiResponse.ok) return NextResponse.json({ error: result?.error?.message || "OpenAI request failed." }, { status: 502 });
  const answer = result.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === "output_text")?.text;
  return NextResponse.json({ answer: answer || "I could not produce an answer from the available data." });
}
