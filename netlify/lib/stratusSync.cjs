// StratusDX LIS Integration API sync (the only supported StratusDX source).
//
// Follows docs/STRATUSDX_API_GUIDE.md:
//   - OAuth 2.0 client credentials against Microsoft Entra ID, token cached
//     in stratus_token_cache and refreshed when under 5 minutes remain.
//   - GET /orders?dateField=processedAt&from&to pages through new orders, in
//     date windows, oldest window first. The checkpoint
//     (stratus_sync_checkpoint.last_processed_at_utc) only moves past an
//     order once that order is saved, so a failed or unfinished order is
//     picked up again on the next run.
//   - GET /orders?dateField=statusUpdated catches orders that changed after
//     we first saw them (for example results that arrived later).
//   - GET /orders/{accessionId} gives the full order with its results.
//
// Each run stops starting new work when its time budget is used up, saves how
// far it got, and reports more: true so the next run carries on.
//
// Patient data (PHI): never log response bodies, only accession IDs and counts.
//
// Netlify environment variables:
//   STRATUS_TENANT_ID, STRATUS_API_CLIENT_ID, STRATUS_CLIENT_ID,
//   STRATUS_CLIENT_SECRET (from the StratusDX administrator)
//   STRATUS_API_BASE_URL   default https://func-stratusdx-poll-dev.azurewebsites.net/api
//   STRATUS_BACKFILL_FROM  first day to import when there is no checkpoint, default 2026-01-01
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const DEFAULT_BASE_URL = 'https://func-stratusdx-poll-dev.azurewebsites.net/api';
const PAGE_SIZE = 200;
const WINDOW_DAYS = 1; // about 300 orders a day, so a window lists in 1 or 2 pages
const CONCURRENCY = 8;
// Weekly re-check of orders still pending after RECHECK_AFTER_DAYS (StratusDX
// may fill in received/finalized dates later without marking the order as
// changed). Gentler than the import: fewer at a time, short slice per run.
const RECHECK_AFTER_DAYS = 14;
const RECHECK_EVERY_DAYS = 7;
const RECHECK_CONCURRENCY = 4;
const RECHECK_BATCH = 200;
const RECHECK_MAX_MS = 12000;
const MAX_ERRORS_REPORTED = 20;
// v2: finalized orders with no listed results also ask the results endpoint.
const FINGERPRINT_VERSION = 'v2';

function config() {
  return {
    baseUrl: (process.env.STRATUS_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    tenantId: process.env.STRATUS_TENANT_ID,
    apiClientId: process.env.STRATUS_API_CLIENT_ID,
    clientId: process.env.STRATUS_CLIENT_ID,
    clientSecret: process.env.STRATUS_CLIENT_SECRET,
    backfillFrom: process.env.STRATUS_BACKFILL_FROM || '2026-01-01',
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function missingSettings(cfg) {
  const missing = [];
  if (!cfg.tenantId) missing.push('STRATUS_TENANT_ID');
  if (!cfg.apiClientId) missing.push('STRATUS_API_CLIENT_ID');
  if (!cfg.clientId) missing.push('STRATUS_CLIENT_ID');
  if (!cfg.clientSecret) missing.push('STRATUS_CLIENT_SECRET');
  if (!cfg.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!cfg.serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The live API sends PascalCase names (Data, TotalCount, AccessionId,
// ProcessedAtUtc), while the guide shows camelCase. Lower-case the first
// letter of every key so the rest of the code can use the guide's names.
function camelKeys(value) {
  if (Array.isArray(value)) return value.map(camelKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const key = k.charAt(0).toLowerCase() + k.slice(1);
      // UTC times arrive without a zone ("2026-11-18T00:15:00"): mark them as UTC.
      out[key] = /AtUtc$/.test(key) && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)
        ? `${v}Z`
        : camelKeys(v);
    }
    return out;
  }
  return value;
}

// ---------- dates ----------

// "YYYY-MM-DD" for a Date, in UTC.
const utcDay = (d) => d.toISOString().slice(0, 10);
const addDays = (day, n) => utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5));

// Converts a StratusDX compact clinical time ("yyyyMMddHHmmss", US Central,
// no zone) to an ISO UTC string. Returns null for empty or bad values.
function centralToUtcIso(compact) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(compact || '').trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const offsetAt = (t) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  let guess = wall - offsetAt(wall);
  guess = wall - offsetAt(guess);
  return new Date(guess).toISOString();
}

const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== '';

// ---------- Supabase (service role, server side only) ----------

function makeDb(cfg) {
  const headers = {
    apikey: cfg.serviceKey,
    Authorization: `Bearer ${cfg.serviceKey}`,
    'Content-Type': 'application/json',
  };
  async function call(method, path, body, prefer) {
    const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
      method,
      headers: prefer ? { ...headers, Prefer: prefer } : headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Database ${method} ${path.split('?')[0]} failed (${res.status}): ${text.slice(0, 300)}`);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  return {
    select: (table, query) => call('GET', `${table}?${query}`),
    upsert: (table, rows, onConflict) =>
      call('POST', `${table}?on_conflict=${onConflict}`, rows, 'return=representation,resolution=merge-duplicates'),
    insert: (table, rows) => call('POST', table, rows, 'return=representation'),
    update: (table, query, patch) => call('PATCH', `${table}?${query}`, patch, 'return=minimal'),
    updateReturning: (table, query, patch) => call('PATCH', `${table}?${query}`, patch, 'return=representation'),
    remove: (table, query) => call('DELETE', `${table}?${query}`, undefined, 'return=minimal'),
    rpc: (fn, params) => call('POST', `rpc/${fn}`, params),
    // Number of rows matching a filter (no rows are read).
    count: async (table, query) => {
      const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?select=id&${query}`, {
        method: 'HEAD',
        headers: { ...headers, Prefer: 'count=exact' },
      });
      if (!res.ok) throw new Error(`Database count ${table} failed (${res.status})`);
      const range = res.headers.get('content-range') || '';
      return Number(range.split('/')[1]) || 0;
    },
  };
}

// ---------- StratusDX API ----------

function makeApi(cfg, db) {
  let token = null;

  async function newToken() {
    const res = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: `${cfg.apiClientId}/.default`,
      }).toString(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`StratusDX sign-in failed (${res.status}): ${body.error_description || body.error || 'no details'}`.slice(0, 300));
    }
    const data = await res.json();
    const expiresAt = new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000).toISOString();
    await db.upsert('stratus_token_cache', [{
      id: 1, access_token: data.access_token, token_type: data.token_type || 'Bearer',
      expires_at: expiresAt, acquired_at: new Date().toISOString(),
    }], 'id');
    return data.access_token;
  }

  async function getToken(forceNew) {
    if (!forceNew && token) return token;
    if (!forceNew) {
      const rows = await db.select('stratus_token_cache', 'select=access_token,expires_at&id=eq.1');
      const row = rows && rows[0];
      if (row && row.access_token && row.expires_at && Date.parse(row.expires_at) - Date.now() > 5 * 60 * 1000) {
        token = row.access_token;
        return token;
      }
    }
    token = await newToken();
    return token;
  }

  // GET a path under the base URL. Retries once after a 401 with a fresh
  // token, and up to twice on 5xx or network errors. Never retries 400/403/404.
  async function get(path) {
    let refreshed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      let res;
      try {
        res = await fetch(`${cfg.baseUrl}${path}`, {
          headers: { Authorization: `Bearer ${await getToken(false)}`, Accept: 'application/json' },
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (attempt < 2) { await sleep(400 * 2 ** attempt + Math.random() * 200); continue; }
        throw new Error(`StratusDX request failed: ${err.name === 'AbortError' ? 'timed out' : err.message}`);
      }
      clearTimeout(timer);
      if (res.status === 401 && !refreshed) { refreshed = true; await getToken(true); attempt--; continue; }
      if (res.status >= 500 && attempt < 2) { await sleep(400 * 2 ** attempt + Math.random() * 200); continue; }
      if (res.status === 404) return { notFound: true };
      if (!res.ok) {
        const body = camelKeys(await res.json().catch(() => ({})));
        const why = body.reason || body.error || res.statusText;
        throw new Error(`StratusDX ${path.split('?')[0]} returned ${res.status}: ${why}`.slice(0, 300));
      }
      return camelKeys(await res.json());
    }
    throw new Error('StratusDX request failed after retries');
  }

  // Pages through a list endpoint. Stops early (complete: false) when the
  // deadline passes.
  async function list(path, deadline) {
    const rows = [];
    let skip = 0;
    for (;;) {
      const sep = path.includes('?') ? '&' : '?';
      const page = await get(`${path}${sep}top=${PAGE_SIZE}&skip=${skip}`);
      if (!page || !Array.isArray(page.data)) {
        const shape = page && typeof page === 'object' ? Object.keys(page).slice(0, 10).join(', ') : typeof page;
        throw new Error(`StratusDX ${path.split('?')[0]} did not return a "data" list (got: ${shape || 'empty'})`);
      }
      const data = page.data;
      rows.push(...data);
      skip += data.length;
      const total = Number(page.totalCount) || 0;
      if (data.length === 0 || skip >= total) return { rows, complete: true, total };
      if (Date.now() > deadline) return { rows, complete: false, total };
    }
  }

  return { get, list };
}

// ---------- mapping StratusDX orders into our tables ----------

// What we compare to decide whether an order changed since we saved it.
function fingerprint(row) {
  const panels = (Array.isArray(row.panels) ? row.panels : [])
    .map((p) => `${p.panelName || ''}:${p.resultCount ?? ''}`).sort().join('|');
  // The leading version makes every order refresh once when the saving rules change.
  return [FINGERPRINT_VERSION, row.statusUpdatedAtUtc, row.status, row.finalizedDatetime, row.canceledDatetime, row.rejectedDatetime, panels]
    .map((v) => (v === null || v === undefined ? '' : String(v))).join('~');
}

function isAbnormalFlag(flag) {
  if (!hasValue(flag)) return false;
  const f = String(flag).trim().toUpperCase();
  return f !== 'N' && f !== 'NORMAL';
}

function orderRecord(detail, listRow) {
  const pick = (k) => (detail[k] !== undefined ? detail[k] : listRow[k]);
  const panels = Array.isArray(detail.panels) ? detail.panels : (Array.isArray(listRow.panels) ? listRow.panels : []);
  const first = pick('patientFirstName') || '';
  const last = pick('patientLastName') || '';
  const { results, ...orderData } = detail;
  return {
    stratus_guid: String(listRow.accessionId),
    accession_id: String(listRow.accessionId),
    accession_number: String(listRow.accessionId),
    order_data: orderData,
    order_status: pick('status') || null,
    organization_name: pick('organizationName') || null,
    location_name: pick('locationName') || null,
    provider_first_name: pick('providerFirstName') || null,
    provider_last_name: pick('providerLastName') || null,
    provider_name: [pick('providerFirstName'), pick('providerLastName')].filter(Boolean).join(' ') || null,
    provider_npi: pick('providerNpi') || null,
    patient_first_name: first || null,
    patient_last_name: last || null,
    patient_dob: pick('dateOfBirth') || null,
    patient_initials: `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || null,
    panels: panels.map((p) => p.panelName).filter(Boolean),
    requisition_datetime: pick('requisitionDatetime') || null,
    received_datetime: pick('receivedDatetime') || null,
    finalized_datetime: pick('finalizedDatetime') || null,
    is_canceled: hasValue(pick('canceledDatetime')),
    is_rejected: hasValue(pick('rejectedDatetime')),
    is_finalized: hasValue(pick('finalizedDatetime')),
    canceled_at: hasValue(pick('canceledDatetime')) ? pick('canceledDatetime') : null,
    rejected_at: hasValue(pick('rejectedDatetime')) ? pick('rejectedDatetime') : null,
    processed_at_utc: listRow.processedAtUtc || detail.processedAtUtc || null,
    sync_status: 'synced',
    sync_error: null,
    retrieved_at: new Date().toISOString(),
    sync_fingerprint: fingerprint(listRow),
  };
}

async function saveOrder(db, api, listRow, existing) {
  const accessionId = String(listRow.accessionId);
  const enc = encodeURIComponent(accessionId);
  const detail = await api.get(`/orders/${enc}`);
  if (detail.notFound) throw new Error('Order not found in StratusDX (404)');
  // A re-check starts from our own row, not a list row: use the detail.
  if (!listRow.processedAtUtc) listRow = { ...detail, accessionId };

  // Results: the detail call includes them, but is not paginated. If it holds
  // fewer than the panels say exist, page the dedicated results endpoint.
  let results = Array.isArray(detail.results) ? detail.results : [];
  const expected = (Array.isArray(detail.panels) ? detail.panels : []).reduce((n, p) => n + (Number(p.resultCount) || 0), 0);
  // Also ask when a finalized order lists no results: the panel counts are
  // not always filled in.
  const finalized = hasValue(detail.finalizedDatetime !== undefined ? detail.finalizedDatetime : listRow.finalizedDatetime);
  if (expected > results.length || (finalized && results.length === 0)) {
    const all = await api.list(`/orders/${enc}/results`, Infinity);
    if (all.rows.length > results.length) results = all.rows;
  }

  const record = orderRecord(detail, listRow);

  // Keep a facility someone already assigned; otherwise try the mapping rules.
  let organizationId = existing && existing.organization_id;
  let facilityId = existing && existing.facility_id;
  if (!organizationId) {
    const facilityKey = record.location_name || record.organization_name;
    if (facilityKey) {
      const match = await db.rpc('find_stratus_facility_mapping', {
        p_facility_identifier: facilityKey,
        p_organization_identifier: record.organization_name || null,
      });
      if (Array.isArray(match) && match[0]) {
        organizationId = match[0].organization_id;
        facilityId = match[0].facility_id;
      }
    }
  }
  if (organizationId) {
    record.organization_id = organizationId;
    record.facility_id = facilityId || null;
  }

  const [saved] = await db.upsert('lab_orders', [record], 'stratus_guid');
  const orderId = saved.id;

  // Panels (what was ordered).
  await db.remove('stratus_order_panels', `lab_order_id=eq.${orderId}`);
  const panels = Array.isArray(detail.panels) ? detail.panels : [];
  let panelIdByName = new Map();
  if (panels.length) {
    const inserted = await db.insert('stratus_order_panels', panels.map((p, i) => ({
      lab_order_id: orderId,
      panel_name: p.panelName || null,
      panel_code: p.panelCode || null,
      cpt_code: p.cptCode || null,
      testmethod_name: p.testMethodName || null,
      specimen_type: p.specimenType || null,
      sample_type: p.sampleType || null,
      comments: p.panelComments || null,
      sort_order: i,
    })));
    panelIdByName = new Map((inserted || []).filter((p) => p.panel_name).map((p) => [p.panel_name, p.id]));
  }

  // Results (what came back): one lab_results row per order, one observation per test.
  if (results.length) {
    const finalizedUtc = centralToUtcIso(record.finalized_datetime);
    const anyAbnormal = results.some((r) => isAbnormalFlag(r.resultFlag));
    const [resultRow] = await db.upsert('lab_results', [{
      stratus_guid: `${accessionId}-results`,
      lab_order_id: orderId,
      organization_id: record.organization_id || (existing && existing.organization_id) || null,
      facility_id: record.facility_id || (existing && existing.facility_id) || null,
      accession_id: accessionId,
      accession_number: accessionId,
      result_status: record.order_status,
      result_data: {
        accessionId,
        organizationName: record.organization_name,
        locationName: record.location_name,
        status: record.order_status,
        finalizedDatetime: record.finalized_datetime,
        results,
      },
      abnormal_flag: anyAbnormal ? 'Abnormal' : 'Normal',
      result_date: finalizedUtc || new Date().toISOString(),
      resulted_at_utc: finalizedUtc,
      is_finalized: record.is_finalized,
      is_canceled: record.is_canceled,
      is_rejected: record.is_rejected,
      finalized_at: record.finalized_datetime,
      canceled_at: record.canceled_at,
      rejected_at: record.rejected_at,
      sync_status: 'synced',
      sync_error: null,
      retrieved_at: new Date().toISOString(),
    }], 'stratus_guid');
    await db.remove('stratus_result_observations', `lab_result_id=eq.${resultRow.id}`);
    await db.insert('stratus_result_observations', results.map((r, i) => ({
      lab_result_id: resultRow.id,
      lab_order_id: orderId,
      order_panel_id: panelIdByName.get(r.panelName) || null,
      test_code: r.testCode || null,
      test_name: r.testDescription || r.testCode || null,
      test_description: r.testDescription || null,
      result_value: hasValue(r.resultValue) ? String(r.resultValue) : null,
      result_display: hasValue(r.resultDisplay) ? String(r.resultDisplay) : null,
      result_flag: r.resultFlag || null,
      result_uom: r.unitOfMeasure || null,
      test_uom: r.unitOfMeasure || null,
      is_abnormal: isAbnormalFlag(r.resultFlag),
      sort_order: i,
    })));
  }
  return {
    finalizedWithoutResults: finalized && results.length === 0,
    hasProgress: ['receivedDatetime', 'finalizedDatetime', 'canceledDatetime', 'rejectedDatetime'].some((k) => hasValue(detail[k])),
    resultsSaved: results.length,
  };
}

async function markError(db, listRow, message) {
  const accessionId = String(listRow.accessionId);
  try {
    const existing = await db.select('lab_orders', `select=id&stratus_guid=eq.${encodeURIComponent(accessionId)}`);
    if (existing && existing[0]) {
      await db.update('lab_orders', `id=eq.${existing[0].id}`, { sync_error: message.slice(0, 500) });
    }
  } catch (err) {
    console.error(`[SYNC] Could not record the error for ${accessionId}: ${err.message}`);
  }
}

// Runs fn over items with a small worker pool, starting no new item after the deadline.
async function runPool(items, deadline, fn, concurrency = CONCURRENCY) {
  const done = new Set();
  let next = 0;
  async function worker() {
    while (next < items.length && Date.now() < deadline) {
      const i = next++;
      if (await fn(items[i])) done.add(i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return done;
}

// ---------- the sync run ----------

// One step: one date window of new orders, plus (on the first step of a run)
// the changed-orders pass. Saves the checkpoint before returning.
async function syncStep({ cfg, db, api, deadline, includeChanged, changedDoneBefore }) {
  const [checkpoint] = (await db.select('stratus_sync_checkpoint', 'select=*&id=eq.1')) || [];
  const today = utcDay(new Date());
  const since = (checkpoint && checkpoint.last_processed_at_utc) || `${cfg.backfillFrom}T00:00:00.000Z`;
  const sinceMs = Date.parse(since);
  // Orders changed before the first run are read in their current state by
  // the new-orders pass, so the changed-orders pass starts from yesterday.
  const statusFrom = (checkpoint && checkpoint.status_updated_from) || addDays(today, -1);

  // 1. New orders, one date window at a time (whole UTC days, both ends inclusive).
  const windowFrom = utcDay(new Date(sinceMs));
  const windowTo = addDays(windowFrom, WINDOW_DAYS - 1) < today ? addDays(windowFrom, WINDOW_DAYS - 1) : today;
  // The live API treats "to" as the start of that day, so ask up to the next
  // day and keep only rows before it. A one-day window "D to D" comes back empty.
  const windowEnd = addDays(windowTo, 1);
  const windowEndMs = Date.parse(`${windowEnd}T00:00:00Z`);
  const newList = await api.list(`/orders?dateField=processedAt&from=${windowFrom}&to=${windowEnd}`, deadline);
  // The same accession listed more than once on one day (counted for the summary).
  const sameDayRows = newList.rows.filter((r) => r && hasValue(r.accessionId));
  const repeatedAccessions = sameDayRows.length - new Set(sameDayRows.map((r) => String(r.accessionId))).size;
  const newRows = newList.rows.filter((r) => {
    const t = r && Date.parse(r.processedAtUtc);
    return r && hasValue(r.accessionId) && t >= sinceMs && t < windowEndMs;
  });

  // 2. Orders changed since the last finished pass (results added, status changes).
  let changedList = { rows: [], complete: false };
  if (includeChanged && Date.now() < deadline) {
    changedList = await api.list(`/orders?dateField=statusUpdated&from=${statusFrom}&to=${addDays(today, 1)}`, deadline);
  }

  // One queue, oldest first, each accession once.
  const byAccession = new Map();
  for (const r of [...newRows, ...changedList.rows]) {
    if (r && hasValue(r.accessionId)) byAccession.set(String(r.accessionId), r);
  }
  const queue = [...byAccession.values()].sort((a, b) => (Date.parse(a.processedAtUtc) || 0) - (Date.parse(b.processedAtUtc) || 0));

  // Skip orders that have not changed since we saved them.
  const existingByAccession = new Map();
  for (let i = 0; i < queue.length; i += 80) {
    const ids = queue.slice(i, i + 80).map((r) => `"${String(r.accessionId).replace(/"/g, '')}"`).join(',');
    const rows = await db.select('lab_orders', `select=id,stratus_guid,organization_id,facility_id,sync_fingerprint&stratus_guid=in.(${encodeURIComponent(ids)})`);
    for (const row of rows || []) existingByAccession.set(row.stratus_guid, row);
  }

  const errors = [];
  let saved = 0;
  let finalizedNoResults = 0;
  let unchanged = 0;
  const finished = await runPool(queue, deadline, async (row) => {
    const accessionId = String(row.accessionId);
    const existing = existingByAccession.get(accessionId);
    if (existing && existing.sync_fingerprint === fingerprint(row)) { unchanged++; return true; }
    try {
      const outcome = await saveOrder(db, api, row, existing);
      if (outcome && outcome.finalizedWithoutResults) finalizedNoResults++;
      saved++;
      return true;
    } catch (err) {
      console.error(`[SYNC] Order ${accessionId} failed: ${err.message}`);
      errors.push({ accessionId, error: err.message });
      await markError(db, row, err.message);
      return false;
    }
  });
  const doneAccessions = new Set([...finished].map((i) => String(queue[i].accessionId)));

  // New checkpoint: just before the oldest new order that is not done yet.
  // "from" is inclusive, so that order is read again next time.
  // The list comes newest first, so if it was not read to the end the older
  // orders are still unread and the checkpoint must stay where it is.
  let nextCheckpoint = since;
  const notDone = newRows.filter((r) => !doneAccessions.has(String(r.accessionId)));
  if (!newList.complete) {
    nextCheckpoint = since;
  } else if (notDone.length) {
    const oldest = notDone.reduce((m, r) => Math.min(m, Date.parse(r.processedAtUtc)), Infinity);
    if (Number.isFinite(oldest) && oldest > sinceMs) nextCheckpoint = new Date(oldest).toISOString();
  } else if (windowTo < today) {
    nextCheckpoint = `${addDays(windowTo, 1)}T00:00:00.000Z`; // window finished: move to the next one
  } else if (newRows.length) {
    nextCheckpoint = newRows.reduce((m, r) => (Date.parse(r.processedAtUtc) > Date.parse(m) ? r.processedAtUtc : m), since);
  }

  // The changed-orders pass restarts from yesterday once it fully finishes.
  const changedDone = includeChanged
    ? changedList.complete && changedList.rows.every((r) => doneAccessions.has(String(r.accessionId)))
    : changedDoneBefore;
  const nextStatusFrom = includeChanged && changedDone ? addDays(today, -1) : statusFrom;

  await db.upsert('stratus_sync_checkpoint', [{
    id: 1,
    last_processed_at_utc: nextCheckpoint,
    status_updated_from: nextStatusFrom,
  }], 'id');

  const windowFinished = newList.complete && notDone.length === 0;
  return {
    windowFrom, windowTo, saved, unchanged, finalizedNoResults, repeatedAccessions, errors, fetched: queue.length, nextCheckpoint, changedDone,
    listed: newList.rows.length + changedList.rows.length,
    filteredRows: newList.rows.length - newRows.length,
    // Move straight on to the next window when this one is fully done and is not the last.
    canContinue: windowFinished && windowTo < today,
    caughtUp: windowFinished && windowTo >= today && changedDone,
  };
}

async function runSync({ budgetMs, trigger }) {
  const started = Date.now();
  const deadline = started + budgetMs;
  const cfg = config();
  const missing = missingSettings(cfg);
  if (missing.length) return { ok: false, status: 500, error: `StratusDX sync is not set up. Missing Netlify settings: ${missing.join(', ')}` };

  const db = makeDb(cfg);
  const api = makeApi(cfg, db);

  // One run at a time: take the lock unless another run holds it.
  const now = new Date().toISOString();
  const locked = await db.updateReturning(
    'stratus_sync_checkpoint',
    `id=eq.1&or=${encodeURIComponent(`(run_lock_until.is.null,run_lock_until.lt."${now}")`)}`,
    { run_lock_until: new Date(Date.now() + budgetMs + 120000).toISOString() },
  );
  if (!Array.isArray(locked) || locked.length === 0) {
    console.log(`[SYNC] ${trigger}: another run is in progress, skipped`);
    return { ok: true, busy: true, summary: { trigger, busy: true, more: true }, errors: [] };
  }
  try {
    return await runLocked({ cfg, db, api, started, deadline, trigger });
  } finally {
    await db.update('stratus_sync_checkpoint', 'id=eq.1', { run_lock_until: null }).catch((err) => {
      console.error(`[SYNC] Could not release the lock: ${err.message}`);
    });
  }
}

async function runLocked({ cfg, db, api, started, deadline, trigger }) {
  // Keep stepping through date windows until caught up or the time is nearly used.
  const steps = [];
  // Connection check on manual runs: what the API holds in total, how new its
  // newest order is, and which field names it uses (names only, no values).
  let apiCheck = null;
  if (trigger === 'manual') {
    try {
      const page = await api.get('/orders?top=1');
      const first = page && Array.isArray(page.data) ? page.data[0] : null;
      apiCheck = {
        total_orders: page && page.totalCount !== undefined ? page.totalCount : null,
        newest_processed_at: first ? first.processedAtUtc || null : null,
        fields: first ? Object.keys(first).slice(0, 40) : [],
        response_keys: page && typeof page === 'object' ? Object.keys(page).slice(0, 10) : [],
      };
      // How the API reads a date range: count the newest order's day asked as
      // "D to D" and as "D to D+1".
      if (first && first.processedAtUtc) {
        const day = utcDay(new Date(Date.parse(first.processedAtUtc)));
        const count = async (to) => {
          const p = await api.get(`/orders?dateField=processedAt&from=${day}&to=${to}&top=1`);
          return p && p.totalCount !== undefined ? p.totalCount : null;
        };
        apiCheck.range_check = { day, same_day: await count(day), to_next_day: await count(addDays(day, 1)) };
      }
    } catch (err) {
      apiCheck = { error: err.message };
    }
  }

  let step = await syncStep({ cfg, db, api, deadline, includeChanged: true });
  steps.push(step);
  while (step.canContinue && Date.now() < deadline - 1500) {
    step = await syncStep({ cfg, db, api, deadline, includeChanged: false, changedDoneBefore: step.changedDone });
    steps.push(step);
  }

  // Once caught up, spend a short slice re-checking older pending orders and
  // finalized orders with no results.
  let recheck = null;
  if (step.caughtUp && Date.now() < deadline - 3000) {
    try {
      recheck = await recheckPending(db, api, Math.min(deadline - 1000, Date.now() + RECHECK_MAX_MS));
    } catch (err) {
      // e.g. the re-check database function is not installed yet: never block the sync.
      console.error(`[SYNC] Re-check skipped: ${err.message}`);
      recheck = { error: err.message.slice(0, 300) };
    }
  }

  const errors = steps.flatMap((s) => s.errors);
  const sum = (k) => steps.reduce((n, s) => n + s[k], 0);
  const summary = {
    trigger,
    window: `${steps[0].windowFrom} to ${step.windowTo}`,
    windows: steps.length,
    total_fetched: sum('fetched'),
    api_rows_listed: sum('listed'),
    api_rows_filtered: sum('filteredRows'),
    api_check: apiCheck,
    base_url: cfg.baseUrl,
    total_processed: sum('saved'),
    unchanged: sum('unchanged'),
    finalized_without_results: sum('finalizedNoResults'),
    repeated_accessions: sum('repeatedAccessions'),
    recheck,
    errors: errors.length,
    error_list: errors.slice(0, MAX_ERRORS_REPORTED),
    more: !step.caughtUp,
    new_checkpoint: step.nextCheckpoint,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
  await db.upsert('stratus_sync_checkpoint', [{
    id: 1,
    last_sync_run_at: new Date().toISOString(),
    last_sync_summary: summary,
  }], 'id');

  console.log(`[SYNC] ${trigger}: ${summary.windows} windows, ${summary.total_processed} saved, ${summary.unchanged} unchanged, ${errors.length} failed, more=${summary.more}`);
  return { ok: true, summary, errors: summary.error_list };
}

// ---------- weekly re-check of older pending orders ----------

function recheckParams() {
  const cutoff = new Date(Date.now() - RECHECK_AFTER_DAYS * 864e5);
  return {
    p_pending_before: `${utcDay(cutoff).replaceAll('-', '')}000000`,
    p_read_before: new Date(Date.now() - RECHECK_EVERY_DAYS * 864e5).toISOString(),
  };
}

// Re-reads, at most once a week and oldest read first: orders still Pending
// or Pending Received 14 days after they were ordered, and Final orders with
// no results saved. Chosen by stratus_recheck_candidates (migration).
async function recheckPending(db, api, deadline) {
  const params = recheckParams();
  const rows = await db.rpc('stratus_recheck_candidates', { ...params, p_limit: RECHECK_BATCH });
  let checked = 0;
  let gainedDates = 0;
  let gainedResults = 0;
  let failed = 0;
  await runPool(rows || [], deadline, async (row) => {
    try {
      const outcome = await saveOrder(db, api, { accessionId: row.stratus_guid }, row);
      checked++;
      if (row.lab_status === 'Final') {
        if (outcome && outcome.resultsSaved > 0) gainedResults++;
      } else if (outcome && outcome.hasProgress) {
        gainedDates++;
      }
      return true;
    } catch (err) {
      failed++;
      console.error(`[SYNC] Re-check of ${row.stratus_guid} failed: ${err.message}`);
      // Wait a week before trying this one again.
      await db.update('lab_orders', `id=eq.${row.id}`, { retrieved_at: new Date().toISOString(), sync_error: err.message.slice(0, 500) })
        .catch(() => {});
      return false;
    }
  }, RECHECK_CONCURRENCY);
  const waiting = await db.rpc('stratus_recheck_waiting', params).catch(() => null);
  return { checked, gained_dates: gainedDates, gained_results: gainedResults, failed, waiting };
}

// ---------- count check ----------

// Orders per month in StratusDX (by processedAtUtc) next to orders saved here
// (by processed_at_utc). Read only: it takes no lock and changes nothing.
async function countCheck() {
  const cfg = config();
  const missing = missingSettings(cfg);
  if (missing.length) return { ok: false, status: 500, error: `StratusDX sync is not set up. Missing Netlify settings: ${missing.join(', ')}` };
  const db = makeDb(cfg);
  const api = makeApi(cfg, db);
  const [checkpoint] = (await db.select('stratus_sync_checkpoint', 'select=last_processed_at_utc&id=eq.1')) || [];

  const today = utcDay(new Date());
  const months = [];
  for (let m = cfg.backfillFrom.slice(0, 7); `${m}-01` <= today;) {
    const [y, mo] = m.split('-').map(Number);
    const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
    months.push({ month: m, from: `${m}-01`, to: `${next}-01` });
    m = next;
  }
  const rows = await Promise.all(months.map(async ({ month, from, to }) => {
    const [page, saved] = await Promise.all([
      api.get(`/orders?dateField=processedAt&from=${from}&to=${to}&top=1`),
      db.count('lab_orders', `processed_at_utc=gte.${from}T00:00:00.000Z&processed_at_utc=lt.${to}T00:00:00.000Z`),
    ]);
    // The live API's "to" is exclusive (the connection check shows "D to D" is
    // empty), so first-of-month to first-of-next-month is exactly one month.
    const apiCount = Number(page && page.totalCount) || 0;
    const imported = checkpoint && checkpoint.last_processed_at_utc && Date.parse(checkpoint.last_processed_at_utc) >= Date.parse(`${to}T00:00:00Z`);
    return { month, api: apiCount, saved, fully_read: Boolean(imported) };
  }));
  return {
    ok: true,
    checked_at: new Date().toISOString(),
    read_up_to: checkpoint ? checkpoint.last_processed_at_utc : null,
    months: rows,
    api_total: rows.reduce((n, r) => n + r.api, 0),
    saved_total: rows.reduce((n, r) => n + r.saved, 0),
  };
}

// ---------- background catch-up ----------

// The background function accepts this key from the other sync functions. It
// is derived from the service role key, so the key itself is never sent.
function backgroundKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) return '';
  return require('crypto').createHash('sha256').update(`stratus-sync-background:${secret}`).digest('hex');
}

// Starts sync-stratus-background (up to 15 minutes of work). Netlify answers
// 202 at once and keeps running it. Returns true when it was started.
async function startBackground() {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  const key = backgroundKey();
  if (!base || !key) return false;
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/.netlify/functions/sync-stratus-background`, {
      method: 'POST',
      headers: { 'x-stratus-sync-key': key },
    });
    return res.status === 202 || res.ok;
  } catch (err) {
    console.error(`[SYNC] Could not start the background run: ${err.message}`);
    return false;
  }
}

module.exports = { runSync, countCheck, startBackground, backgroundKey, centralToUtcIso, fingerprint, isAbnormalFlag, camelKeys };
