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

    const basicAuth = btoa(`${STRATUS_USERNAME}:${STRATUS_PASSWORD}`);
    const headers = {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    };

    const stratusUrl = `${STRATUS_BASE_URL}${endpoint}`;
    console.log(`[AUTH OK] User: ${user.email} (${user.id})`);
    console.log(`[REQUEST] ${req.method} ${stratusUrl}`);
    console.log(`[CREDENTIALS] Username: ${STRATUS_USERNAME}, Password: ${STRATUS_PASSWORD.substring(0, 8)}...`);
    console.log(`[AUTH HEADER] Basic ${basicAuth}`);

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
