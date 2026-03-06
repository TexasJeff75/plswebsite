const STRATUS_BASE_URL = process.env.STRATUS_BASE_URL || "https://testapi.stratusdx.net/interface";
const STRATUS_USERNAME = process.env.STRATUS_PROXY_USERNAME;
const STRATUS_PASSWORD = process.env.STRATUS_PROXY_PASSWORD;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://proximitylabservices.com';

// Whitelist of allowed API path prefixes
const ALLOWED_ENDPOINTS = ['/orders', '/order/', '/results', '/result/'];

exports.handler = async (event, context) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const corsOrigin = ALLOWED_ORIGIN === '*' ? '*' : (origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN);
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Require authentication
  const userToken = event.headers.authorization || event.headers.Authorization;
  if (!userToken) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authorization required' }),
    };
  }

  if (!STRATUS_USERNAME || !STRATUS_PASSWORD) {
    console.error('StratusDX credentials not configured in environment variables');
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Service not configured' }),
    };
  }

  try {
    const endpoint = event.queryStringParameters?.endpoint;

    if (!endpoint) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'endpoint parameter is required' }),
      };
    }

    // Validate endpoint against whitelist to prevent SSRF
    const isAllowed = ALLOWED_ENDPOINTS.some(prefix => endpoint.startsWith(prefix));
    if (!isAllowed) {
      return {
        statusCode: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Endpoint not allowed' }),
      };
    }

    const basicAuth = Buffer.from(`${STRATUS_USERNAME}:${STRATUS_PASSWORD}`).toString('base64');

    const stratusHeaders = {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    };

    let stratusUrl = `${STRATUS_BASE_URL}${endpoint}`;

    const params = new URLSearchParams();

    if (event.queryStringParameters) {
      for (const [key, value] of Object.entries(event.queryStringParameters)) {
        if (key !== 'endpoint') {
          if (key === 'limit') {
            params.set('max', value);
          } else {
            params.set(key, value);
          }
        }
      }
    }

    const paramString = params.toString();
    if (paramString) {
      stratusUrl += (endpoint.includes('?') ? '&' : '?') + paramString;
    }

    const maxRetries = 3;
    let lastError = null;
    let response = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const fetchOptions = {
          method: event.httpMethod,
          headers: stratusHeaders,
          signal: controller.signal,
        };
        if (event.httpMethod === 'POST' && event.body) {
          fetchOptions.body = event.body;
        }

        response = await fetch(stratusUrl, fetchOptions);

        clearTimeout(timeoutId);
        break;
      } catch (fetchError) {
        lastError = fetchError;

        if (attempt < maxRetries) {
          const delay = attempt * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to connect after retries');
    }

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType || 'application/json',
      },
      body: typeof data === 'string' ? data : JSON.stringify(data),
    };

  } catch (error) {
    console.error("Error proxying request:", error);

    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: "Failed to proxy request",
      }),
    };
  }
};
