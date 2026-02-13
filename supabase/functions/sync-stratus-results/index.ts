import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRATUS_BASE_URL = "https://testapi.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_12";
const STRATUS_PASSWORD = "a9943167-93f1";

interface StratusResultsResponse {
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

    console.log("Fetching pending results from StratusDX...");

    const listResponse = await fetch(`${STRATUS_BASE_URL}/results`, {
      method: "GET",
      headers,
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to fetch results: ${listResponse.statusText}`);
    }

    const resultsData: StratusResultsResponse = await listResponse.json();
    console.log(`Found ${resultsData.result_count} pending results`);

    const processedResults = [];
    const errors = [];

    for (const guid of resultsData.results) {
      try {
        const { data: existing } = await supabaseClient
          .from('lab_results')
          .select('id, sync_status')
          .eq('stratus_guid', guid)
          .maybeSingle();

        if (existing && existing.sync_status === 'acknowledged') {
          console.log(`Result ${guid} already acknowledged locally, re-ACKing on StratusDX to clear queue`);
          try {
            const reAckResponse = await fetch(`${STRATUS_BASE_URL}/result/${guid}/ack`, {
              method: "POST",
              headers,
            });
            if (reAckResponse.ok) {
              console.log(`Re-ACK successful for result ${guid}`);
              processedResults.push({ guid, accessionNumber: null, status: 're-acknowledged' });
            } else {
              console.error(`Re-ACK failed for result ${guid}: ${reAckResponse.statusText}`);
              errors.push({ guid, error: `Re-ACK failed: ${reAckResponse.statusText}` });
            }
          } catch (reAckErr) {
            console.error(`Re-ACK error for result ${guid}: ${reAckErr.message}`);
            errors.push({ guid, error: `Re-ACK error: ${reAckErr.message}` });
          }
          continue;
        }

        console.log(`Retrieving result details for ${guid}...`);
        const detailResponse = await fetch(`${STRATUS_BASE_URL}/result/${guid}`, {
          method: "GET",
          headers,
        });

        if (!detailResponse.ok) {
          throw new Error(`Failed to fetch result ${guid}: ${detailResponse.statusText}`);
        }

        const resultText = await detailResponse.text();
        console.log(`Retrieved result ${guid}`);

        let resultData: any;
        try {
          resultData = JSON.parse(resultText);
        } catch {
          resultData = { raw: resultText };
        }

        const accessionMatch = guid.match(/^(\d+)-/);
        const accessionNumber = accessionMatch ? accessionMatch[1] : null;

        let labOrderId = null;
        let organizationId = existing?.organization_id;
        let facilityId = existing?.facility_id;

        if (accessionNumber) {
          const { data: linkedOrder } = await supabaseClient
            .from('lab_orders')
            .select('id, facility_id, organization_id')
            .eq('accession_number', accessionNumber)
            .maybeSingle();

          if (linkedOrder) {
            labOrderId = linkedOrder.id;
            organizationId = organizationId || linkedOrder.organization_id;
            facilityId = facilityId || linkedOrder.facility_id;
          }
        }

        const { error: upsertError } = await supabaseClient
          .from('lab_results')
          .upsert({
            stratus_guid: guid,
            lab_order_id: labOrderId,
            organization_id: organizationId,
            facility_id: facilityId,
            accession_number: accessionNumber,
            result_data: resultData,
            hl7_result: typeof resultData === 'string' ? resultData : null,
            sync_status: 'retrieved',
            retrieved_at: new Date().toISOString(),
            result_date: new Date().toISOString(),
          }, {
            onConflict: 'stratus_guid',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`Error upserting result ${guid}:`, upsertError);
          errors.push({ guid, error: upsertError.message });
          continue;
        }

        console.log(`Acknowledging result ${guid}...`);
        const ackResponse = await fetch(`${STRATUS_BASE_URL}/result/${guid}/ack`, {
          method: "POST",
          headers,
        });

        if (!ackResponse.ok) {
          console.error(`Failed to ACK result ${guid}: ${ackResponse.statusText}`);
          errors.push({ guid, error: `Failed to ACK: ${ackResponse.statusText}` });
          continue;
        }

        const ackData: StratusAckResponse = await ackResponse.json();
        console.log(`Acknowledged result ${guid}: ${ackData.message}`);

        await supabaseClient
          .from('lab_results')
          .update({
            sync_status: 'acknowledged',
            acknowledged_at: new Date().toISOString(),
          })
          .eq('stratus_guid', guid);

        processedResults.push({ guid, accessionNumber, status: 'success' });

      } catch (error) {
        console.error(`Error processing result ${guid}:`, error);
        errors.push({ guid, error: error.message });

        await supabaseClient
          .from('lab_results')
          .update({
            sync_status: 'error',
            sync_error: error.message,
          })
          .eq('stratus_guid', guid);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Results sync completed",
        summary: {
          total: resultsData.result_count,
          processed: processedResults.length,
          errors: errors.length,
        },
        processedResults,
        errors,
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
    console.error("Error syncing results:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to sync results",
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
