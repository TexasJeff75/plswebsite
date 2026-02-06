import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.93.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRATUS_BASE_URL = "https://novagen.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_11";
const STRATUS_PASSWORD = "9b910d57-49cb";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getStratusToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    console.log('[TOKEN] Using cached token');
    return cachedToken.token;
  }

  console.log('[TOKEN] Fetching new token from StratusDX');

  const basicAuth = btoa(`${STRATUS_USERNAME}:${STRATUS_PASSWORD}`);
  const authUrl = `${STRATUS_BASE_URL}/auth/login`;

  console.log(`[AUTH] POST ${authUrl}`);
  console.log(`[AUTH] Basic ${basicAuth}`);

  const authResponse = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`[AUTH] Response: ${authResponse.status} ${authResponse.statusText}`);

  if (!authResponse.ok) {
    const errorText = await authResponse.text();
    console.error(`[AUTH] Failed to authenticate: ${errorText}`);
    throw new Error(`StratusDX authentication failed: ${authResponse.status} ${errorText}`);
  }

  const authData = await authResponse.json();
  console.log(`[AUTH] Success! Token data:`, authData);

  if (!authData.token && !authData.access_token && !authData.jwt) {
    console.error('[AUTH] No token found in response:', authData);
    throw new Error('No token received from StratusDX');
  }

  const token = authData.token || authData.access_token || authData.jwt;
  const expiresIn = authData.expires_in || authData.expiresIn || 3600;

  cachedToken = {
    token,
    expiresAt: Date.now() + (expiresIn * 1000) - 60000, // Refresh 1 minute before expiry
  };

  console.log(`[TOKEN] Cached new token, expires in ${expiresIn}s`);
  return token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || '';

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'endpoint parameter is required' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Get JWT token from StratusDX
    const stratusToken = await getStratusToken();

    const headers = {
      "Authorization": `Bearer ${stratusToken}`,
      "Content-Type": "application/json",
    };

    const stratusUrl = `${STRATUS_BASE_URL}${endpoint}`;
    console.log(`[AUTH OK] User: ${user.email} (${user.id})`);
    console.log(`[REQUEST] ${req.method} ${stratusUrl}`);
    console.log(`[AUTH HEADER] Bearer ${stratusToken.substring(0, 30)}...`);

    const response = await fetch(stratusUrl, {
      method: req.method,
      headers,
    });

    console.log(`[RESPONSE] Status: ${response.status} ${response.statusText}`);
    console.log(`[RESPONSE HEADERS]`, Object.fromEntries(response.headers.entries()));

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log(`[DATA] JSON Response:`, JSON.stringify(data, null, 2));
    } else {
      data = await response.text();
      console.log(`[DATA] Text Response (${data.length} chars):`, data.substring(0, 500));
    }

    if (!response.ok) {
      console.error(`[ERROR] StratusDX returned error status ${response.status}`);
      console.error(`[ERROR] Response body:`, data);
    }

    return new Response(
      typeof data === 'string' ? data : JSON.stringify(data),
      {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType || "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Error proxying request:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to proxy request",
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
