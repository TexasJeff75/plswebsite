// Weekly release: turns planned installments into scheduled payments in BILL,
// and cancels released payments. Free of Supabase imports so it can be tested
// with a fake BILL and an in-memory store.

import { BillApiError, BillClient } from "../bill-sync/sync.ts";

export const LARGE_BATCH = 25_000;

export interface Installment {
  id: string;
  bill_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  invoice_number: string | null;
  amount: number;
  planned_date: string;
  status: string;
  seq: number;
  matched_payment_id: string | null;
}

export interface PayStore {
  loadInstallments(ids: string[]): Promise<Installment[]>;
  // Locks the installment for release and returns the action to use. Reuses an
  // earlier attempt whose outcome was unknown, so its transaction number is kept.
  claim(installmentId: string, fundingAccountId: string, processDate: string): Promise<{ actionId: string; transactionNumber: string }>;
  finishAction(actionId: string, patch: { status: "sent" | "failed" | "unknown"; bill_payment_id?: string | null; bill_status?: string | null; error?: string | null }): Promise<void>;
  logAction(row: { action: "cancel"; installment_id: string; bill_id: string; vendor_name: string | null; amount: number; status: "sent" | "failed"; bill_payment_id: string; bill_status?: string | null; error?: string | null }): Promise<void>;
  savePayment(payment: any): Promise<void>;
  saveBill(bill: any): Promise<void>;
  linkInstallment(installmentId: string, paymentId: string, processDate: string | null, pending: boolean): Promise<void>;
  unlinkInstallment(installmentId: string, billId: string): Promise<void>;
}

export interface BankOption { id: string; name: string | null; available: boolean; processDate: string | null; deliveryDate: string | null; reason: string | null }

export interface CheckedRow {
  installment: Installment;
  ok: boolean;
  problem: string | null;
  billDueAmount: number | null;
  banks: BankOption[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Payment states where BILL has not started processing, so a cancel is possible.
export const PENDING_STATES = new Set(["SCHEDULED", "WAITING_ON_APPROVAL", "READY_TO_FUND"]);

function bankOptions(options: any): BankOption[] {
  return (options?.fundingOptions?.banks ?? []).map((b: any) => ({
    id: b.id,
    name: b.name ?? null,
    available: b.available !== false,
    processDate: b.processDate ?? null,
    deliveryDate: b.deliveryDate ?? null,
    reason: b.reason ?? null,
  }));
}

// Re-reads each bill from BILL and asks BILL which bank accounts can pay it and how soon.
export async function checkInstallments(client: BillClient, store: PayStore, ids: string[]): Promise<CheckedRow[]> {
  const list = await store.loadInstallments(ids);
  const rows: CheckedRow[] = [];
  for (const id of ids) {
    const inst = list.find((i) => i.id === id);
    if (!inst) {
      rows.push({ installment: { id } as Installment, ok: false, problem: "This installment no longer exists. Refresh the page.", billDueAmount: null, banks: [] });
      continue;
    }
    if (inst.matched_payment_id) {
      rows.push({ installment: inst, ok: false, problem: "Already in BILL.", billDueAmount: null, banks: [] });
      continue;
    }
    try {
      const bill = await client.get(`/v3/bills/${inst.bill_id}`, {});
      await store.saveBill(bill);
      const due = Number(bill.dueAmount ?? 0);
      let problem: string | null = null;
      if (bill.archived) problem = "This bill is archived in BILL.";
      else if (round2(inst.amount) > round2(due) + 0.005) {
        problem = `BILL shows only ${due.toLocaleString("en-US", { style: "currency", currency: "USD" })} left to schedule on this bill. Update the plan first.`;
      }
      const vendorId = inst.vendor_id ?? bill.vendorId;
      const options = problem ? null : await client.get("/v3/payments/options", { vendorId, amount: String(inst.amount) });
      const banks = bankOptions(options);
      if (!problem && !banks.some((b) => b.available)) problem = "BILL has no bank account that can pay this vendor.";
      rows.push({ installment: { ...inst, vendor_id: vendorId }, ok: !problem, problem, billDueAmount: due, banks });
    } catch (err) {
      rows.push({ installment: inst, ok: false, problem: err instanceof Error ? err.message : String(err), billDueAmount: null, banks: [] });
    }
  }
  return rows;
}

// ── Bank account check ──────────────────────────────────────────────────────
// What BILL says about each bank account for the BILL user the tracker acts
// as (the user who created the developer app). Only the last 4 digits of an
// account number ever leave this function.

export interface FundingAccount {
  id: string;
  label: string;
  status: string | null;
  defaultPayables: boolean;
  accessToAdmins: boolean;
  userStatus: string | null; // this user's authorization on the account, null if not listed
  usable: "yes" | "maybe" | "no";
  reason: string | null;
}

export interface FundingCheck {
  payOnline: boolean | null;
  accounts: FundingAccount[];
  problems: string[];
}

const last4 = (n: unknown) => (typeof n === "string" && n.length >= 4 ? n.slice(-4) : "");

export async function checkFunding(client: BillClient): Promise<FundingCheck> {
  const problems: string[] = [];
  let payOnline: boolean | null = null;
  try {
    const perms = await client.get("/v3/funding-accounts/permissions", {});
    payOnline = typeof perms?.user?.payOnline === "boolean" ? perms.user.payOnline : null;
    if (payOnline === false) problems.push("BILL says the user behind the tracker cannot make online payments. Check that user's role in BILL.");
  } catch (err) {
    problems.push(`Could not read payment permissions: ${err instanceof Error ? err.message : err}`);
  }

  let banks: any[] = [];
  try {
    banks = (await client.get("/v3/funding-accounts/banks", { max: "100", filters: "archived:eq:false" }))?.results ?? [];
  } catch (err) {
    problems.push(`Could not read bank accounts: ${err instanceof Error ? err.message : err}`);
  }

  const mine = new Map<string, string>();
  try {
    const rows = (await client.get("/v3/funding-accounts/banks/users", { currentUser: "true", max: "100" }))?.results ?? [];
    for (const r of rows) if (!r.archived) mine.set(r.bankAccountId, r.verificationStatus);
  } catch (err) {
    problems.push(`Could not read bank account users: ${err instanceof Error ? err.message : err}`);
  }

  const accounts = banks.map((b): FundingAccount => {
    const userStatus = mine.get(b.id) ?? null;
    let usable: FundingAccount["usable"] = "yes";
    let reason: string | null = null;
    if (b.status !== "VERIFIED") {
      usable = "no";
      reason = `The bank account is ${String(b.status ?? "not verified").toLowerCase().replace(/_/g, " ")} in BILL.`;
    } else if (userStatus === "VERIFIED") {
      usable = "yes";
    } else if (userStatus === "NOMINATED") {
      usable = "no";
      reason = "The BILL user behind the tracker was added to this account but has not finished BILL's identity check (look for BILL's email).";
    } else if (userStatus) {
      usable = "no";
      reason = "The BILL user behind the tracker is not verified on this account. Add them under the account's users in BILL.";
    } else if (b.accessToAdmins) {
      usable = "maybe";
      reason = "The BILL user behind the tracker is not listed on this account. It works only if that user is a BILL administrator.";
    } else {
      usable = "no";
      reason = "The BILL user behind the tracker is not authorized on this account. Add them under the account's users in BILL.";
    }
    return {
      id: b.id,
      label: [b.bankName || "Bank account", last4(b.accountNumber) ? `****${last4(b.accountNumber)}` : ""].filter(Boolean).join(" "),
      status: b.status ?? null,
      defaultPayables: !!b.default?.payables,
      accessToAdmins: !!b.accessToAdmins,
      userStatus,
      usable,
      reason,
    };
  });

  if (banks.length && !accounts.some((a) => a.usable !== "no")) {
    problems.push("None of your BILL bank accounts can be used by the BILL user behind the tracker. See each account below.");
  }
  return { payOnline, accounts, problems };
}

export interface ReleaseResult {
  installmentId: string;
  status: "sent" | "failed" | "unknown" | "skipped";
  paymentId?: string | null;
  billStatus?: string | null;
  processDate?: string | null;
  message?: string | null;
}

export async function releaseInstallments(
  client: BillClient,
  store: PayStore,
  opts: { ids: string[]; fundingAccountId: string; confirmLarge: boolean; today: string },
): Promise<{ results: ReleaseResult[]; total: number }> {
  if (!opts.fundingAccountId) throw new Error("Choose the bank account to pay from.");
  const checked = await checkInstallments(client, store, opts.ids);
  const total = round2(checked.filter((r) => r.ok).reduce((s, r) => s + Number(r.installment.amount), 0));
  if (total > LARGE_BATCH && !opts.confirmLarge) {
    throw new Error(`This release totals ${total.toLocaleString("en-US", { style: "currency", currency: "USD" })}, over $25,000. Confirm the amount to continue.`);
  }

  const results: ReleaseResult[] = [];
  for (const row of checked) {
    const inst = row.installment;
    if (!row.ok) {
      results.push({ installmentId: inst.id, status: "skipped", message: row.problem });
      continue;
    }
    const bank = row.banks.find((b) => b.id === opts.fundingAccountId);
    if (!bank || !bank.available) {
      results.push({ installmentId: inst.id, status: "skipped", message: bank?.reason || "That bank account cannot pay this vendor." });
      continue;
    }
    // Never earlier than planned, today, or the earliest date BILL allows.
    const processDate = [inst.planned_date, opts.today, bank.processDate].filter(Boolean).sort().pop()!;

    let action: { actionId: string; transactionNumber: string };
    try {
      action = await store.claim(inst.id, opts.fundingAccountId, processDate);
    } catch (err) {
      results.push({ installmentId: inst.id, status: "skipped", message: err instanceof Error ? err.message : String(err) });
      continue;
    }

    try {
      // An earlier attempt may have reached BILL even though we never heard back.
      const existing = await client.get("/v3/payments", { filters: `transactionNumber:eq:"${action.transactionNumber}"`, max: "1" });
      let payment = existing?.results?.[0];
      if (!payment) {
        payment = await client.post("/v3/payments", {
          vendorId: inst.vendor_id,
          billId: inst.bill_id,
          processDate,
          fundingAccount: { type: "BANK_ACCOUNT", id: opts.fundingAccountId },
          amount: round2(inst.amount),
          transactionNumber: action.transactionNumber,
          processingOptions: { requestPayFaster: false, createBill: false },
        });
      }
      await store.savePayment(payment);
      const status = payment.singleStatus ?? payment.status ?? null;
      await store.linkInstallment(inst.id, payment.id, payment.processDate ?? processDate, PENDING_STATES.has(status));
      await store.finishAction(action.actionId, { status: "sent", bill_payment_id: payment.id, bill_status: status });
      try {
        await store.saveBill(await client.get(`/v3/bills/${inst.bill_id}`, {}));
      } catch {
        // The next sync refreshes the bill.
      }
      results.push({ installmentId: inst.id, status: "sent", paymentId: payment.id, billStatus: status, processDate: payment.processDate ?? processDate });
    } catch (err) {
      const unknown = err instanceof BillApiError && err.code === "UNKNOWN_OUTCOME";
      const message = err instanceof Error ? err.message : String(err);
      await store.finishAction(action.actionId, { status: unknown ? "unknown" : "failed", error: message });
      results.push({
        installmentId: inst.id,
        status: unknown ? "unknown" : "failed",
        message: unknown ? "BILL did not confirm this payment. Sync, then check BILL before releasing it again; a retry reuses the same reference, so it cannot pay twice." : message,
      });
    }
  }
  return { results, total };
}

export async function cancelInstallment(client: BillClient, store: PayStore, installmentId: string): Promise<ReleaseResult> {
  const [inst] = await store.loadInstallments([installmentId]);
  if (!inst?.matched_payment_id) throw new Error("This installment has no payment in BILL to cancel.");
  const paymentId = inst.matched_payment_id;

  const current = await client.get(`/v3/payments/${paymentId}`, {});
  const status = current.singleStatus ?? current.status;
  if (!PENDING_STATES.has(status)) {
    await store.savePayment(current);
    throw new Error(`BILL has already started this payment (${String(status).toLowerCase().replace(/_/g, " ")}). It can only be voided in BILL.`);
  }

  try {
    await client.post(`/v3/payments/${paymentId}/cancel`, {});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await store.logAction({ action: "cancel", installment_id: inst.id, bill_id: inst.bill_id, vendor_name: inst.vendor_name, amount: inst.amount, status: "failed", bill_payment_id: paymentId, error: message });
    throw err;
  }

  const after = await client.get(`/v3/payments/${paymentId}`, {});
  await store.savePayment(after);
  await store.unlinkInstallment(inst.id, inst.bill_id);
  try {
    await store.saveBill(await client.get(`/v3/bills/${inst.bill_id}`, {}));
  } catch {
    // The next sync refreshes the bill.
  }
  const afterStatus = after.singleStatus ?? after.status ?? null;
  await store.logAction({ action: "cancel", installment_id: inst.id, bill_id: inst.bill_id, vendor_name: inst.vendor_name, amount: inst.amount, status: "sent", bill_payment_id: paymentId, bill_status: afterStatus });
  return { installmentId: inst.id, status: "sent", paymentId, billStatus: afterStatus };
}
