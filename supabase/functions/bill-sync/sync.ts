// Sync core for the BILL Payables Monitor. Reads from the BILL v3 API and
// writes into the ap_* tables. Kept free of Supabase imports so it can be
// tested with a fake fetch and an in-memory store.

export type BillEnv = "sandbox" | "production";

const HOSTS: Record<BillEnv, { auth: string; api: string }> = {
  sandbox: { auth: "https://auth.stage.bill.com", api: "https://gateway.stage.bill.com/connect" },
  production: { auth: "https://auth.bill.com", api: "https://gateway.prod.bill.com/connect" },
};

// Re-read a few minutes before the last high-water mark so records saved
// in the same instant as the last page are never skipped.
const OVERLAP_MS = 5 * 60 * 1000;
const PAGE_SIZE = 100;
const MAX_RETRIES = 5;

export class BillApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
  }
}

export interface Store {
  getState(entity: string): Promise<string | null>;
  setState(entity: string, lastUpdatedTime: string): Promise<void>;
  upsert(table: string, rows: Record<string, unknown>[]): Promise<void>;
  // Replace all child rows for the given parent ids.
  replaceChildren(table: string, parentColumn: string, parentIds: string[], rows: Record<string, unknown>[]): Promise<void>;
}

type FetchFn = typeof fetch;

export class BillClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;
  readonly hosts: { auth: string; api: string };

  constructor(
    private clientId: string,
    private clientSecret: string,
    env: BillEnv,
    private fetchFn: FetchFn = fetch,
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {
    this.hosts = HOSTS[env];
  }

  private async getToken(force = false): Promise<string> {
    if (!force && this.token && Date.now() < this.tokenExpiresAt - 60_000) return this.token;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const res = await this.fetchFn(`${this.hosts.auth}/authx/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) {
      throw new BillApiError(`BILL sign-in failed: ${json.message ?? res.status}`, "AUTH", res.status);
    }
    this.token = json.access_token;
    this.tokenExpiresAt = Date.now() + (Number(json.expires_in) || 3600) * 1000;
    return this.token!;
  }

  // GET a v3 path with retries for concurrency limits and server errors.
  async get(path: string, params: Record<string, string>): Promise<any> {
    const url = new URL(`${this.hosts.api}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const token = await this.getToken();
      const res = await this.fetchFn(url.toString(), {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.ok) return res.json();

      const body = await res.json().catch(() => null);
      const err = Array.isArray(body) ? body[0] : body;
      const code: string | undefined = err?.code;
      const message: string = err?.message ?? `HTTP ${res.status}`;

      if (res.status === 401 && !refreshed) {
        refreshed = true;
        await this.getToken(true);
        continue;
      }
      // Hourly limit: waiting it out would outlast the function, so stop.
      if (code === "BDC_1144") throw new BillApiError(`BILL hourly request limit reached: ${message}`, code, res.status);

      const retryable = code === "BDC_1322" || res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        await this.sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new BillApiError(`BILL request failed (${path}): ${message}`, code, res.status);
    }
  }
}

// ── Mapping BILL records to table rows ──────────────────────────────────────

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const day = (v: unknown) => (typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null);
const cls = (c: any) => ({
  chart_of_account_id: c?.chartOfAccountId ?? null,
  accounting_class_id: c?.accountingClassId ?? null,
  department_id: c?.departmentId ?? null,
  location_id: c?.locationId ?? null,
});

export function mapClassification(kind: string, r: any) {
  return {
    id: r.id,
    kind,
    name: r.name ?? r.id,
    parent_id: r.parentId ?? null,
    archived: !!r.archived,
    updated_time: r.updatedTime ?? null,
    synced_at: new Date().toISOString(),
  };
}

// Tax IDs and bank account details are deliberately not copied.
export function mapVendor(r: any) {
  return {
    id: r.id,
    name: r.name ?? r.id,
    short_name: r.shortName ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    city: r.address?.city ?? null,
    state: r.address?.stateOrProvince ?? null,
    archived: !!r.archived,
    balance: num(r.balance?.amount),
    autopay_enabled: r.autoPay ? !!r.autoPay.enabled : null,
    bank_account_status: r.bankAccountStatus ?? null,
    network_status: r.networkStatus ?? null,
    pay_by_type: r.paymentInformation?.payByType ?? null,
    last_payment_date: day(r.paymentInformation?.lastPaymentDate),
    created_time: r.createdTime ?? null,
    updated_time: r.updatedTime ?? null,
    synced_at: new Date().toISOString(),
  };
}

export function mapBill(r: any) {
  return {
    id: r.id,
    vendor_id: r.vendorId ?? null,
    vendor_name: r.vendorName ?? null,
    invoice_number: r.invoice?.invoiceNumber ?? null,
    invoice_date: day(r.invoice?.invoiceDate),
    due_date: day(r.dueDate),
    amount: num(r.amount) ?? 0,
    paid_amount: num(r.paidAmount) ?? 0,
    due_amount: num(r.dueAmount) ?? 0,
    scheduled_amount: num(r.scheduledAmount) ?? 0,
    credit_amount: num(r.creditAmount) ?? 0,
    currency: r.currency ?? null,
    payment_status: r.paymentStatus ?? null,
    approval_status: r.approvalStatus ?? null,
    description: r.description ?? null,
    po_number: r.purchaseOrderNumber ?? null,
    recurring_bill_id: r.recurringBillId ?? null,
    ...cls(r.classifications),
    archived: !!r.archived,
    created_time: r.createdTime ?? null,
    updated_time: r.updatedTime ?? null,
    raw: r,
    synced_at: new Date().toISOString(),
  };
}

export function mapBillLines(r: any) {
  return (r.billLineItems ?? []).map((l: any, i: number) => ({
    id: l.id ?? `${r.id}-${i}`,
    bill_id: r.id,
    line_order: i,
    amount: num(l.amount) ?? 0,
    description: l.description ?? null,
    ...cls(l.classifications),
  }));
}

export function mapPayment(r: any) {
  return {
    id: r.id,
    vendor_id: r.vendorId ?? null,
    vendor_name: r.vendorName ?? null,
    amount: num(r.amount) ?? 0,
    process_date: day(r.processDate),
    status: r.status ?? null,
    single_status: r.singleStatus ?? null,
    disbursement_type: r.disbursementType ?? null,
    disbursement_status: r.disbursementStatus ?? null,
    online_payment: r.onlinePayment ?? null,
    transaction_number: r.transactionNumber ?? null,
    confirmation_number: r.confirmationNumber ?? null,
    description: r.description ?? null,
    created_time: r.createdTime ?? null,
    updated_time: r.updatedTime ?? null,
    synced_at: new Date().toISOString(),
  };
}

// A payment with no billPayments list but a billId paid a single bill in full.
export function mapPaymentBills(r: any) {
  const list = Array.isArray(r.billPayments) && r.billPayments.length
    ? r.billPayments
    : r.billId ? [{ billId: r.billId, amount: r.amount }] : [];
  const byBill = new Map<string, number>();
  for (const bp of list) {
    if (!bp?.billId) continue;
    byBill.set(bp.billId, (byBill.get(bp.billId) ?? 0) + (num(bp.amount) ?? 0));
  }
  return [...byBill].map(([bill_id, amount]) => ({ payment_id: r.id, bill_id, amount: Math.round(amount * 100) / 100 }));
}

export function mapVendorCredit(r: any) {
  return {
    id: r.id,
    vendor_id: r.vendorId ?? null,
    reference_number: r.referenceNumber ?? null,
    credit_date: day(r.creditDate),
    amount: num(r.amount) ?? 0,
    applied_amount: num(r.appliedAmount) ?? 0,
    status: r.status ?? null,
    description: r.description ?? null,
    archived: !!r.archived,
    created_time: r.createdTime ?? null,
    updated_time: r.updatedTime ?? null,
    synced_at: new Date().toISOString(),
  };
}

// ── Entities, in sync order (lookups first, then what refers to them) ──────

interface Entity {
  key: string;
  path: string;
  hasArchived: boolean;
  write: (store: Store, records: any[]) => Promise<void>;
}

const classification = (kind: string, path: string): Entity => ({
  key: `classifications.${kind}`,
  path,
  hasArchived: true,
  write: (store, records) => store.upsert("ap_classifications", records.map((r) => mapClassification(kind, r))),
});

export const ENTITIES: Entity[] = [
  classification("chart_of_account", "/v3/classifications/chart-of-accounts"),
  classification("department", "/v3/classifications/departments"),
  classification("accounting_class", "/v3/classifications/accounting-classes"),
  classification("location", "/v3/classifications/locations"),
  { key: "vendors", path: "/v3/vendors", hasArchived: true, write: (s, rs) => s.upsert("ap_vendors", rs.map(mapVendor)) },
  {
    key: "bills",
    path: "/v3/bills",
    hasArchived: true,
    write: async (s, rs) => {
      await s.upsert("ap_bills", rs.map(mapBill));
      await s.replaceChildren("ap_bill_lines", "bill_id", rs.map((r) => r.id), rs.flatMap(mapBillLines));
    },
  },
  {
    key: "payments",
    path: "/v3/payments",
    hasArchived: false,
    write: async (s, rs) => {
      await s.upsert("ap_payments", rs.map(mapPayment));
      await s.replaceChildren("ap_payment_bills", "payment_id", rs.map((r) => r.id), rs.flatMap(mapPaymentBills));
    },
  },
  { key: "vendor_credits", path: "/v3/vendor-credits", hasArchived: true, write: (s, rs) => s.upsert("ap_vendor_credits", rs.map(mapVendorCredit)) },
];

// ── Sync loop ───────────────────────────────────────────────────────────────

export interface SyncResult {
  counts: Record<string, number>;
  complete: boolean; // false when the time budget ran out; run again to continue
}

function buildFilters(since: string | null, archivedOnly: boolean) {
  const parts: string[] = [];
  if (archivedOnly) parts.push("archived:eq:true");
  if (since) parts.push(`updatedTime:gte:"${since}"`);
  return parts.join(",");
}

// BILL list endpoints may leave archived records out by default, so entities
// that can be archived get a second pass that asks only for archived records.
export async function runSync(client: BillClient, store: Store, deadline: number): Promise<SyncResult> {
  const counts: Record<string, number> = {};

  for (const entity of ENTITIES) {
    const passes = entity.hasArchived ? [false, true] : [false];
    for (const archivedOnly of passes) {
      const stateKey = archivedOnly ? `${entity.key}:archived` : entity.key;
      const last = await store.getState(stateKey);
      const since = last ? new Date(new Date(last).getTime() - OVERLAP_MS).toISOString() : null;

      const filters = buildFilters(since, archivedOnly);
      let params: Record<string, string> = { max: String(PAGE_SIZE), sort: "updatedTime:asc" };
      if (filters) params.filters = filters;

      while (true) {
        if (Date.now() > deadline) return { counts, complete: false };

        const page = await client.get(entity.path, params);
        const records: any[] = page?.results ?? [];
        if (records.length) {
          await entity.write(store, records);
          counts[entity.key] = (counts[entity.key] ?? 0) + records.length;
          const newest = records.reduce((max, r) => (r.updatedTime && r.updatedTime > max ? r.updatedTime : max), last ?? "");
          if (newest) await store.setState(stateKey, newest);
        }
        if (!page?.nextPage || !records.length) break;
        params = { max: String(PAGE_SIZE), page: page.nextPage };
      }
    }
  }
  return { counts, complete: true };
}
