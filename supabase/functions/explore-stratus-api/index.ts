import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExplorationRequest {
  endpoint: string;
  method?: string;
  testParams?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const STRATUS_BASE_URL = Deno.env.get("STRATUS_API_BASE_URL");
    const STRATUS_USERNAME = Deno.env.get("STRATUS_API_USERNAME");
    const STRATUS_PASSWORD = Deno.env.get("STRATUS_API_PASSWORD");

    if (!STRATUS_BASE_URL || !STRATUS_USERNAME || !STRATUS_PASSWORD) {
      throw new Error("StratusDX API credentials not configured");
    }

    const authString = btoa(`${STRATUS_USERNAME}:${STRATUS_PASSWORD}`);
    const headers = {
      "Authorization": `Basic ${authString}`,
      "Content-Type": "application/json",
    };

    const { endpoint, method = "GET", testParams = {} }: ExplorationRequest = await req.json();

    console.log(`\n=== API Exploration ===`);
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Method: ${method}`);
    console.log(`Test Parameters:`, testParams);

    const results = [];

    // Helper function to fetch with retries
    const fetchWithRetry = async (url: string, fetchOptions: RequestInit, maxRetries = 3) => {
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
            console.log(`[RETRY] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError || new Error('Failed to connect after retries');
    };

    // Test 1: Base request (no parameters)
    console.log("\n--- Test 1: Base Request (No Parameters) ---");
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
      console.log(`Status: ${baseResponse.status}`);
      console.log(`Response keys:`, Object.keys(baseData));
    } catch (error) {
      results.push({
        test: "Base Request",
        error: error.message,
      });
    }

    // Test 2: Try common pagination parameters
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
      console.log(`\n--- Testing: ${paramName} ---`);

      try {
        const queryString = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString();

        const testUrl = `${STRATUS_BASE_URL}${endpoint}?${queryString}`;

        const testResponse = await fetchWithRetry(testUrl, {
          method,
          headers,
        });

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

        console.log(`Status: ${testResponse.status}`);
        console.log(`Result count: ${testData.result_count || testData.results?.length || 'unknown'}`);
        console.log(`Total count: ${testData.total_count || 'unknown'}`);
      } catch (error) {
        results.push({
          test: `Pagination: ${paramName}`,
          params,
          error: error.message,
        });
        console.log(`Error: ${error.message}`);
      }
    }

    // Test 3: OPTIONS request to discover supported methods
    console.log("\n--- Test: OPTIONS Request ---");
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
      console.log(`Allowed methods: ${optionsResponse.headers.get("Allow")}`);
    } catch (error) {
      results.push({
        test: "OPTIONS Request",
        error: error.message,
      });
    }

    // Test 4: Custom parameters if provided
    if (Object.keys(testParams).length > 0) {
      console.log("\n--- Test: Custom Parameters ---");
      try {
        const queryString = new URLSearchParams(
          Object.entries(testParams).map(([k, v]) => [k, String(v)])
        ).toString();

        const customUrl = `${STRATUS_BASE_URL}${endpoint}?${queryString}`;

        const customResponse = await fetchWithRetry(customUrl, {
          method,
          headers,
        });

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
        console.log(`Status: ${customResponse.status}`);
      } catch (error) {
        results.push({
          test: "Custom Parameters",
          error: error.message,
        });
      }
    }

    console.log("\n=== Exploration Complete ===");

    return new Response(
      JSON.stringify({
        success: true,
        endpoint,
        total_tests: results.length,
        results,
        recommendations: generateRecommendations(results),
      }, null, 2),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Exploration error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
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

function generateRecommendations(results: any[]): string[] {
  const recommendations = [];

  const successfulTests = results.filter(r => r.success);
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
