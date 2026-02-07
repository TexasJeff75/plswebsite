const STRATUS_BASE_URL = "https://novagen.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_11";
const STRATUS_PASSWORD = "9b910d57-49cb";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body, null, 2),
  };
}

async function fetchWithRetry(url, fetchOptions, maxRetries = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ATTEMPT ${attempt}/${maxRetries}] Fetching ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`[SUCCESS] Connected on attempt ${attempt}`);
      return response;
    } catch (error) {
      lastError = error;
      console.error(`[ATTEMPT ${attempt} FAILED] ${error.message}`);

      if (attempt < maxRetries) {
        const delay = attempt * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to connect after retries');
}

function generateRecommendations(results) {
  const recommendations = [];
  const baseTest = results.find(r => r.test === "Base Request");

  if (baseTest && baseTest.data) {
    const { result_count, total_count } = baseTest.data;
    if (total_count && result_count && total_count > result_count) {
      recommendations.push(`API has ${total_count} total items but only returns ${result_count} per request`);
    }
  }

  const workingPagination = results.filter(
    r => r.test?.startsWith("Pagination") && r.success && r.result_count !== 'unknown'
  );

  if (workingPagination.length > 0) {
    recommendations.push("Found working pagination parameters:");
    workingPagination.forEach(test => {
      recommendations.push(`  - ${JSON.stringify(test.params)} returned ${test.result_count} results`);
    });
  } else {
    recommendations.push("No pagination parameters worked - API likely uses queue-based system (ACK required)");
  }

  const optionsTest = results.find(r => r.test === "OPTIONS Request");
  if (optionsTest?.allowed_methods) {
    recommendations.push(`Supported HTTP methods: ${optionsTest.allowed_methods}`);
  }

  return recommendations;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return respond(405, { error: 'Method not allowed' });
  }

  try {
    let endpoint, method, testParams;

    if (event.httpMethod === 'POST' && event.body) {
      const body = JSON.parse(event.body);
      endpoint = body.endpoint;
      method = body.method || 'GET';
      testParams = body.testParams || {};
    } else {
      endpoint = event.queryStringParameters?.endpoint || '/orders';
      method = 'GET';
      testParams = {};
    }

    const basicAuth = Buffer.from(`${STRATUS_USERNAME}:${STRATUS_PASSWORD}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    };

    const results = [];

    console.log(`\n=== API Exploration ===`);
    console.log(`Endpoint: ${endpoint}`);

    try {
      const baseResponse = await fetchWithRetry(`${STRATUS_BASE_URL}${endpoint}`, {
        method,
        headers,
      });

      const contentType = baseResponse.headers.get('content-type');
      let baseData;
      if (contentType && contentType.includes('application/json')) {
        baseData = await baseResponse.json();
      } else {
        baseData = { text: await baseResponse.text() };
      }

      results.push({
        test: "Base Request",
        url: `${STRATUS_BASE_URL}${endpoint}`,
        status: baseResponse.status,
        success: baseResponse.ok,
        data: baseData,
        headers: Object.fromEntries(baseResponse.headers.entries()),
      });
    } catch (error) {
      results.push({ test: "Base Request", error: error.message });
    }

    const paginationParams = [
      { limit: 100 },
      { limit: 50 },
      { per_page: 100 },
      { count: 100 },
      { max: 100 },
      { page_size: 100 },
      { offset: 0, limit: 100 },
      { page: 1, per_page: 100 },
      { start: 0, end: 100 },
    ];

    for (const params of paginationParams) {
      const paramName = Object.keys(params).join('&');

      try {
        const queryString = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString();

        const testUrl = `${STRATUS_BASE_URL}${endpoint}?${queryString}`;

        const testResponse = await fetchWithRetry(testUrl, { method, headers });

        const contentType = testResponse.headers.get('content-type');
        let testData;
        if (contentType && contentType.includes('application/json')) {
          testData = await testResponse.json();
        } else {
          testData = { text: await testResponse.text() };
        }

        results.push({
          test: `Pagination: ${paramName}`,
          url: testUrl,
          params,
          status: testResponse.status,
          success: testResponse.ok,
          result_count: testData.result_count || testData.results?.length || 'unknown',
          total_count: testData.total_count || 'unknown',
          data_sample: {
            ...testData,
            results: testData.results?.length > 0 ? `[${testData.results.length} items]` : testData.results,
          },
        });
      } catch (error) {
        results.push({ test: `Pagination: ${paramName}`, params, error: error.message });
      }
    }

    try {
      const optionsResponse = await fetchWithRetry(`${STRATUS_BASE_URL}${endpoint}`, {
        method: "OPTIONS",
        headers,
      });

      results.push({
        test: "OPTIONS Request",
        status: optionsResponse.status,
        allowed_methods: optionsResponse.headers.get("Allow"),
        headers: Object.fromEntries(optionsResponse.headers.entries()),
      });
    } catch (error) {
      results.push({ test: "OPTIONS Request", error: error.message });
    }

    if (Object.keys(testParams).length > 0) {
      try {
        const queryString = new URLSearchParams(
          Object.entries(testParams).map(([k, v]) => [k, String(v)])
        ).toString();

        const customUrl = `${STRATUS_BASE_URL}${endpoint}?${queryString}`;

        const customResponse = await fetchWithRetry(customUrl, { method, headers });

        const contentType = customResponse.headers.get('content-type');
        let customData;
        if (contentType && contentType.includes('application/json')) {
          customData = await customResponse.json();
        } else {
          customData = { text: await customResponse.text() };
        }

        results.push({
          test: "Custom Parameters",
          url: customUrl,
          params: testParams,
          status: customResponse.status,
          success: customResponse.ok,
          data: customData,
        });
      } catch (error) {
        results.push({ test: "Custom Parameters", error: error.message });
      }
    }

    return respond(200, {
      success: true,
      endpoint,
      total_tests: results.length,
      results,
      recommendations: generateRecommendations(results),
    });

  } catch (error) {
    console.error("Exploration error:", error);
    return respond(500, { success: false, error: error.message });
  }
};
