import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRATUS_BASE_URL = "https://novagen.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_13";
const STRATUS_PASSWORD = "be917642-d7c6";

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

    console.log("Fetching pending confirmations from StratusDX...");

    const listResponse = await fetch(`${STRATUS_BASE_URL}/order/received`, {
      method: "GET",
      headers,
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to fetch confirmations: ${listResponse.statusText}`);
    }

    const confirmationsData: StratusConfirmationsResponse = await listResponse.json();
    console.log(`Found ${confirmationsData.result_count} pending confirmations`);

    const processedConfirmations = [];
    const errors = [];

    for (const guid of confirmationsData.results) {
      try {
        const { data: existing } = await supabaseClient
          .from('lab_order_confirmations')
          .select('id, sync_status')
          .eq('stratus_guid', guid)
          .maybeSingle();

        if (existing && existing.sync_status === 'acknowledged') {
          console.log(`Confirmation ${guid} already acknowledged, skipping`);
          continue;
        }

        console.log(`Retrieving confirmation details for ${guid}...`);
        const detailResponse = await fetch(`${STRATUS_BASE_URL}/order/received/${guid}`, {
          method: "GET",
          headers,
        });

        if (!detailResponse.ok) {
          throw new Error(`Failed to fetch confirmation ${guid}: ${detailResponse.statusText}`);
        }

        const confirmationText = await detailResponse.text();
        console.log(`Retrieved confirmation ${guid}`);

        const receivedTimeMatch = confirmationText.match(/Received Time:(\d+)/);
        const accessionMatch = confirmationText.match(/Accession:(\d+)/);
        const hl7Match = confirmationText.match(/(MSH\|.*)/s);

        const receivedTime = receivedTimeMatch ? receivedTimeMatch[1] : null;
        const accessionNumber = accessionMatch ? accessionMatch[1] : null;
        const hl7Message = hl7Match ? hl7Match[1] : confirmationText;

        let labOrderId = null;
        if (accessionNumber) {
          const { data: linkedOrder } = await supabaseClient
            .from('lab_orders')
            .select('id')
            .eq('accession_number', accessionNumber)
            .maybeSingle();

          if (linkedOrder) {
            labOrderId = linkedOrder.id;
          }
        }

        if (existing) {
          const { error: updateError } = await supabaseClient
            .from('lab_order_confirmations')
            .update({
              lab_order_id: labOrderId,
              accession_number: accessionNumber,
              received_time: receivedTime,
              hl7_message: hl7Message,
              confirmation_data: { raw: confirmationText },
              sync_status: 'retrieved',
              retrieved_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Error updating confirmation ${guid}:`, updateError);
            errors.push({ guid, error: updateError.message });
            continue;
          }
        } else {
          const { error: insertError } = await supabaseClient
            .from('lab_order_confirmations')
            .insert({
              stratus_guid: guid,
              lab_order_id: labOrderId,
              accession_number: accessionNumber,
              received_time: receivedTime,
              hl7_message: hl7Message,
              confirmation_data: { raw: confirmationText },
              sync_status: 'retrieved',
              retrieved_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error(`Error inserting confirmation ${guid}:`, insertError);
            errors.push({ guid, error: insertError.message });
            continue;
          }
        }

        console.log(`Acknowledging confirmation ${guid}...`);
        const ackResponse = await fetch(`${STRATUS_BASE_URL}/order/received/${guid}/ack`, {
          method: "POST",
          headers,
        });

        if (!ackResponse.ok) {
          console.error(`Failed to ACK confirmation ${guid}: ${ackResponse.statusText}`);
          errors.push({ guid, error: `Failed to ACK: ${ackResponse.statusText}` });
          continue;
        }

        const ackData: StratusAckResponse = await ackResponse.json();
        console.log(`Acknowledged confirmation ${guid}: ${ackData.message}`);

        await supabaseClient
          .from('lab_order_confirmations')
          .update({
            sync_status: 'acknowledged',
            acknowledged_at: new Date().toISOString(),
          })
          .eq('stratus_guid', guid);

        processedConfirmations.push({ guid, accessionNumber, status: 'success' });

      } catch (error) {
        console.error(`Error processing confirmation ${guid}:`, error);
        errors.push({ guid, error: error.message });

        await supabaseClient
          .from('lab_order_confirmations')
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
        message: "Confirmation sync completed",
        summary: {
          total: confirmationsData.result_count,
          processed: processedConfirmations.length,
          errors: errors.length,
        },
        processedConfirmations,
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
    console.error("Error syncing confirmations:", error);

    return new Response(
      JSON.stringify({
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
