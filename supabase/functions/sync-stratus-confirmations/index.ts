import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRATUS_BASE_URL = "https://testapi.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_13";
const STRATUS_PASSWORD = "be917642-d7c6";

const MAX_BATCHES = 50;
const CONCURRENT_LIMIT = 3;
const RETRY_DELAY_MS = 1000;

interface StratusConfirmationsResponse {
  status: string;
  total_count: number;
  result_count: number;
  results: string[];
}

interface StratusAckResponse {
  status: string;
  id: string;
  message: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processConfirmationWithRetry(
  guid: string,
  supabaseClient: any,
  headers: any,
  retries = 2
): Promise<{ guid: string; status: string; accessionNumber?: string; error?: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data: existing } = await supabaseClient
        .from('lab_order_confirmations')
        .select('id, sync_status, organization_id, facility_id')
        .eq('stratus_guid', guid)
        .maybeSingle();

      if (existing && existing.sync_status === 'acknowledged') {
        console.log(`Confirmation ${guid} already acknowledged, re-ACKing to clear queue`);
        const reAckResponse = await fetch(`${STRATUS_BASE_URL}/order/received/${guid}/ack`, {
          method: "POST",
          headers,
        });

        if (reAckResponse.ok) {
          return { guid, status: 're-acknowledged' };
        }
        throw new Error(`Re-ACK failed: ${reAckResponse.statusText}`);
      }

      console.log(`[${guid}] Retrieving confirmation details...`);
      const detailResponse = await fetch(`${STRATUS_BASE_URL}/order/received/${guid}`, {
        method: "GET",
        headers,
      });

      if (!detailResponse.ok) {
        throw new Error(`Failed to fetch confirmation: ${detailResponse.statusText}`);
      }

      const confirmationText = await detailResponse.text();

      const receivedTimeMatch = confirmationText.match(/Received Time:(\d+)/);
      const accessionMatch = confirmationText.match(/Accession:(\d+)/);
      const hl7Match = confirmationText.match(/(MSH\|.*)/s);

      const receivedTime = receivedTimeMatch ? receivedTimeMatch[1] : null;
      const accessionNumber = accessionMatch ? accessionMatch[1] : null;
      const hl7Message = hl7Match ? hl7Match[1] : confirmationText;

      let labOrderId = null;
      let organizationId = existing?.organization_id;
      let facilityId = existing?.facility_id;

      if (accessionNumber) {
        const { data: linkedOrder } = await supabaseClient
          .from('lab_orders')
          .select('id, organization_id, facility_id')
          .eq('accession_number', accessionNumber)
          .maybeSingle();

        if (linkedOrder) {
          labOrderId = linkedOrder.id;
          organizationId = organizationId || linkedOrder.organization_id;
          facilityId = facilityId || linkedOrder.facility_id;
        }
      }

      const { error: upsertError } = await supabaseClient
        .from('lab_order_confirmations')
        .upsert({
          stratus_guid: guid,
          lab_order_id: labOrderId,
          organization_id: organizationId,
          facility_id: facilityId,
          accession_number: accessionNumber,
          received_time: receivedTime,
          hl7_message: hl7Message,
          confirmation_data: { raw: confirmationText },
          sync_status: 'retrieved',
          retrieved_at: new Date().toISOString(),
        }, {
          onConflict: 'stratus_guid',
          ignoreDuplicates: false
        });

      if (upsertError) {
        throw new Error(`Upsert failed: ${upsertError.message}`);
      }

      console.log(`[${guid}] Acknowledging confirmation...`);
      const ackResponse = await fetch(`${STRATUS_BASE_URL}/order/received/${guid}/ack`, {
        method: "POST",
        headers,
      });

      if (!ackResponse.ok) {
        throw new Error(`Failed to ACK: ${ackResponse.statusText}`);
      }

      await supabaseClient
        .from('lab_order_confirmations')
        .update({
          sync_status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('stratus_guid', guid);

      console.log(`[${guid}] ✓ Successfully processed`);
      return { guid, accessionNumber: accessionNumber || undefined, status: 'success' };

    } catch (error) {
      console.error(`[${guid}] Attempt ${attempt + 1}/${retries + 1} failed:`, error.message);

      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      await supabaseClient
        .from('lab_order_confirmations')
        .upsert({
          stratus_guid: guid,
          sync_status: 'error',
          sync_error: error.message,
        }, {
          onConflict: 'stratus_guid',
          ignoreDuplicates: false
        });

      return { guid, status: 'error', error: error.message };
    }
  }

  return { guid, status: 'error', error: 'Max retries exceeded' };
}

async function processBatchConcurrently(
  guids: string[],
  supabaseClient: any,
  headers: any
): Promise<any[]> {
  const results = [];

  for (let i = 0; i < guids.length; i += CONCURRENT_LIMIT) {
    const chunk = guids.slice(i, i + CONCURRENT_LIMIT);
    const chunkResults = await Promise.all(
      chunk.map(guid => processConfirmationWithRetry(guid, supabaseClient, headers))
    );
    results.push(...chunkResults);

    if (i + CONCURRENT_LIMIT < guids.length) {
      await sleep(500);
    }
  }

  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const basicAuth = btoa(`${STRATUS_USERNAME}:${STRATUS_PASSWORD}`);
    const headers = {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    };

    console.log("=== StratusDX Confirmations Sync Started ===");
    console.log(`Max batches: ${MAX_BATCHES} | Concurrent: ${CONCURRENT_LIMIT}`);

    const allResults = [];
    let batchNumber = 0;
    let totalProcessed = 0;
    let continueProcessing = true;

    while (continueProcessing && batchNumber < MAX_BATCHES) {
      batchNumber++;
      console.log(`\n--- Batch ${batchNumber} ---`);

      const listResponse = await fetch(`${STRATUS_BASE_URL}/order/received`, {
        method: "GET",
        headers,
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to fetch confirmations: ${listResponse.statusText}`);
      }

      const confirmationsData: StratusConfirmationsResponse = await listResponse.json();
      console.log(`Queue status: ${confirmationsData.result_count} retrieved | ${confirmationsData.total_count} total in queue`);

      if (!confirmationsData.results || confirmationsData.results.length === 0) {
        console.log("Queue empty, stopping");
        continueProcessing = false;
        break;
      }

      const batchResults = await processBatchConcurrently(
        confirmationsData.results,
        supabaseClient,
        headers
      );

      allResults.push(...batchResults);
      totalProcessed += batchResults.length;

      const successCount = batchResults.filter(r => r.status === 'success' || r.status === 're-acknowledged').length;
      const errorCount = batchResults.filter(r => r.status === 'error').length;
      console.log(`Batch ${batchNumber} complete: ${successCount} success, ${errorCount} errors`);

      if (confirmationsData.result_count >= confirmationsData.total_count) {
        console.log("All confirmations processed");
        continueProcessing = false;
      }

      await sleep(1000);
    }

    const successful = allResults.filter(r => r.status === 'success' || r.status === 're-acknowledged');
    const errors = allResults.filter(r => r.status === 'error');

    console.log("\n=== Sync Complete ===");
    console.log(`Batches: ${batchNumber} | Processed: ${totalProcessed}`);
    console.log(`Success: ${successful.length} | Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Confirmation sync completed",
        summary: {
          batches: batchNumber,
          total_processed: totalProcessed,
          successful: successful.length,
          errors: errors.length,
        },
        results: allResults,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Fatal error syncing confirmations:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to sync confirmations",
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
