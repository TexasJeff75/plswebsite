const STRATUS_BASE_URL = "https://testapi.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_11";
const STRATUS_PASSWORD = "9b910d57-49cb";

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const endpoint = event.queryStringParameters?.endpoint;
    const limit = event.queryStringParameters?.limit;
    const offset = event.queryStringParameters?.offset;

    if (!endpoint) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'endpoint parameter is required' }),
      };
    }

    const basicAuth = Buffer.from(`${STRATUS_USERNAME}:${STRATUS_PASSWORD}`).toString('base64');

    const stratusHeaders = {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    };

    let stratusUrl = `${STRATUS_BASE_URL}${endpoint}`;

    const queryParams = [];
    if (limit) queryParams.push(`limit=${limit}`);
    if (offset) queryParams.push(`offset=${offset}`);
    if (queryParams.length > 0) {
      stratusUrl += (endpoint.includes('?') ? '&' : '?') + queryParams.join('&');
    }
    console.log(`[REQUEST] GET ${stratusUrl}`);

    const maxRetries = 3;
    let lastError = null;
    let response = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ATTEMPT ${attempt}/${maxRetries}] Fetching...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        response = await fetch(stratusUrl, {
          method: "GET",
          headers: stratusHeaders,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log(`[SUCCESS] Connected on attempt ${attempt}`);
        break;
      } catch (fetchError) {
        lastError = fetchError;
        console.error(`[ATTEMPT ${attempt} FAILED] ${fetchError.message}`);

        if (attempt < maxRetries) {
          const delay = attempt * 1000;
          console.log(`[RETRY] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to connect after retries');
    }

    console.log(`[RESPONSE] Status: ${response.status} ${response.statusText}`);

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log(`[DATA] JSON Response received`);
    } else {
      data = await response.text();
      console.log(`[DATA] Text Response (${data.length} chars)`);
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
        details: error.message,
      }),
    };
  }
};
