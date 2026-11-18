# StratusDX LIS Integration API — Developer Guide

A guide for building applications against the StratusDX LIS Integration API.

This API exposes laboratory orders and results that have been ingested from StratusDX, normalized, and stored in a canonical schema. It supports two kinds of consumer:

- **Lab operations applications** — browse orders, drill into results, receive live updates as results finalize.
- **Management reporting tools** — aggregate volume and turnaround-time metrics.

---

## Contents

1. [Quickstart](#quickstart)
2. [Authentication](#authentication)
3. [Access levels](#access-levels)
4. [Conventions](#conventions)
5. [Endpoints](#endpoints)
6. [Real-time result notifications](#real-time-result-notifications)
7. [Errors](#errors)
8. [Best practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Current limitations](#current-limitations)

---

## Quickstart

**1. Get your credentials.** Your administrator will provide four values:

| Value | Description |
|---|---|
| `tenantId` | Microsoft Entra ID tenant |
| `apiClientId` | Application ID of the LIS Integration API (used to build the token scope) |
| `clientId` | Application ID of *your* service principal |
| `clientSecret` | Secret for your service principal — store in a secret manager, never in source |

**2. Request an access token.**

```bash
curl -X POST "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "scope=${API_CLIENT_ID}/.default"
```

**3. Call the API.**

```bash
curl "https://func-stratusdx-poll-dev.azurewebsites.net/api/orders?top=25" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

You should receive a paginated list of the 25 most recently processed orders.

---

## Authentication

The API uses **OAuth 2.0 client credentials** against Microsoft Entra ID. There is no interactive login and no API key — every request carries a bearer token.

```http
Authorization: Bearer eyJ0eXAiOiJKV1Qi...
```

### Token lifetime and caching

Tokens are typically valid for about an hour. **Cache the token and reuse it until shortly before it expires.** Requesting a new token on every API call will get you throttled by Entra ID, not by this API.

A common pattern is to refresh when fewer than five minutes remain on the token's `expires_in`.

### Example: C#

```csharp
using Azure.Core;
using Azure.Identity;

// ClientSecretCredential caches tokens internally and refreshes automatically.
var credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

var token = await credential.GetTokenAsync(
    new TokenRequestContext(new[] { $"{apiClientId}/.default" }));

httpClient.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", token.Token);
```

### Example: JavaScript / TypeScript

```ts
import { ClientSecretCredential } from "@azure/identity";

const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
const token = await credential.getToken(`${apiClientId}/.default`);

const res = await fetch(`${baseUrl}/orders?top=25`, {
  headers: { Authorization: `Bearer ${token.token}` },
});
```

Both SDKs handle caching and refresh for you. Prefer them over hand-rolling the token request.

---

## Access levels

Your service principal is granted one of two roles. **The roles do not overlap** — each grants access to a distinct set of endpoints, and calling outside your role returns `403 Forbidden`.

| Role | Can access | Cannot access |
|---|---|---|
| `lab_ops_reader` | `/orders`, `/orders/*`, `/negotiate` | `/reports/*` |
| `mgmt_reporting_reader` | `/reports/*` | `/orders`, `/orders/*`, `/negotiate` |

If your application genuinely needs both order detail and aggregate reporting, ask your administrator to grant both roles to your service principal. Do not attempt to work around this by sharing credentials between applications.

**Note on patient data:** the `lab_ops_reader` role is deliberately scoped to exclude patient SSN. Fields you do not see in the responses below are not available to you by design.

---

## Conventions

### Base URL

```
https://func-stratusdx-poll-dev.azurewebsites.net/api
```

All paths in this guide are relative to that base.

### JSON casing

Responses use **camelCase** property names: `accessionId`, `patientLastName`, `processedAtUtc`.

### Two date formats — read this carefully

The API returns timestamps in **two different formats**, and mixing them up is the most common integration bug.

| Format | Fields | Example |
|---|---|---|
| **ISO 8601 datetime** | `processedAtUtc`, `statusUpdatedAtUtc` | `2026-06-12T09:31:04.221Z` |
| **Compact string** `yyyyMMddHHmmss` | `requisitionDatetime`, `receivedDatetime`, `finalizedDatetime`, `canceledDatetime`, `rejectedDatetime` | `"20260612093000"` |

`orderDate` on the daily volume report is a third case: a calendar date rendered at midnight with no zone suffix (`2026-05-05T00:00:00`). It is a date, not an instant — do not convert it between timezones.

The compact fields are **strings, not dates**. Parse them explicitly:

```csharp
DateTime.ParseExact(order.FinalizedDatetime, "yyyyMMddHHmmss",
    CultureInfo.InvariantCulture);
```

`dateOfBirth` is a third format: the string `yyyy-MM-dd`.

### Timezones — the two formats do not agree

| Format | Timezone | Produced by |
|---|---|---|
| ISO 8601 (`processedAtUtc`, `statusUpdatedAtUtc`) | **UTC** | This pipeline |
| Compact `yyyyMMddHHmmss` (all five clinical fields) | **US Central** (`America/Chicago`, DST-aware) | StratusDX |

The compact fields carry no timezone suffix and are stored exactly as StratusDX sends them. They are **not UTC** — they run 5 hours behind UTC during daylight saving and 6 hours behind outside it.

> **This is a StratusDX-side configuration setting and can be changed by them.** If it is, these fields change meaning with no change to their format, no change to this API, and no version bump. Confirm the current setting before relying on it for anything clinical or contractual.

To compare a clinical timestamp against `processedAtUtc`, convert first:

```csharp
var central = TimeZoneInfo.FindSystemTimeZoneById("America/Chicago");
var wallClock = DateTime.ParseExact(order.FinalizedDatetime, "yyyyMMddHHmmss",
    CultureInfo.InvariantCulture);
var utc = TimeZoneInfo.ConvertTimeToUtc(wallClock, central);
```

### Query date parameters

When you supply `from` and `to`, send a plain ISO date:

```
?from=2026-05-01&to=2026-06-01
```

Both bounds are **inclusive**, and values are interpreted as UTC.

When filtering on a compact-format field (`finalized`, `requisition`, `received`, `canceled`, `rejected`), filtering is **whole-day only** — any time component you send is ignored. `from=2026-05-01T14:00:00Z` behaves identically to `from=2026-05-01`.

> **Boundary caveat.** Your UTC-interpreted bound is compared against a US Central string with no conversion applied, so these filters follow the Central calendar day rather than the UTC one. Rows falling in the 5–6 hour window either side of midnight can land on the adjacent day from what a UTC reading would suggest.

### Pagination

Every list endpoint accepts `top` and `skip`, and returns the same envelope:

```json
{
  "data": [ ... ],
  "totalCount": 1284,
  "top": 50,
  "skip": 0
}
```

| Parameter | Default | Maximum |
|---|---|---|
| `top` | 50 | 200 (**50** for `/reports/turnaround-time`) |
| `skip` | 0 | — |

`totalCount` is the total number of matching records across all pages — use it to decide whether to keep paging.

Values above the maximum are silently clamped rather than rejected. If you request `top=500` you will receive 200 records, and the response's `top` field will read `200`.

**Paging loop:**

```ts
let skip = 0;
const top = 200;
const all = [];

while (true) {
  const page = await getOrders({ top, skip });
  all.push(...page.data);
  skip += top;
  if (skip >= page.totalCount) break;
}
```

---

## Endpoints

### List orders

```http
GET /api/orders
```

Role: `lab_ops_reader`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `patientId` | string | — | Exact-match filter on patient identifier (see note below) |
| `status` | string | — | Exact-match filter on order status, case-insensitive |
| `dateField` | enum | `processedAt` | Which date the `from`/`to` range applies to |
| `from` | date | — | Inclusive lower bound |
| `to` | date | — | Inclusive upper bound |
| `top` | int | 50 | Max 200 |
| `skip` | int | 0 | |

**`dateField` options:**

| Value | Meaning |
|---|---|
| `processedAt` *(default)* | When the order entered the integration pipeline |
| `statusUpdated` | When the order record was last modified |
| `requisition` | Requisition date from StratusDX |
| `received` | Specimen received date |
| `finalized` | When results were finalized |
| `canceled` | Cancellation date |
| `rejected` | Rejection date |

Results are ordered newest-first by `processedAtUtc`.

**`patientId` is filter-only — no endpoint returns it.** The identifier is not present in any response body, so you cannot discover a valid value through this API. Use it only if you already hold patient identifiers from StratusDX or another source; otherwise filter on accession or date.

`status` is not validated — it passes straight through to the query, so an unknown value returns an empty `data` array rather than an error. Prefer `dateField=finalized` over `status=Final` when you want completed orders: a sizable minority of finalized orders never receive a status value, and `status=Final` silently omits them.

**Example**

```http
GET /api/orders?dateField=finalized&from=2026-05-01&to=2026-06-01&top=100
Authorization: Bearer {token}
```

```json
{
  "data": [
    {
      "accessionId": "104676",
      "altOrderId": "ORD-88213",
      "status": "final",
      "patientLastName": "Doe",
      "patientFirstName": "Jane",
      "finalizedDatetime": "20260531161200",
      "organizationName": "Northside Clinic",
      "locationName": "Northside — Main",
      "processedAtUtc": "2026-05-31T16:14:02.117Z",
      "panels": [
        {
          "panelName": "CBC",
          "panelCode": "CBC01",
          "cptCode": "85025",
          "testMethodName": "Hematology",
          "resultCount": 1
        }
      ]
    }
  ],
  "totalCount": 412,
  "top": 100,
  "skip": 0
}
```

**Every list row carries its panels.** The `panels` array is fetched for the whole page in a single round trip, so you can render what was ordered — and, via `resultCount`, what is still outstanding — without a detail call per order:

```js
const pending = page.data.filter(o => o.panels.some(p => p.resultCount === 0));
```

An order with no panels yet returns an empty array rather than `null`. The panel fields here are a subset of those on the order detail endpoint — `specimenType`, `sampleType`, and `panelComments` are detail-only.

> Choosing the right `dateField` matters. `processedAt` reflects when *we* received the order and is best for incremental sync. `finalized` reflects clinical reality and is best for reporting on completed work.

---

### Get recent orders

```http
GET /api/orders/recent
```

Role: `lab_ops_reader`

Returns orders processed since a given timestamp. Use this to catch up after your application has been offline or after a dropped real-time connection.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `since` | ISO 8601 timestamp | **Yes** | Returns orders where `processedAtUtc >= since` |
| `top` | int | No | Default 50, max 200 |
| `skip` | int | No | Default 0 |

```http
GET /api/orders/recent?since=2026-06-12T00:00:00Z&top=200
```

The response shape is identical to `GET /api/orders`.

**Track your position** using the highest `processedAtUtc` you have successfully handled, and pass that as `since` on your next call. Do not use your local clock — it may drift from the server's.

Omitting `since`, or sending a value that cannot be parsed, returns `400`.

---

### Get order detail

```http
GET /api/orders/{accessionId}
```

Role: `lab_ops_reader`

Returns the complete order, including patient, provider, and organization details, plus **all** result rows embedded inline.

```http
GET /api/orders/104676
```

```json
{
  "accessionId": "104676",
  "altOrderId": "ORD-88213",
  "status": "final",
  "patientLastName": "Doe",
  "patientFirstName": "Jane",
  "dateOfBirth": "1984-03-22",
  "organizationName": "Northside Clinic",
  "locationName": "Northside — Main",
  "providerLastName": "Chen",
  "providerFirstName": "Robert",
  "providerNpi": "1234567890",
  "requisitionDatetime": "20260531084500",
  "receivedDatetime": "20260531101500",
  "finalizedDatetime": "20260531161200",
  "canceledDatetime": null,
  "rejectedDatetime": null,
  "processedAtUtc": "2026-05-31T16:14:02.117Z",
  "statusUpdatedAtUtc": "2026-05-31T16:14:02.117Z",
  "panels": [
    {
      "panelName": "CBC",
      "panelCode": "CBC01",
      "cptCode": "85025",
      "testMethodName": "Hematology",
      "specimenType": null,
      "sampleType": null,
      "panelComments": null,
      "resultCount": 1
    }
  ],
  "results": [
    {
      "testCode": "WBC",
      "testDescription": "White Blood Cell Count",
      "panelName": "CBC",
      "panelCode": "CBC01",
      "resultValue": "7.2",
      "resultDisplay": "7.2",
      "resultFlag": null,
      "unitOfMeasure": "10*3/uL"
    }
  ]
}
```

Returns `404` if the accession does not exist.

**`panels` is what was ordered; `results` is what came back.** The two are populated
independently — panels are written when the order is ingested, results only when values
are reported. An order awaiting results returns a populated `panels` array alongside an
empty `results` array. Check `resultCount` per panel to tell resulted panels from pending ones:

```js
const pending = order.panels.filter(p => p.resultCount === 0);
```

The list endpoints carry the same panels with the same `resultCount`, so reach for this
endpoint when you need the detail-only fields (`specimenType`, `sampleType`,
`panelComments`) or the inline results — not merely to find out what is outstanding.

Do not key display logic on `panelCode` — it is null on roughly a quarter of panels.
Use `panelName`, which is populated on every current row.

Because panels and results are **not paginated** here, prefer the dedicated results endpoint below for orders with large panels.

---

### Get order results

```http
GET /api/orders/{accessionId}/results
```

Role: `lab_ops_reader`

Paginated result rows for a single order, ordered by `panelCode` then `testCode`. Because `panelCode` is null on a sizable minority of rows, those results sort ahead of everything else as one block rather than grouping with their named panel — group by `panelName` client-side if you are rendering panel sections.

| Parameter | Type | Default |
|---|---|---|
| `top` | int | 50 (max 200) |
| `skip` | int | 0 |

```json
{
  "data": [
    {
      "testCode": "WBC",
      "testDescription": "White Blood Cell Count",
      "panelName": "CBC",
      "panelCode": "CBC01",
      "resultValue": "7.2",
      "resultDisplay": "7.2",
      "resultFlag": null,
      "unitOfMeasure": "10*3/uL"
    }
  ],
  "totalCount": 14,
  "top": 50,
  "skip": 0
}
```

An unknown accession ID returns `200` with an empty `data` array — **not** `404`. Check `totalCount` if you need to distinguish "no results yet" from "order does not exist"; use the order detail endpoint to confirm existence.

**Interpreting results:** `resultValue` is the raw value; `resultDisplay` is the formatted value intended for presentation. `resultFlag` carries abnormality indicators and is `null` for results within range. Display `resultDisplay` where available and fall back to `resultValue`.

---

### Daily volume report

```http
GET /api/reports/daily-volume
```

Role: **`mgmt_reporting_reader`**

Order counts aggregated by day and organization, newest first.

| Parameter | Type | Default |
|---|---|---|
| `from` / `to` | date | — |
| `top` | int | 50 (max 200) |
| `skip` | int | 0 |

```json
{
  "data": [
    {
      "orderDate": "2026-05-05T00:00:00",
      "orderCount": 138,
      "uniquePatients": 121,
      "organizationName": "Northside Clinic"
    }
  ],
  "totalCount": 125,
  "top": 50,
  "skip": 0
}
```

---

### Turnaround time report

```http
GET /api/reports/turnaround-time
```

Role: **`mgmt_reporting_reader`**

Per-order turnaround from requisition to finalization, newest first.

| Parameter | Type | Default |
|---|---|---|
| `from` / `to` | date | Filters on finalized date, whole-day granularity |
| `top` | int | 50 (**max 50**) |
| `skip` | int | 0 |

```json
{
  "data": [
    {
      "accessionId": "104676",
      "altOrderId": "ORD-88213",
      "requisitionDatetime": "20260531084500",
      "finalizedDatetime": "20260531161200",
      "turnaroundMinutes": 447,
      "organizationName": "Northside Clinic"
    }
  ],
  "totalCount": 412,
  "top": 50,
  "skip": 0
}
```

`turnaroundMinutes` is `null` when an order lacks a requisition or finalized timestamp. **Exclude nulls before averaging** rather than coercing them to zero.

This endpoint caps `top` at 50 — lower than every other endpoint — because the underlying aggregation is expensive. For bulk extracts, page through in date-bounded chunks rather than requesting large windows at once.

---

## Real-time result notifications

Lab operations clients can receive results as they finalize, over **Azure SignalR**.

| Property | Value |
|---|---|
| Hub | `results` |
| Event | `newResults` |
| Group | `lab_ops_results` |

The event payload is an **array** of orders — up to 40 per message — not a single order. Iterate it:

```ts
connection.on("newResults", (orders) => {
  for (const order of orders) {
    upsertOrder(order);
  }
});
```

Each element looks like:

```json
{
  "orderId": "8f1c2b7e-...",
  "accessionId": "104676",
  "patientLastName": "Doe",
  "patientFirstName": "Jane",
  "panels": [
    {
      "panelName": "CBC",
      "panelCode": "CBC01",
      "results": [
        {
          "testCode": "WBC",
          "testDescription": "White Blood Cell Count",
          "resultValue": "7.2",
          "resultDisplay": "7.2",
          "resultFlag": null,
          "unitOfMeasure": "10*3/uL"
        }
      ]
    }
  ],
  "finalizedDatetime": "20260612093000",
  "status": "final",
  "timestamp": "2026-06-12T09:31:04.221Z"
}
```

Note the shape differs from the REST endpoints: results are **nested inside panels** here, whereas `/orders/{id}/results` returns a flat list.

### Delivery guarantees

Notifications are **best-effort and are not retried.** If delivery fails, the event is dropped — but the data is always safely persisted and remains available over REST.

**Treat REST as the source of truth and SignalR purely as a latency optimization.** Every client must implement the reconciliation pattern below.

### Required reconnection pattern

```ts
let lastSeen = loadCheckpoint();          // highest processedAtUtc handled

async function reconcile() {
  let skip = 0;
  while (true) {
    const page = await get(`/orders/recent?since=${lastSeen}&top=200&skip=${skip}`);
    for (const o of page.data) applyOrder(o);
    skip += 200;
    if (skip >= page.totalCount) break;
  }
  saveCheckpoint(lastSeen);
}

connection.onreconnected(reconcile);
await reconcile();                         // also run on startup
```

Run `reconcile()` on startup and after every reconnect. Because an order may arrive both by notification and by catch-up query, **apply updates idempotently** — key on `accessionId` and upsert.

---

## Errors

All errors return JSON with an `error` code. Every status except `404` also carries a human-readable `reason`.

| Status | `error` | Meaning | What to do |
|---|---|---|---|
| `400` | `bad_request` | Invalid `dateField`, or missing/unparseable `since` | Fix the request; do not retry unchanged |
| `401` | `unauthorized` | Missing, malformed, expired, or invalid token | Acquire a fresh token and retry once |
| `403` | `forbidden` | Valid token, but your role does not cover this path | Do not retry — check [Access levels](#access-levels) |
| `404` | `not_found` | Unknown accession ID | Do not retry |

```json
{
  "error": "bad_request",
  "reason": "Invalid dateField 'invalid'. Valid values: processedAt, statusUpdated, requisition, received, finalized, canceled, rejected."
}
```

**`404` is the exception to that shape.** It carries the offending identifier instead of a `reason`:

```json
{
  "error": "not_found",
  "accessionId": "DOES-NOT-EXIST-99999"
}
```

Read `error` rather than `reason` when branching on error type, or `reason` will be `undefined` on this path.

A `401` also carries a `WWW-Authenticate: Bearer` header.

### Retry guidance

Retry only on `401` (once, after refreshing the token) and on `5xx` or network failures, using exponential backoff with jitter. Never retry `400`, `403`, or `404` — they are deterministic and will fail identically.

---

## Best practices

**Validate your query parameters before sending.** The API is lenient in ways that can hide bugs: an unparseable `from` or `to` is ignored entirely rather than rejected, so `?from=last-tuesday` silently returns the **full unfiltered dataset**. Likewise, a non-numeric `top` falls back to the default of 50. Only `dateField` and `since` are strictly validated.

**Always bound your queries.** Send an explicit `from`/`to` range on list and report endpoints. Unbounded queries scan the entire history.

**Page with the largest `top` you can use** (200, or 50 for turnaround time) to minimize round trips.

**Use `processedAt` for sync, clinical dates for reporting.** Incremental synchronization should key on `processedAtUtc` because it increases monotonically as data arrives. Clinical dates like `finalized` can be backdated.

**Cache tokens.** See [Token lifetime and caching](#token-lifetime-and-caching).

**Handle nulls defensively.** Almost every field except `accessionId` and `processedAtUtc` is nullable, including patient names.

**Protect patient data.** Responses contain PHI. Do not log full response bodies, do not cache them in unencrypted storage, and ensure transport is TLS end to end.

---

## Troubleshooting

**I get `401` on every request.**
Confirm your `scope` is `{apiClientId}/.default` — the API's application ID, not your own client ID. This is the most frequent cause. Also verify the token has not expired.

**I get `403` but my token is valid.**
Your service principal holds one role, and you are calling an endpoint belonging to the other. Reporting credentials cannot read `/orders`, and lab-ops credentials cannot read `/reports/*`.

**My date filter returns everything.**
The `from`/`to` value could not be parsed and was discarded. Use `YYYY-MM-DD`.

**My date filter misses records near the range edges.**
When filtering on `finalized`, `requisition`, `received`, `canceled`, or `rejected`, filtering is whole-day only and the time component is ignored. Widen the range by a day and filter precisely on the client.

**I requested 500 records and got 200.**
`top` is clamped to the endpoint maximum. Check the `top` field in the response and page for the remainder.

**`turnaroundMinutes` is null for some orders.**
The order is missing a requisition or finalized timestamp. Exclude those rows from averages.

**I am not receiving real-time notifications.**
See [Current limitations](#current-limitations) — then fall back to polling `/orders/recent`, which every client should implement regardless.

---

## Current limitations

Please read these before designing your integration.

1. **SignalR negotiation is not yet functional.** `POST /api/negotiate` currently returns only your `userId` and assigned `group`; it does not return the connection URL and access token a SignalR client needs. Until this is resolved, **real-time notifications cannot be established**, and clients should poll `GET /api/orders/recent` on an interval (30–60 seconds is typical). Building the reconciliation logic described above now means you will not need to change anything when notifications go live.

2. **No server-side sorting options.** Ordering is fixed per endpoint (newest-first).

3. **No `PATCH`/`POST` on clinical data.** This API is read-only for consumers; orders and results flow in from StratusDX.

4. **`/orders/{id}/results` returns `200` with an empty list for unknown accessions** rather than `404`.

5. **Deep paging is offset-based.** Very large `skip` values become progressively slower. Prefer narrowing `from`/`to` over paging deeply.

---

## Support

Contact the integration team with the following when reporting an issue:

- The full request URL, with any patient identifiers redacted
- The HTTP status code and the `error`/`reason` body
- The approximate UTC timestamp of the request
- Your service principal's client ID (**never** the secret)
