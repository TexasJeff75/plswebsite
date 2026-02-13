import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRATUS_BASE_URL = "https://testapi.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_11";
const STRATUS_PASSWORD = "9b910d57-49cb";

interface StratusOrdersResponse {
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

    console.log("Fetching pending orders from StratusDX...");
    console.log("Note: StratusDX API returns max 5 orders per request. Processing in batches.");

    const processedOrders = [];
    const errors = [];
    let totalProcessed = 0;
    let batchNumber = 0;
    let continueProcessing = true;
    const MAX_BATCHES = 20;

    while (continueProcessing && batchNumber < MAX_BATCHES) {
      batchNumber++;
      console.log(`\n=== Processing Batch ${batchNumber} (max 5 orders per batch) ===`);

      const listResponse = await fetch(`${STRATUS_BASE_URL}/orders`, {
        method: "GET",
        headers,
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to fetch orders: ${listResponse.statusText}`);
      }

      const ordersData: StratusOrdersResponse = await listResponse.json();
      console.log(`Batch ${batchNumber}: Found ${ordersData.result_count} pending orders (Total in queue: ${ordersData.total_count})`);

      if (!ordersData.results || ordersData.results.length === 0) {
        console.log("No more orders to process");
        continueProcessing = false;
        break;
      }

      for (const guid of ordersData.results) {
      try {
        const { data: existing } = await supabaseClient
          .from('lab_orders')
          .select('id, sync_status, organization_id, facility_id')
          .eq('stratus_guid', guid)
          .maybeSingle();

        if (existing && existing.sync_status === 'acknowledged') {
          console.log(`Order ${guid} already acknowledged locally, re-ACKing on StratusDX to clear queue`);
          try {
            const reAckResponse = await fetch(`${STRATUS_BASE_URL}/order/${guid}/ack`, {
              method: "POST",
              headers,
            });
            if (reAckResponse.ok) {
              console.log(`Re-ACK successful for ${guid}`);
              processedOrders.push({ guid, status: 're-acknowledged', batch: batchNumber });
              totalProcessed++;
            } else {
              console.error(`Re-ACK failed for ${guid}: ${reAckResponse.statusText}`);
              errors.push({ guid, error: `Re-ACK failed: ${reAckResponse.statusText}` });
            }
          } catch (reAckErr) {
            console.error(`Re-ACK error for ${guid}: ${reAckErr.message}`);
            errors.push({ guid, error: `Re-ACK error: ${reAckErr.message}` });
          }
          continue;
        }

        console.log(`Retrieving order details for ${guid}...`);
        const detailResponse = await fetch(`${STRATUS_BASE_URL}/order/${guid}`, {
          method: "GET",
          headers,
        });

        if (!detailResponse.ok) {
          throw new Error(`Failed to fetch order ${guid}: ${detailResponse.statusText}`);
        }

        const orderData = await detailResponse.json();
        console.log(`Retrieved order ${guid}`);

        let organizationId = existing?.organization_id;
        let facilityId = existing?.facility_id;

        if (!organizationId) {
          const facilityIdentifier = orderData.facility_name || orderData.facility_id || '';
          const orgIdentifier = orderData.organization_name || orderData.organization_id || '';

          if (facilityIdentifier) {
            const { data: mapping } = await supabaseClient
              .rpc('find_stratus_facility_mapping', {
                p_facility_identifier: facilityIdentifier,
                p_organization_identifier: orgIdentifier || null,
              });

            if (mapping && mapping.length > 0) {
              organizationId = mapping[0].organization_id;
              facilityId = mapping[0].facility_id;
              console.log(`Mapped to org: ${organizationId}, facility: ${facilityId}`);

              await supabaseClient
                .from('stratus_facility_mappings')
                .update({
                  last_matched_at: new Date().toISOString(),
                  match_count: supabaseClient.raw('match_count + 1'),
                })
                .eq('id', mapping[0].mapping_id);
            }
          }
        }

        const { error: upsertError } = await supabaseClient
          .from('lab_orders')
          .upsert({
            stratus_guid: guid,
            organization_id: organizationId,
            facility_id: facilityId,
            order_data: orderData,
            sync_status: 'retrieved',
            retrieved_at: new Date().toISOString(),
          }, {
            onConflict: 'stratus_guid',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`Error upserting order ${guid}:`, upsertError);
          errors.push({ guid, error: upsertError.message });
          continue;
        }

        console.log(`Acknowledging order ${guid}...`);
        const ackResponse = await fetch(`${STRATUS_BASE_URL}/order/${guid}/ack`, {
          method: "POST",
          headers,
        });

        if (!ackResponse.ok) {
          console.error(`Failed to ACK order ${guid}: ${ackResponse.statusText}`);
          errors.push({ guid, error: `Failed to ACK: ${ackResponse.statusText}` });
          continue;
        }

        const ackData: StratusAckResponse = await ackResponse.json();
        console.log(`Acknowledged order ${guid}: ${ackData.message}`);

        await supabaseClient
          .from('lab_orders')
          .update({
            sync_status: 'acknowledged',
            acknowledged_at: new Date().toISOString(),
          })
          .eq('stratus_guid', guid);

        processedOrders.push({ guid, status: 'success', batch: batchNumber });
        totalProcessed++;

      } catch (error) {
        console.error(`Error processing order ${guid}:`, error);
        errors.push({ guid, error: error.message, batch: batchNumber });

        await supabaseClient
          .from('lab_orders')
          .update({
            sync_status: 'error',
            sync_error: error.message,
          })
          .eq('stratus_guid', guid);
      }
    }

    console.log(`Batch ${batchNumber} complete. Processed: ${ordersData.results.length}`);

    if (ordersData.results.length >= ordersData.total_count) {
      continueProcessing = false;
    } else {
      console.log(`More orders available in queue. Fetching next batch...`);
    }
  }

  console.log(`\n=== Sync Complete ===`);
    console.log(`Total batches: ${batchNumber}`);
    console.log(`Total processed: ${totalProcessed}`);
    console.log(`Total errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order sync completed",
        summary: {
          batches: batchNumber,
          total_processed: totalProcessed,
          successful: processedOrders.length,
          errors: errors.length,
        },
        processedOrders,
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
    console.error("Error syncing orders:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to sync orders",
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
