import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../lib/dashboard-auth";
import { hasDashboardPermission } from "../../../lib/dashboard-permissions";
import { writeAuditLog } from "../../../lib/audit-log";
import { NON_ADMIN_SALES_START_DATE } from "../../../lib/sales-visibility";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

async function editableSession(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  return session && hasDashboardPermission(session, "collections", "edit") ? session : null;
}

function collectionValues(body: Record<string, unknown>) {
  const paymentMethod = String(body.paymentMethod ?? "BANK_TRANSFER").trim().toUpperCase();
  const bankAmount = Number(body.amount ?? 0);
  const transferFees = paymentMethod === "BANK_TRANSFER" ? Number(body.transferFees ?? 0) : 0;
  const cashFraction = paymentMethod === "CASH" ? Number(body.cashFraction ?? 0) : 0;
  const whtDeductedAmount = Number(body.whtDeductedAmount ?? 0);
  return {
    collection_date: String(body.collectionDate ?? "").trim(),
    amount: bankAmount + transferFees,
    transfer_fees: transferFees,
    cash_fraction: cashFraction,
    wht_deducted_amount: whtDeductedAmount,
    payment_method: paymentMethod,
    reference_no: String(body.referenceNo ?? "").trim() || null,
    notes: String(body.notes ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function validationError(values: ReturnType<typeof collectionValues>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.collection_date)) return "Collection date is required.";
  if (!Number.isFinite(values.amount) || values.amount <= 0) return "Collected amount must be greater than zero.";
  if (!Number.isFinite(values.transfer_fees) || values.transfer_fees < 0) return "Transfer fees must be zero or greater.";
  if (!Number.isFinite(values.cash_fraction) || values.cash_fraction < 0) return "Cash fraction must be zero or greater.";
  if (!Number.isFinite(values.wht_deducted_amount) || values.wht_deducted_amount < 0) return "WHT deducted amount must be zero or greater.";
  if (!["CASH", "BANK_TRANSFER", "CHEQUE", "OTHER"].includes(values.payment_method)) return "Invalid payment method.";
  if (values.payment_method === "CHEQUE" && !values.reference_no) return "Cheque number is required.";
  return null;
}

async function permittedInvoice(invoiceId: string, salesRepName: string | null, isAdmin: boolean) {
  let query = supabase.from("sales_view").select("id, invoice_no, customer_code, customer_name, sales_rep, sales_date, document_type, sales_item_total, total_sales").eq("id", invoiceId).eq("document_type", "INVOICE");
  if (salesRepName) query = query.eq("sales_rep", salesRepName);
  if (!isAdmin) query = query.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  const { data: notes } = await supabase
    .from("sales_view")
    .select("sales_item_total, total_sales, sales_date, document_type")
    .eq("customer_code", data.customer_code)
    .eq("original_invoice_no", String(data.invoice_no))
    .in("document_type", ["CR_NOTE", "DR_NOTE"])
    .gte("sales_date", data.sales_date);
  const adjustments = (notes ?? []).reduce((sum, note) => ({
    salesItemTotal: sum.salesItemTotal + Number(note.sales_item_total || 0),
    totalSales: sum.totalSales + Number(note.total_sales || 0),
    wht: sum.wht + Math.round(Number(note.sales_item_total || 0)) / 100,
  }), { salesItemTotal: 0, totalSales: 0, wht: 0 });
  return {
    ...data,
    sales_item_total: Number(data.sales_item_total || 0) + adjustments.salesItemTotal,
    total_sales: Number(data.total_sales || 0) + adjustments.totalSales,
    note_wht_adjustment: adjustments.wht,
  };
}

async function settledInvoiceAmount(invoice: any, excludeCollectionIds: number[] = []) {
  let collectionsQuery = supabase
    .from("invoice_collections")
    .select("id, amount, transfer_fees, cash_fraction, wht_deducted_amount")
    .eq("invoice_id", String(invoice.id))
    .neq("payment_method", "CHEQUE");
  if (excludeCollectionIds.length) collectionsQuery = collectionsQuery.not("id", "in", `(${excludeCollectionIds.join(",")})`);

  const [collectionsResult, allocationsResult, recordedWhtResult] = await Promise.all([
    collectionsQuery,
    supabase
      .from("cheque_allocations")
      .select("cheque_id, allocated_amount, cash_fraction, wht_deducted_amount")
      .eq("invoice_id", String(invoice.id)),
    supabase
      .from("wht_collections")
      .select("wht_amount")
      .eq("document_type", "INVOICE")
      .eq("invoice_no", String(invoice.invoice_no)),
  ]);
  if (collectionsResult.error) throw collectionsResult.error;
  if (allocationsResult.error) throw allocationsResult.error;
  if (recordedWhtResult.error) throw recordedWhtResult.error;

  const chequeIds = Array.from(new Set((allocationsResult.data ?? []).map((item) => String(item.cheque_id))));
  const activeChequeIds = new Set<string>();
  if (chequeIds.length) {
    const { data, error } = await supabase
      .from("customer_cheques")
      .select("id, cheque_status")
      .in("id", chequeIds);
    if (error) throw error;
    (data ?? []).forEach((item) => {
      if (!["REFUSED", "RETURNED_TO_CUSTOMER"].includes(String(item.cheque_status))) {
        activeChequeIds.add(String(item.id));
      }
    });
  }

  let payments = 0;
  let deductedWht = 0;
  (collectionsResult.data ?? []).forEach((item) => {
    payments += Math.max(0, Number(item.amount || 0) - Number(item.transfer_fees || 0)) + Number(item.cash_fraction || 0);
    deductedWht += Number(item.wht_deducted_amount || 0);
  });
  (allocationsResult.data ?? []).forEach((item) => {
    if (!activeChequeIds.has(String(item.cheque_id))) return;
    payments += Number(item.allocated_amount || 0) + Number(item.cash_fraction || 0);
    deductedWht += Number(item.wht_deducted_amount || 0);
  });
  const recordedWht = (recordedWhtResult.data ?? []).reduce(
    (sum, item) => sum + Number(item.wht_amount || 0),
    0
  );
  const recordedWhtWithNotes = Math.max(0, recordedWht + Number(invoice.note_wht_adjustment || 0));
  return payments + Math.max(deductedWht, recordedWhtWithNotes);
}

async function addAutomaticFraction(invoice: any, values: ReturnType<typeof collectionValues>, excludeCollectionIds: number[] = []) {
  const alreadySettled = await settledInvoiceAmount(invoice, excludeCollectionIds);
  const remaining = Math.round(
    (Number(invoice.total_sales || 0) - alreadySettled - (values.amount - values.transfer_fees) -
      values.cash_fraction - values.wht_deducted_amount) * 100
  ) / 100;
  if (remaining > 0 && remaining < 1) {
    values.cash_fraction = Math.round((values.cash_fraction + remaining) * 100) / 100;
  }
  return values;
}

async function existingWhtDeduction(invoiceId: string, excludeCollectionIds: number[] = []) {
  let collectionsQuery = supabase
    .from("invoice_collections")
    .select("wht_deducted_amount")
    .eq("invoice_id", invoiceId);
  if (excludeCollectionIds.length) collectionsQuery = collectionsQuery.not("id", "in", `(${excludeCollectionIds.join(",")})`);
  const [collectionsResult, allocationsResult] = await Promise.all([
    collectionsQuery,
    supabase.from("cheque_allocations").select("wht_deducted_amount").eq("invoice_id", invoiceId),
  ]);
  if (collectionsResult.error) throw collectionsResult.error;
  if (allocationsResult.error) throw allocationsResult.error;
  return [...(collectionsResult.data ?? []), ...(allocationsResult.data ?? [])]
    .reduce((sum, item) => sum + Number(item.wht_deducted_amount || 0), 0);
}

export async function POST(request: NextRequest) {
  const session = await editableSession(request);
  if (!session) return NextResponse.json({ error: "Collections edit permission required." }, { status: 403 });
  const body = await request.json();
  const invoiceId = String(body.invoiceId ?? "").trim();
  const values = collectionValues(body);
  const errorMessage = validationError(values);
  if (errorMessage) return NextResponse.json({ error: errorMessage }, { status: 400 });

  if (values.payment_method === "CHEQUE") {
    const customerName = String(body.customerName ?? "").trim();
    const chequeDate = String(body.chequeDate ?? "").trim();
    const bankName = String(body.bankName ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(chequeDate)) return NextResponse.json({ error: "Cheque date is required." }, { status: 400 });
    if (!bankName) return NextResponse.json({ error: "Bank name is required." }, { status: 400 });
    const rawAllocations: Record<string, unknown>[] = Array.isArray(body.allocations) ? body.allocations : [];
    const allocations: { invoiceId: string; amount: number; whtDeductedAmount: number }[] = rawAllocations
      .map((item: Record<string, unknown>) => ({
        invoiceId: String(item.invoiceId ?? "").trim(),
        amount: Number(item.amount ?? 0),
        whtDeductedAmount: Number(item.whtDeductedAmount ?? 0),
      }))
      .filter((item: { invoiceId: string; amount: number; whtDeductedAmount: number }) =>
        Boolean(item.invoiceId) && Number.isFinite(item.amount) && item.amount > 0 && Number.isFinite(item.whtDeductedAmount) && item.whtDeductedAmount >= 0
      );
    const allocatedTotal = allocations.reduce((sum, item) => sum + item.amount, 0);
    if (!customerName || !allocations.length) return NextResponse.json({ error: "Customer and at least one invoice allocation are required." }, { status: 400 });
    if (allocatedTotal > values.amount + 0.01) return NextResponse.json({ error: "Total invoice allocations cannot exceed the cheque amount." }, { status: 400 });

    const invoices: { invoice: any; amount: number; cashFraction: number; whtDeductedAmount: number }[] = [];
    for (const allocation of allocations) {
      const invoice = await permittedInvoice(allocation.invoiceId, session.salesRepName, session.role === "admin");
      if (!invoice || invoice.customer_name !== customerName) return NextResponse.json({ error: "Every allocated invoice must belong to the selected customer and be available to this user." }, { status: 400 });
      if (allocation.whtDeductedAmount > 0 && await existingWhtDeduction(allocation.invoiceId) > 0.005) {
        return NextResponse.json({ error: `WHT was already deducted for invoice ${invoice.invoice_no}.` }, { status: 409 });
      }
      const alreadySettled = await settledInvoiceAmount(invoice);
      const remainingAfterCheque = Math.round(
        (Number(invoice.total_sales || 0) - alreadySettled - allocation.amount - allocation.whtDeductedAmount) * 100
      ) / 100;
      const cashFraction = remainingAfterCheque > 0 && remainingAfterCheque < 1 ? remainingAfterCheque : 0;
      invoices.push({ invoice, amount: allocation.amount, cashFraction, whtDeductedAmount: allocation.whtDeductedAmount });
    }
    const customerCode = invoices[0].invoice.customer_code;
    const chequePayload = {
      customer_code: customerCode,
      customer_name: customerName,
      collection_date: values.collection_date,
      cheque_no: values.reference_no,
      bank_name: bankName,
      cheque_date: chequeDate,
      amount: values.amount,
      cheque_status: "IN_TREASURY",
      cheque_status_date: values.collection_date,
      notes: values.notes,
    };
    const { data: existingCheque, error: existingChequeError } = await supabase
      .from("customer_cheques")
      .select("*")
      .eq("customer_code", customerCode)
      .eq("cheque_no", values.reference_no)
      .maybeSingle();
    if (existingChequeError) return NextResponse.json({ error: existingChequeError.message }, { status: 400 });

    let cheque = existingCheque;
    let createdCheque = false;
    if (!cheque) {
      const { data, error: chequeError } = await supabase
        .from("customer_cheques")
        .insert(chequePayload)
        .select("*")
        .single();
      if (chequeError) return NextResponse.json({ error: chequeError.message }, { status: 400 });
      cheque = data;
      createdCheque = true;
    } else {
      const sameCheque =
        Math.abs(Number(cheque.amount) - values.amount) <= 0.01 &&
        cheque.cheque_date === chequeDate &&
        cheque.collection_date === values.collection_date &&
        String(cheque.bank_name ?? "").trim().toLowerCase() === bankName.toLowerCase();
      if (!sameCheque) {
        return NextResponse.json({
          error: `Cheque ${values.reference_no} already exists for this customer with different details. Open it from the Cheques page instead of creating it again.`,
        }, { status: 409 });
      }
    }

    const { data: existingAllocations, error: existingAllocationError } = await supabase
      .from("cheque_allocations")
      .select("*")
      .eq("cheque_id", cheque.id);
    if (existingAllocationError) return NextResponse.json({ error: existingAllocationError.message }, { status: 400 });
    const allocationPayload = invoices.map(({ invoice, amount, cashFraction, whtDeductedAmount }) => ({ cheque_id: cheque.id, invoice_id: String(invoice.id), invoice_no: String(invoice.invoice_no), allocated_amount: amount, cash_fraction: cashFraction, wht_deducted_amount: whtDeductedAmount }));
    const requestedSignature = allocationPayload
      .map((item) => `${item.invoice_id}:${Number(item.allocated_amount).toFixed(2)}:${Number(item.cash_fraction).toFixed(2)}:${Number(item.wht_deducted_amount).toFixed(2)}`)
      .sort()
      .join("|");
    const existingSignature = (existingAllocations ?? [])
      .map((item) => `${String(item.invoice_id)}:${Number(item.allocated_amount).toFixed(2)}:${Number(item.cash_fraction || 0).toFixed(2)}:${Number(item.wht_deducted_amount || 0).toFixed(2)}`)
      .sort()
      .join("|");
    if (existingSignature && existingSignature === requestedSignature) {
      return NextResponse.json({ data: { cheque, allocations: existingAllocations }, duplicate: true });
    }
    if (existingSignature) {
      return NextResponse.json({
        error: `Cheque ${values.reference_no} already exists and has invoice allocations. Open it from the Cheques page to review it.`,
      }, { status: 409 });
    }
    const { data: createdAllocations, error: allocationError } = await supabase.from("cheque_allocations").insert(allocationPayload).select("*");
    if (allocationError) {
      if (createdCheque) await supabase.from("customer_cheques").delete().eq("id", cheque.id);
      return NextResponse.json({ error: allocationError.message }, { status: 400 });
    }
    await writeAuditLog(request, { action: "CREATE_CHEQUE", entityType: "CHEQUE", entityId: cheque.id, description: `Recorded cheque ${cheque.cheque_no} allocated to ${createdAllocations?.length ?? 0} invoices.`, metadata: { cheque, allocations: createdAllocations } });
    return NextResponse.json({ data: { cheque, allocations: createdAllocations } });
  }

  if (values.payment_method === "BANK_TRANSFER" && !invoiceId && Array.isArray(body.allocations)) {
    const customerName = String(body.customerName ?? "").trim();
    const allocations = (body.allocations as Record<string, unknown>[])
      .map((item) => ({
        invoiceId: String(item.invoiceId ?? "").trim(),
        amount: Number(item.amount ?? 0),
        whtDeductedAmount: Number(item.whtDeductedAmount ?? 0),
      }))
      .filter((item) => item.invoiceId && Number.isFinite(item.amount) && item.amount > 0 && Number.isFinite(item.whtDeductedAmount) && item.whtDeductedAmount >= 0);
    const allocatedTotal = Math.round(allocations.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    if (!customerName || !allocations.length) {
      return NextResponse.json({ error: "Customer and at least one invoice allocation are required." }, { status: 400 });
    }
    const invoicePaymentAmount = Math.round((values.amount - values.transfer_fees) * 100) / 100;
    if (Math.abs(allocatedTotal - invoicePaymentAmount) > 0.01) {
      return NextResponse.json({ error: "The bank payment amount must be fully allocated. Transfer fees are recorded separately." }, { status: 400 });
    }

    const checked: { invoice: any; amount: number; cashFraction: number; whtDeductedAmount: number }[] = [];
    for (const allocation of allocations) {
      const invoice = await permittedInvoice(allocation.invoiceId, session.salesRepName, session.role === "admin");
      if (!invoice || invoice.customer_name !== customerName) {
        return NextResponse.json({ error: "Every allocated invoice must belong to the selected customer and be available to this user." }, { status: 400 });
      }
      if (allocation.whtDeductedAmount > 0 && await existingWhtDeduction(allocation.invoiceId) > 0.005) {
        return NextResponse.json({ error: `WHT was already deducted for invoice ${invoice.invoice_no}.` }, { status: 409 });
      }
      const alreadySettled = await settledInvoiceAmount(invoice);
      const remaining = Math.round((Number(invoice.total_sales || 0) - alreadySettled - allocation.amount - allocation.whtDeductedAmount) * 100) / 100;
      if (remaining < -0.01) {
        return NextResponse.json({ error: `Allocation exceeds the remaining balance of invoice ${invoice.invoice_no}.` }, { status: 400 });
      }
      checked.push({ invoice, amount: allocation.amount, cashFraction: remaining > 0 && remaining < 1 ? remaining : 0, whtDeductedAmount: allocation.whtDeductedAmount });
    }

    let distributedFees = 0;
    const payload = checked.map(({ invoice, amount, cashFraction, whtDeductedAmount }, index) => {
      const transferFees = index === checked.length - 1
        ? Math.round((values.transfer_fees - distributedFees) * 100) / 100
        : Math.round((values.transfer_fees * amount / allocatedTotal) * 100) / 100;
      distributedFees += transferFees;
      return {
        collection_date: values.collection_date,
        amount: Math.round((amount + transferFees) * 100) / 100,
        transfer_fees: transferFees,
        cash_fraction: cashFraction,
        wht_deducted_amount: whtDeductedAmount,
        payment_method: "BANK_TRANSFER",
        reference_no: values.reference_no,
        notes: values.notes,
        updated_at: values.updated_at,
        cheque_status: null,
        cheque_status_date: null,
        invoice_id: String(invoice.id),
        invoice_no: String(invoice.invoice_no),
        customer_code: invoice.customer_code,
        customer_name: invoice.customer_name,
      };
    });
    const { data, error } = await supabase.from("invoice_collections").insert(payload).select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeAuditLog(request, {
      action: "CREATE_COLLECTION",
      entityType: "COLLECTION",
      entityId: data?.[0]?.id,
      description: `Recorded bank transfer of ${values.amount} EGP across ${data?.length ?? 0} invoices.`,
      metadata: { after: data, referenceNo: values.reference_no },
    });
    return NextResponse.json({ data });
  }

  if (!invoiceId) return NextResponse.json({ error: "Please choose an invoice." }, { status: 400 });
  const invoice = await permittedInvoice(invoiceId, session.salesRepName, session.role === "admin");
  if (!invoice) return NextResponse.json({ error: "Invoice not found or unavailable to this user." }, { status: 404 });
  if (values.wht_deducted_amount > 0 && await existingWhtDeduction(invoiceId) > 0.005) {
    return NextResponse.json({ error: `WHT was already deducted for invoice ${invoice.invoice_no}.` }, { status: 409 });
  }
  await addAutomaticFraction(invoice, values);
  const { data, error } = await supabase.from("invoice_collections").insert({
    ...values,
    cheque_status: null,
    cheque_status_date: null,
    invoice_id: String(invoice.id),
    invoice_no: String(invoice.invoice_no),
    customer_code: invoice.customer_code,
    customer_name: invoice.customer_name,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "CREATE_COLLECTION", entityType: "COLLECTION", entityId: data.id, description: `Recorded ${data.amount} EGP collection for invoice ${data.invoice_no}.`, metadata: { after: data } });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const session = await editableSession(request);
  if (!session) return NextResponse.json({ error: "Collections edit permission required." }, { status: 403 });
  const body = await request.json();
  const id = Number(body.id);
  const operationIds = Array.from(new Set((Array.isArray(body.ids) ? body.ids : [])
    .map((value: unknown) => Number(value))
    .filter((value: number) => Number.isSafeInteger(value) && value > 0))) as number[];
  const values = collectionValues(body);
  const errorMessage = validationError(values);
  if (values.payment_method === "BANK_TRANSFER" && (operationIds.length > 1 || (operationIds.length === 1 && Array.isArray(body.allocations)))) {
    if (errorMessage) return NextResponse.json({ error: errorMessage }, { status: 400 });
    const { data: beforeRows, error: beforeError } = await supabase.from("invoice_collections").select("*").in("id", operationIds);
    if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 400 });
    if ((beforeRows ?? []).length !== operationIds.length || (beforeRows ?? []).some((row) => row.payment_method !== "BANK_TRANSFER")) {
      return NextResponse.json({ error: "The complete bank-transfer operation could not be found." }, { status: 404 });
    }
    const customerName = String(body.customerName ?? "").trim();
    if ((beforeRows ?? []).some((row) => row.customer_name !== customerName)) return NextResponse.json({ error: "All transfer allocations must belong to one customer." }, { status: 400 });
    for (const row of beforeRows ?? []) {
      if (!(await permittedInvoice(String(row.invoice_id), session.salesRepName, session.role === "admin"))) return NextResponse.json({ error: "Transfer operation unavailable to this user." }, { status: 404 });
    }
    const allocations = (Array.isArray(body.allocations) ? body.allocations : []).map((item: Record<string, unknown>) => ({
      invoiceId: String(item.invoiceId ?? "").trim(), amount: Number(item.amount ?? 0), whtDeductedAmount: Number(item.whtDeductedAmount ?? 0),
    })).filter((item: { invoiceId: string; amount: number; whtDeductedAmount: number }) => item.invoiceId && Number.isFinite(item.amount) && item.amount > 0 && Number.isFinite(item.whtDeductedAmount) && item.whtDeductedAmount >= 0);
    const allocatedTotal = Math.round(allocations.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0) * 100) / 100;
    const invoicePaymentAmount = Math.round((values.amount - values.transfer_fees) * 100) / 100;
    if (!allocations.length || Math.abs(allocatedTotal - invoicePaymentAmount) > 0.01) return NextResponse.json({ error: "The bank payment amount must be fully allocated. Transfer fees are recorded separately." }, { status: 400 });
    const checked: { invoice: any; amount: number; cashFraction: number; whtDeductedAmount: number }[] = [];
    for (const allocation of allocations) {
      const invoice = await permittedInvoice(allocation.invoiceId, session.salesRepName, session.role === "admin");
      if (!invoice || invoice.customer_name !== customerName) return NextResponse.json({ error: "Every allocation must belong to the selected customer." }, { status: 400 });
      if (allocation.whtDeductedAmount > 0 && await existingWhtDeduction(allocation.invoiceId, operationIds) > 0.005) return NextResponse.json({ error: `WHT was already deducted for invoice ${invoice.invoice_no}.` }, { status: 409 });
      const alreadySettled = await settledInvoiceAmount(invoice, operationIds);
      const remaining = Math.round((Number(invoice.total_sales || 0) - alreadySettled - allocation.amount - allocation.whtDeductedAmount) * 100) / 100;
      if (remaining < -0.01) return NextResponse.json({ error: `Allocation exceeds the remaining balance of invoice ${invoice.invoice_no}.` }, { status: 400 });
      checked.push({ invoice, amount: allocation.amount, cashFraction: remaining > 0 && remaining < 1 ? remaining : 0, whtDeductedAmount: allocation.whtDeductedAmount });
    }
    let distributedFees = 0;
    const replacementRows = checked.map(({ invoice, amount, cashFraction, whtDeductedAmount }, index) => {
      const fee = index === checked.length - 1 ? Math.round((values.transfer_fees - distributedFees) * 100) / 100 : Math.round((values.transfer_fees * amount / allocatedTotal) * 100) / 100;
      distributedFees += fee;
      return { ...values, amount: Math.round((amount + fee) * 100) / 100, transfer_fees: fee, cash_fraction: cashFraction, wht_deducted_amount: whtDeductedAmount, cheque_status: null, cheque_status_date: null, invoice_id: String(invoice.id), invoice_no: String(invoice.invoice_no), customer_code: invoice.customer_code, customer_name: invoice.customer_name };
    });
    const { error: deleteError } = await supabase.from("invoice_collections").delete().in("id", operationIds);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
    const { data, error } = await supabase.from("invoice_collections").insert(replacementRows).select("*");
    if (error) {
      await supabase.from("invoice_collections").insert(beforeRows);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await writeAuditLog(request, { action: "UPDATE_COLLECTION", entityType: "COLLECTION", entityId: data?.[0]?.id, description: `Updated complete bank-transfer operation across ${data?.length ?? 0} invoices.`, metadata: { before: beforeRows, after: data } });
    return NextResponse.json({ data });
  }
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid collection record." }, { status: 400 });
  if (errorMessage) return NextResponse.json({ error: errorMessage }, { status: 400 });
  if (values.payment_method === "CHEQUE") return NextResponse.json({ error: "Create and manage cheques through the cheque workflow." }, { status: 400 });
  const { data: before } = await supabase.from("invoice_collections").select("*").eq("id", id).maybeSingle();
  if (!before || !(await permittedInvoice(String(before.invoice_id), session.salesRepName, session.role === "admin"))) return NextResponse.json({ error: "Collection not found or unavailable to this user." }, { status: 404 });
  if (values.wht_deducted_amount > 0 && await existingWhtDeduction(String(before.invoice_id), [id]) > 0.005) {
    return NextResponse.json({ error: `WHT was already deducted for invoice ${before.invoice_no}.` }, { status: 409 });
  }
  const invoice = await permittedInvoice(String(before.invoice_id), session.salesRepName, session.role === "admin");
  if (!invoice) return NextResponse.json({ error: "Invoice not found or unavailable to this user." }, { status: 404 });
  await addAutomaticFraction(invoice, values, [id]);
  const { data, error } = await supabase.from("invoice_collections").update({
    ...values,
    cheque_status: null,
    cheque_status_date: null,
  }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "UPDATE_COLLECTION", entityType: "COLLECTION", entityId: id, description: `Updated collection for invoice ${data.invoice_no}.`, metadata: { before, after: data } });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const session = await editableSession(request);
  if (!session) return NextResponse.json({ error: "Collections edit permission required." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const ids = String(params.get("ids") ?? params.get("id") ?? "").split(",").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0);
  const id = ids[0];
  if (!ids.length) return NextResponse.json({ error: "Invalid collection operation." }, { status: 400 });
  if (ids.length > 1) {
    const { data: beforeRows, error: beforeError } = await supabase.from("invoice_collections").select("*").in("id", ids);
    if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 400 });
    if ((beforeRows ?? []).length !== ids.length) return NextResponse.json({ error: "Complete collection operation not found." }, { status: 404 });
    for (const row of beforeRows ?? []) if (!(await permittedInvoice(String(row.invoice_id), session.salesRepName, session.role === "admin"))) return NextResponse.json({ error: "Collection operation unavailable to this user." }, { status: 404 });
    const { error } = await supabase.from("invoice_collections").delete().in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeAuditLog(request, { action: "DELETE_COLLECTION", entityType: "COLLECTION", entityId: ids.join(","), description: `Deleted complete ${beforeRows?.[0]?.payment_method ?? "collection"} operation.`, metadata: { before: beforeRows } });
    return NextResponse.json({ success: true });
  }
  const { data: before } = await supabase.from("invoice_collections").select("*").eq("id", id).maybeSingle();
  if (!before || !(await permittedInvoice(String(before.invoice_id), session.salesRepName, session.role === "admin"))) return NextResponse.json({ error: "Collection not found or unavailable to this user." }, { status: 404 });
  const { error } = await supabase.from("invoice_collections").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "DELETE_COLLECTION", entityType: "COLLECTION", entityId: id, description: `Deleted collection for invoice ${before.invoice_no}.`, metadata: { before } });
  return NextResponse.json({ success: true });
}
