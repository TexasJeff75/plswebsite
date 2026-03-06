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

## Positive Security Observations

- **PKCE auth flow** is properly configured in the primary Supabase client
- **Microsoft OAuth (Azure AD)** for SSO — no password management needed
- **escapeHtml()** is used in `deployment-tracker.js` when rendering notifications with `innerHTML`
- **Supabase RLS** is likely providing server-side enforcement (not visible in frontend code but architecture suggests it)
- **Signed URLs** for document access with 1-hour expiry — good practice
- **Idle timeout** exists (even if generous) for session management
- **Authorization token forwarding** in sync functions ensures Supabase RLS applies to data operations
