# Security Audit: Deployment Tracker Application

**Date:** 2026-03-06
**Scope:** Full codebase review — frontend (React/Vite), Netlify Functions, Supabase Edge Functions, services layer

---

## CRITICAL — Hardcoded Credentials in Source Code

**Severity: CRITICAL**
**Files affected:**
- `netlify/functions/stratus-api-proxy.js:1-3`
- `netlify/functions/explore-stratus-api.js:1-3`
- `netlify/functions/sync-stratus-orders.js:1-3`
- `netlify/functions/sync-stratus-confirmations.js:1-3`
- `netlify/functions/sync-stratus-results.js:1-3`
- `supabase/functions/stratus-api-proxy/index.ts:10-12`

**Description:** Three distinct sets of StratusDX API credentials (username/password) are hardcoded directly in source files committed to version control:

```js
// stratus-api-proxy.js, explore-stratus-api.js, sync-stratus-orders.js
const STRATUS_USERNAME = "novagen_stratusdx_11";
const STRATUS_PASSWORD = "9b910d57-49cb";

// sync-stratus-confirmations.js
const STRATUS_USERNAME = "novagen_stratusdx_13";
const STRATUS_PASSWORD = "be917642-d7c6";

// sync-stratus-results.js
const STRATUS_USERNAME = "novagen_stratusdx_12";
const STRATUS_PASSWORD = "a9943167-93f1";
```

**Risk:** Anyone with read access to this repository has full access to these API credentials. Even if the repo is private, this violates the principle of least privilege and makes credential rotation painful.

**Recommendation:**
1. **Immediately rotate all three sets of StratusDX credentials** — they must be considered compromised since they exist in git history.
2. Move all credentials to environment variables (`process.env.STRATUS_USERNAME`, etc.) configured in the Netlify dashboard and Supabase secrets.
3. Use `git filter-branch` or BFG Repo-Cleaner to scrub credentials from git history.
4. Add a pre-commit hook or secret-scanning tool (e.g., `gitleaks`, `trufflehog`) to prevent future credential commits.

---

## HIGH — Wildcard CORS (`Access-Control-Allow-Origin: *`)

**Severity: HIGH**
**Files affected:** All Netlify functions and Supabase Edge Functions

**Description:** Every serverless function returns `Access-Control-Allow-Origin: *`, allowing any website on the internet to make authenticated requests to these endpoints.

```js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
```

**Risk:** A malicious website could make cross-origin requests to your API endpoints. Combined with any CSRF-like vectors or leaked tokens, this expands the attack surface significantly.

**Recommendation:**
- Restrict `Access-Control-Allow-Origin` to your known domains (e.g., `https://proximitylabservices.com`, `https://your-netlify-site.netlify.app`).
- Use an environment variable for the allowed origin so it can differ between staging and production.

---

## HIGH — Netlify Proxy Has No Authentication

**Severity: HIGH**
**Files affected:**
- `netlify/functions/stratus-api-proxy.js`
- `netlify/functions/explore-stratus-api.js`

**Description:** The `stratus-api-proxy` and `explore-stratus-api` Netlify functions do **not** check for any authentication. Any caller can proxy requests to the StratusDX API through these endpoints. The `endpoint` query parameter is user-controlled and passed directly into the upstream URL construction.

```js
// stratus-api-proxy.js — no auth check at all
const endpoint = event.queryStringParameters?.endpoint;
let stratusUrl = `${STRATUS_BASE_URL}${endpoint}`;
```

**Risk:**
1. **Unauthenticated access** — anyone can call `/.netlify/functions/stratus-api-proxy?endpoint=/anything` and it will be proxied to StratusDX with valid credentials.
2. **Server-Side Request Forgery (SSRF)** — if the `endpoint` parameter contains path traversal or protocol manipulation (e.g., `endpoint=/../../../some-other-path`), it could be used to reach unintended hosts depending on how the upstream resolves URLs.
3. **Data exfiltration** — the proxy returns the full upstream response body to the caller.

**Recommendation:**
1. Add authentication (verify a Supabase JWT or session token) to all Netlify functions, like `sync-stratus-orders.js` already does.
2. Validate/whitelist the `endpoint` parameter to only allow known API paths.
3. The `explore-stratus-api` function is a diagnostic/debugging tool that runs pagination brute-force tests against the upstream API — it should be removed from production or gated behind admin authentication.

---

## HIGH — Query Parameter Injection in Supabase Queries

**Severity: HIGH**
**Files affected:**
- `netlify/functions/sync-stratus-orders.js:121-124`
- `netlify/functions/sync-stratus-confirmations.js:108-111`
- `netlify/functions/sync-stratus-results.js:108-111`

**Description:** Query strings for the Supabase REST API are constructed via string concatenation with `encodeURIComponent`, but the table name and query structure are built directly:

```js
const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { ... });
```

While the `table` parameter comes from within the code (not user input), the pattern of building raw REST queries is fragile and could become vulnerable if refactored carelessly.

**Recommendation:**
- Use the Supabase JS client library consistently instead of raw `fetch` calls against the REST API. This provides parameterized queries and prevents injection.

---

## HIGH — Impersonation Audit Logging Is a No-Op

**Severity: HIGH**
**Files affected:** `src/services/auditService.js:113-136`

**Description:** The `logImpersonationStart` and `logImpersonationStop` methods only write to `console.log` — they never persist to the database.

```js
async logImpersonationStart(adminUserId, targetUserId, targetUserEmail) {
  try {
    console.log('Logging impersonation start:', { ... });
    // No database insert!
  } catch (error) { ... }
},
```

**Risk:** Admin impersonation is a highly sensitive action. Without persistent audit logs, there is no way to forensically track who impersonated whom and when. This creates a significant accountability gap.

**Recommendation:**
- Insert impersonation events into the `activity_log` table (or a dedicated `audit_events` table) with the admin user ID, target user ID, timestamp, and action type.
- Consider making impersonation logs immutable (append-only, no update/delete RLS).

---

## MEDIUM — Client-Side Authorization Only (Impersonation)

**Severity: MEDIUM**
**Files affected:** `src/contexts/AuthContext.jsx:218-258`

**Description:** The impersonation check `if (profile.role !== 'Proximity Admin')` is enforced only on the client side. The actual Supabase queries to fetch the target user's profile have no server-side validation that the requester is an admin.

```js
const startImpersonation = async (targetUserId) => {
  if (!profile || profile.role !== 'Proximity Admin') {
    throw new Error('Only Proximity Admins can impersonate users');
  }
  // Then fetches target user from supabase — no server-side admin check
};
```

**Risk:** A user who manipulates their local `profile` state (or calls Supabase directly) could bypass this check. The true security boundary is Supabase Row Level Security (RLS) policies, which are not visible in this codebase but should be verified.

**Recommendation:**
- Verify that Supabase RLS policies enforce admin-only access to the `user_roles` table for read/update operations.
- Consider implementing impersonation as a server-side function (Supabase Edge Function) that validates the caller's role before returning any data.

---

## MEDIUM — Client-Side Role Determination Falls Back to Viewer

**Severity: MEDIUM**
**Files affected:** `src/contexts/AuthContext.jsx:121-158`

**Description:** If fetching the user profile fails for any reason (network error, RLS issue, etc.), the code defaults to `{ role: 'Viewer' }`:

```js
setProfile(data || { role: 'Viewer' });
// ... in catch block:
setProfile({ role: 'Viewer' });
```

**Risk:** While defaulting to the least-privileged role is the correct pattern, this means a transient network error could silently downgrade a legitimate admin to viewer. More importantly, the client-side role is trusted for UI gating throughout the app — but the real enforcement must happen in Supabase RLS policies.

**Recommendation:**
- Show an explicit error state when the profile cannot be loaded rather than silently downgrading. This prevents confusion and ensures the user knows something is wrong.

---

## MEDIUM — Potential Supabase Filter Injection in Search

**Severity: MEDIUM**
**Files affected:**
- `src/services/unifiedDocumentService.js:275`
- `src/services/unifiedDocumentService.js:476`
- `src/services/facilitiesService.js:27`
- `src/services/projectsService.js:22`

**Description:** User-provided search terms are interpolated directly into Supabase `.ilike()` and `.or()` filter strings:

```js
query = query.or(`document_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
query = query.ilike('name', `%${filters.search}%`);
```

**Risk:** While PostgREST/Supabase generally handles parameterization for `.ilike()`, the `.or()` string-building pattern could allow filter manipulation if a user provides special PostgREST syntax characters (e.g., `,`, `.`, `(`, `)`) in the search term. This could alter the filter logic.

**Recommendation:**
- Sanitize search terms by escaping or stripping PostgREST special characters before interpolation.
- Use separate `.ilike()` calls combined with Supabase's query builder instead of raw `.or()` string construction.

---

## MEDIUM — Email Template Injection

**Severity: MEDIUM**
**Files affected:**
- `supabase/functions/send-invitation-email/index.ts:115-121`
- `netlify/functions/send-invitation-email.js:57-62`

**Description:** The `role` and `inviteUrl` values from the request body are interpolated directly into HTML email templates without escaping:

```html
<strong>${role}</strong>
<a href="${inviteUrl}" ...>Accept Invitation</a>
```

**Risk:** If an attacker can control the `role` or `inviteUrl` fields (e.g., by calling the function directly with a crafted payload), they could inject HTML/JavaScript into the email or redirect the invite link to a phishing site.

**Recommendation:**
1. HTML-encode all interpolated values in the email template.
2. Validate that `inviteUrl` matches your known domain pattern.
3. Validate `role` against an allowlist of known roles.
4. Add authentication to the email-sending function to ensure only authorized users can trigger it.

---

## MEDIUM — Excessive Console Logging of Sensitive Data

**Severity: MEDIUM**
**Files affected:**
- `src/lib/supabase.js:6-10` — Logs Supabase URL
- `src/contexts/AuthContext.jsx:69,79,99` — Logs session details, user emails
- `src/components/ProtectedRoute.jsx:8` — Logs role information
- `supabase/functions/stratus-api-proxy/index.ts:86-87` — Logs user email and ID
- `supabase/functions/stratus-api-proxy/index.ts:133` — Logs full API response data
- `netlify/functions/send-invitation-email.js:125-127` — Logs invite URL (contains token)

**Risk:**
- In production browser environments, these logs are visible to anyone who opens DevTools.
- In serverless function environments, logs may be stored in Netlify/Supabase dashboards where they could be accessed by team members who shouldn't see raw API data.
- Logging the invite URL exposes the invitation token in logs.

**Recommendation:**
- Remove or gate sensitive `console.log` statements behind a `NODE_ENV !== 'production'` check.
- Never log tokens, passwords, or full API response payloads in production.
- Use structured logging with appropriate log levels.

---

## MEDIUM — No File Type/Size Validation on Document Upload

**Severity: MEDIUM**
**Files affected:** `src/services/unifiedDocumentService.js:73-122`

**Description:** The document upload service accepts any file without validating file type, size, or content:

```js
async uploadDocument(entityType, entityId, file, metadata = {}, storageBucket = null) {
  const fileExt = file.name.split('.').pop();
  // No validation of fileExt, file.size, or file.type
  const fileName = `${entityType}/${entityId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  await supabase.storage.from(storageBucket).upload(fileName, file);
}
```

**Risk:**
- Users could upload executable files (.exe, .js, .html) that could be served back and potentially executed.
- No file size limit could lead to storage abuse or denial of service.
- The file extension is taken from the user-provided filename, not validated against the actual MIME type.

**Recommendation:**
1. Validate file extensions against an allowlist (e.g., `.pdf`, `.doc`, `.docx`, `.xlsx`, `.jpg`, `.png`).
2. Validate MIME type matches the extension.
3. Enforce a maximum file size (e.g., 50MB).
4. Configure Supabase Storage bucket policies to restrict allowed MIME types.

---

## MEDIUM — 3-Hour Idle Timeout Is Generous

**Severity: MEDIUM**
**Files affected:** `src/contexts/AuthContext.jsx:5`

**Description:** The idle session timeout is set to 3 hours:

```js
const IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours
```

**Risk:** For an application managing healthcare/lab deployment data, a 3-hour idle timeout means an unattended workstation remains authenticated for a long time. If this application handles PHI or sensitive lab data, compliance frameworks (HIPAA, etc.) may require shorter timeouts.

**Recommendation:**
- Consider reducing to 30-60 minutes based on your compliance requirements.
- Add a warning modal before auto-logout so users can extend their session.

---

## LOW — Duplicate Supabase Client Initialization

**Severity: LOW**
**Files affected:**
- `src/lib/supabase.js`
- `src/js/supabase.js`

**Description:** Two separate Supabase client instances exist. The one in `src/js/supabase.js` lacks the PKCE auth flow configuration and session management options that `src/lib/supabase.js` includes:

```js
// src/js/supabase.js — minimal, no PKCE
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// src/lib/supabase.js — properly configured
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' }
});
```

**Risk:** Code that imports from `src/js/supabase.js` will not benefit from PKCE protection, auto token refresh, or session persistence. This inconsistency could lead to auth bypass in components using the wrong import.

**Recommendation:**
- Remove `src/js/supabase.js` and ensure all imports use `src/lib/supabase.js`.
- If `src/js/supabase.js` is used by the legacy `deployment-tracker.js`, migrate that code to use the proper client.

---

## LOW — Query Parameter Passthrough Without Encoding in Proxy

**Severity: LOW**
**Files affected:** `netlify/functions/stratus-api-proxy.js:48-63`

**Description:** Query parameters from the incoming request are passed through to the upstream URL without proper encoding:

```js
queryParams.push(`${key}=${value}`);
// ...
stratusUrl += (endpoint.includes('?') ? '&' : '?') + queryParams.join('&');
```

**Risk:** Values are not URL-encoded, which could allow parameter injection or URL manipulation in edge cases.

**Recommendation:**
- Use `encodeURIComponent(key)` and `encodeURIComponent(value)` when building query parameters, or use the `URLSearchParams` API.

---

## LOW — `Math.random()` Used for File Path Generation

**Severity: LOW**
**Files affected:** `src/services/unifiedDocumentService.js:82`

```js
const fileName = `.../${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
```

**Risk:** `Math.random()` is not cryptographically secure. While this is used for file naming (not security tokens), collisions or predictable names could potentially allow file overwrites.

**Recommendation:**
- Use `crypto.randomUUID()` or `crypto.getRandomValues()` for generating unique file identifiers.

---

## Summary Table

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | Hardcoded StratusDX credentials in source code (3 sets) | CRITICAL | Secrets Management |
| 2 | Wildcard CORS on all serverless functions | HIGH | Access Control |
| 3 | No authentication on Stratus API proxy & explorer | HIGH | Authentication |
| 4 | Raw REST query construction in Netlify functions | HIGH | Injection |
| 5 | Impersonation audit logging is console-only (no persistence) | HIGH | Audit & Accountability |
| 6 | Client-side-only authorization for impersonation | MEDIUM | Authorization |
| 7 | Silent role downgrade on profile fetch failure | MEDIUM | Error Handling |
| 8 | Search term injection in PostgREST filter strings | MEDIUM | Injection |
| 9 | HTML injection in email templates | MEDIUM | Injection |
| 10 | Excessive console logging of sensitive data | MEDIUM | Information Disclosure |
| 11 | No file type/size validation on document upload | MEDIUM | Input Validation |
| 12 | 3-hour idle timeout (compliance concern) | MEDIUM | Session Management |
| 13 | Duplicate Supabase client (one without PKCE) | LOW | Configuration |
| 14 | Unencoded query parameter passthrough in proxy | LOW | Input Validation |
| 15 | `Math.random()` for file path uniqueness | LOW | Cryptography |

---

---

## MEDIUM — Missing Security Headers in Netlify Configuration

**Severity: MEDIUM**
**Files affected:** `netlify.toml`

**Description:** The Netlify configuration has no security headers defined. The current config only specifies build settings:

```toml
[build]
publish = "dist"
command = "npx vite build"
```

**Missing headers:**
- `Content-Security-Policy` — no XSS mitigation
- `X-Frame-Options` — no clickjacking protection
- `X-Content-Type-Options` — no MIME sniffing protection
- `Strict-Transport-Security` — no HSTS enforcement
- `Referrer-Policy` — no referrer leakage control
- `Permissions-Policy` — no browser feature restrictions

**Recommendation:** Add the following to `netlify.toml`:

```toml
[[headers]]
for = "/*"
[headers.values]
  Content-Security-Policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none';"
  X-Frame-Options = "DENY"
  X-Content-Type-Options = "nosniff"
  Strict-Transport-Security = "max-age=31536000; includeSubDomains"
  Referrer-Policy = "strict-origin-when-cross-origin"
  Permissions-Policy = "geolocation=(), microphone=(), camera=()"
```

---

## Performance Issues

### N+1 Query Patterns

**Severity: MEDIUM**
**Files affected:**
- `src/services/supportService.js` — `getTicketById()` runs 4 sequential queries (ticket, org, site, assignee) instead of 1 join
- `src/services/usersService.js` — `getAll()` fetches users then runs separate assignments query and maps
- `src/services/organizationsService.js` — `getWithStats()` uses `Promise.all(orgs.map(...))` — 2 queries per organization (100 orgs = 200+ queries)

**Recommendation:** Use Supabase's relation embedding (`.select('*, organization(*)')`) to fetch related data in single queries.

### Missing Pagination on Large Datasets

**Severity: MEDIUM**
**Files affected:**
- `src/services/facilitiesService.js:4-42` — `getAll()` fetches entire table with all relations (milestones, equipment, contacts, personnel), no limit
- `src/services/labOrdersService.js:4-26` — `getOrders()` returns all lab orders, no pagination
- `src/services/organizationsService.js:4-12` — `getAll()` has no pagination

**Recommendation:** Add `.range(offset, offset + limit)` to all list queries. Implement cursor-based or offset pagination in the UI.

### Broad Column Selection

**Severity: LOW**
**Files affected:** 37+ instances of `.select('*')` across services

**Recommendation:** Specify only needed columns (e.g., `.select('id, name, status, created_at')`) to reduce payload size and database load.

---

## Code Quality Issues

### Duplicate Component Implementations

**Severity: LOW**
**Files affected:**
- `src/components/facility-tabs/OverviewTab.jsx` (348 lines) vs `OverviewTabImproved.jsx` (379 lines)
- `src/components/facility-tabs/EquipmentTab.jsx` (615 lines) vs `EquipmentTabImproved.jsx` (608 lines)

**Description:** Two pairs of near-duplicate components exist. The "Improved" variants add features like debounced auto-save, compact mode, and bulk operations, but duplicate most of the original code.

**Recommendation:** Consolidate each pair into a single optimized component. Remove the unused variant.

### Oversized Monolithic Components

**Severity: LOW**
**Files affected:**
| Component | Lines |
|-----------|-------|
| `ProjectDetail.jsx` | 1,180 |
| `OrganizationDetail.jsx` | 1,179 |
| `StratusAPIViewer.jsx` | 1,111 |
| `MilestonesTab.jsx` | 993 |
| `FacilityDetail.jsx` | 974 |
| `PersonnelTrainingTab.jsx` | 794 |

**Recommendation:** Break components over 500 lines into focused sub-components (200-300 lines each). Extract form sections, filter bars, and list renderers.

### Missing React Performance Optimizations

**Severity: LOW**
**Files affected:** Most large components

**Description:** No use of `React.memo()`, `useMemo()`, or `useCallback()` in performance-sensitive components. Large components re-render entire subtrees on any state change.

**Recommendation:** Add `useMemo()` for expensive calculations (filtering, sorting), `useCallback()` for handlers passed to children, and `React.memo()` for pure child components.

### Missing Error Boundaries

**Severity: LOW**
**Files affected:** `src/tracker-app.jsx` and major feature pages

**Description:** No React error boundaries wrap the major feature pages. An uncaught rendering error in any component crashes the entire app.

**Recommendation:** Add `<ErrorBoundary>` wrappers to each top-level route component to contain failures and show user-friendly error states.

### Async Cleanup Issues

**Severity: LOW**
**Files affected:**
- `src/components/facility-tabs/EquipmentTab.jsx:44-55` — `loadEquipmentImages()` loop doesn't handle component unmount during fetch
- `src/hooks/useAutoSave.js:8-20` — Auto-save doesn't prevent concurrent saves

**Recommendation:** Use `AbortController` for fetch cleanup on unmount. Add debounce guards to prevent concurrent auto-save operations.

---

## Updated Summary Table

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | Hardcoded StratusDX credentials in source code (3 sets) | CRITICAL | Secrets Management |
| 2 | Wildcard CORS on all serverless functions | HIGH | Access Control |
| 3 | No authentication on Stratus API proxy & explorer | HIGH | Authentication |
| 4 | Raw REST query construction in Netlify functions | HIGH | Injection |
| 5 | Impersonation audit logging is console-only (no persistence) | HIGH | Audit & Accountability |
| 6 | Client-side-only authorization for impersonation | MEDIUM | Authorization |
| 7 | Silent role downgrade on profile fetch failure | MEDIUM | Error Handling |
| 8 | Search term injection in PostgREST filter strings | MEDIUM | Injection |
| 9 | HTML injection in email templates | MEDIUM | Injection |
| 10 | Excessive console logging of sensitive data | MEDIUM | Information Disclosure |
| 11 | No file type/size validation on document upload | MEDIUM | Input Validation |
| 12 | 3-hour idle timeout (compliance concern) | MEDIUM | Session Management |
| 13 | Missing security headers (CSP, HSTS, X-Frame-Options, etc.) | MEDIUM | Configuration |
| 14 | N+1 query patterns in services | MEDIUM | Performance |
| 15 | Missing pagination on large dataset queries | MEDIUM | Performance |
| 16 | Duplicate Supabase client (one without PKCE) | LOW | Configuration |
| 17 | Unencoded query parameter passthrough in proxy | LOW | Input Validation |
| 18 | `Math.random()` for file path uniqueness | LOW | Cryptography |
| 19 | Duplicate component implementations | LOW | Code Quality |
| 20 | Oversized monolithic components (6 files > 900 lines) | LOW | Code Quality |
| 21 | Missing React performance optimizations | LOW | Performance |
| 22 | Missing error boundaries | LOW | Reliability |
| 23 | Async cleanup issues (no AbortController) | LOW | Reliability |
| 24 | Broad `.select('*')` queries (37+ instances) | LOW | Performance |

---

## Recommended Action Plan

### Phase 1: Critical Security (Week 1)
1. Rotate all hardcoded StratusDX credentials — consider them compromised
2. Move credentials to environment variables (Netlify dashboard / Supabase secrets)
3. Scrub credentials from git history (BFG Repo-Cleaner)
4. Add authentication to Stratus API proxy functions (JWT validation)
5. Add pre-commit secret scanning (`gitleaks` or `trufflehog`)

### Phase 2: High-Priority Fixes (Weeks 2-3)
6. Restrict CORS to known domains
7. Implement persistent impersonation audit logging
8. Add security headers to `netlify.toml`
9. Sanitize search terms before PostgREST filter interpolation
10. Add file upload validation (type allowlist, size limit, MIME check)
11. HTML-encode email template interpolations
12. Gate sensitive `console.log` behind `NODE_ENV` checks

### Phase 3: Performance & Reliability (Weeks 4-5)
13. Add pagination to facilities, lab orders, and organizations queries
14. Fix N+1 queries with Supabase relation embedding
15. Reduce idle timeout to 30-60 minutes
16. Remove duplicate Supabase client (`src/js/supabase.js`)
17. Add error boundaries to major route components
18. Specify columns in `.select()` calls

### Phase 4: Code Quality (Weeks 6-8)
19. Consolidate duplicate tab components
20. Break 1000+ line components into sub-components
21. Add `React.memo()`, `useMemo()`, `useCallback()` optimizations
22. Add `AbortController` cleanup to async effects
23. Remove or gate `explore-stratus-api` function from production

---

## Additional Findings from Deep-Dive Audit

### MEDIUM — No Rate Limiting on Netlify Functions

**Severity: MEDIUM**
**Files affected:** All 6 Netlify functions

**Description:** No rate limiting is implemented on any serverless function endpoint. Functions like `sync-stratus-orders.js` could be called repeatedly to hammer the StratusDX API or exhaust Supabase quotas.

**Recommendation:** Implement rate limiting via Netlify's built-in features or add a token-bucket check at the function level.

### MEDIUM — Missing Email & Role Validation in Invitation Function

**Severity: MEDIUM**
**Files affected:** `netlify/functions/send-invitation-email.js:24-31`

**Description:** The invitation email function only checks for field existence (`if (!email || !role || !inviteUrl)`). It does not validate:
- Email format (RFC 5322 — accepts `admin@`, `test@..`, unicode strings)
- Role against an allowlist of valid roles
- `inviteUrl` against the expected domain (could redirect to a phishing site)
- `expiresAt` (could be a past date)

**Recommendation:**
1. Validate email with a regex (e.g., `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
2. Whitelist roles: `['Proximity Admin', 'Proximity Staff', 'Customer Admin', 'Customer User']`
3. Validate `inviteUrl` starts with your known domain
4. Check `expiresAt` is a future timestamp

### MEDIUM — Error Details Leaked to Clients

**Severity: MEDIUM**
**Files affected:**
- `netlify/functions/send-invitation-email.js:194-196`
- `netlify/functions/sync-stratus-orders.js:237-239`
- `netlify/functions/sync-stratus-confirmations.js:239-241`
- `netlify/functions/sync-stratus-results.js:239-241`

**Description:** Catch blocks return `error.message` directly to the client:

```js
return {
  statusCode: 500,
  body: JSON.stringify({
    error: 'Failed to send invitation email',
    details: error.message,  // Leaks internal details
  }),
};
```

**Risk:** Exposes internal system details, database error messages, and API paths to callers.

**Recommendation:** Log full errors server-side; return generic error messages to clients.

### LOW — Missing Database Indexes on Lab Tables

**Severity: LOW**
**Files affected:** `supabase/migrations/20260205072740_create_lab_integration_tables.sql`

**Description:** The `lab_order_confirmations` and `lab_results` tables lack `created_at DESC` indexes. The `lab_orders` table has one (`idx_lab_orders_created_at`), but the related tables do not.

**Recommendation:**
```sql
CREATE INDEX idx_lab_confirmations_created_at ON lab_order_confirmations(created_at DESC);
CREATE INDEX idx_lab_results_created_at ON lab_results(created_at DESC);
```

Also consider composite indexes for common filter combinations like `(organization_id, status)` and `(facility_id, created_at DESC)`.

---

## Final Summary Table

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | Hardcoded StratusDX credentials in source code (3 sets) | CRITICAL | Secrets Management |
| 2 | Wildcard CORS on all serverless functions | HIGH | Access Control |
| 3 | No authentication on Stratus API proxy & explorer | HIGH | Authentication |
| 4 | Raw REST query construction in Netlify functions | HIGH | Injection |
| 5 | Impersonation audit logging is console-only (no persistence) | HIGH | Audit & Accountability |
| 6 | Client-side-only authorization for impersonation | MEDIUM | Authorization |
| 7 | Silent role downgrade on profile fetch failure | MEDIUM | Error Handling |
| 8 | Search term injection in PostgREST filter strings | MEDIUM | Injection |
| 9 | HTML injection in email templates | MEDIUM | Injection |
| 10 | Excessive console logging of sensitive data | MEDIUM | Information Disclosure |
| 11 | No file type/size validation on document upload | MEDIUM | Input Validation |
| 12 | 3-hour idle timeout (compliance concern) | MEDIUM | Session Management |
| 13 | Missing security headers (CSP, HSTS, X-Frame-Options, etc.) | MEDIUM | Configuration |
| 14 | N+1 query patterns in services | MEDIUM | Performance |
| 15 | Missing pagination on large dataset queries | MEDIUM | Performance |
| 16 | No rate limiting on Netlify functions | MEDIUM | Access Control |
| 17 | Missing email/role validation in invitation function | MEDIUM | Input Validation |
| 18 | Error details leaked to clients in function responses | MEDIUM | Information Disclosure |
| 19 | Duplicate Supabase client (one without PKCE) | LOW | Configuration |
| 20 | Unencoded query parameter passthrough in proxy | LOW | Input Validation |
| 21 | `Math.random()` for file path uniqueness | LOW | Cryptography |
| 22 | Duplicate component implementations | LOW | Code Quality |
| 23 | Oversized monolithic components (6 files > 900 lines) | LOW | Code Quality |
| 24 | Missing React performance optimizations | LOW | Performance |
| 25 | Missing error boundaries | LOW | Reliability |
| 26 | Async cleanup issues (no AbortController) | LOW | Reliability |
| 27 | Broad `.select('*')` queries (37+ instances) | LOW | Performance |
| 28 | Missing database indexes on lab tables | LOW | Performance |

---

## Positive Security Observations

- **PKCE auth flow** is properly configured in the primary Supabase client
- **Microsoft OAuth (Azure AD)** for SSO — no password management needed
- **escapeHtml()** is used in `deployment-tracker.js` when rendering notifications with `innerHTML`
- **RLS enabled on all 30+ tables** with 739 policy statements across 92 migrations
- **Proper cascading deletes** — 19 tables use `ON DELETE CASCADE`, 8 use `ON DELETE SET NULL`
- **182 database indexes** across migrations for foreign keys and frequently queried columns
- **Signed URLs** for document access with 1-hour expiry — good practice
- **Idle timeout** exists (even if generous) for session management
- **Authorization token forwarding** in sync functions ensures Supabase RLS applies to data operations
- **Retry logic with exponential backoff** in `stratus-api-proxy.js`
- **Recent migration removed public RLS policies** (20260203) — tightening access
