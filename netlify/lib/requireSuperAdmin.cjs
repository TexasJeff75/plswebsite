// Checks that a Netlify function request comes from a signed-in Super Admin.
// The caller sends its Supabase session token as "Authorization: Bearer <token>".
// We ask Supabase, as that user, whether is_super_admin() is true. The public
// anon key, an expired token or any other user gets a refusal.
//
// Returns { ok: true, token } or { ok: false, status, error }.
async function requireSuperAdmin(event) {
  const header = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return { ok: false, status: 401, error: 'Please sign in again.' };

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, status: 500, error: 'Supabase settings are missing on the server.' };

  let response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/is_super_admin`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${match[1]}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch (err) {
    return { ok: false, status: 502, error: `Could not check your access: ${err.message}` };
  }
  if (response.status === 401) return { ok: false, status: 401, error: 'Please sign in again.' };
  if (!response.ok) return { ok: false, status: 502, error: `Could not check your access (${response.status}).` };

  const isSuperAdmin = await response.json().catch(() => false);
  if (isSuperAdmin !== true) return { ok: false, status: 403, error: 'Only Super Admins can use the StratusDX import.' };
  return { ok: true, token: match[1] };
}

module.exports = { requireSuperAdmin };
