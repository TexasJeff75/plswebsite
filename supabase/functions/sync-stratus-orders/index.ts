import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRATUS_BASE_URL = "https://novagen.stratusdx.net/interface";
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

    const listResponse = await fetch(`${STRATUS_BASE_URL}/orders`, {
      method: "GET",
      headers,
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to fetch orders: ${listResponse.statusText}`);
    }

    const ordersData: StratusOrdersResponse = await listResponse.json();
    console.log(`Found ${ordersData.result_count} pending orders`);

    const processedOrders = [];
    const errors = [];

    for (const guid of ordersData.results) {
      try {
        const { data: existing } = await supabaseClient
          .from('lab_orders')
          .select('id, sync_status')
          .eq('stratus_guid', guid)
          .maybeSingle();

        if (existing && existing.sync_status === 'acknowledged') {
          console.log(`Order ${guid} already acknowledged, skipping`);
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

        if (existing) {
          const { error: updateError } = await supabaseClient
            .from('lab_orders')
            .update({
              order_data: orderData,
              sync_status: 'retrieved',
              retrieved_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Error updating order ${guid}:`, updateError);
            errors.push({ guid, error: updateError.message });
            continue;
          }
        } else {
          const { error: insertError } = await supabaseClient
            .from('lab_orders')
            .insert({
              stratus_guid: guid,
              order_data: orderData,
              sync_status: 'retrieved',
              retrieved_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error(`Error inserting order ${guid}:`, insertError);
            errors.push({ guid, error: insertError.message });
            continue;
          }
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

        processedOrders.push({ guid, status: 'success' });

      } catch (error) {
        console.error(`Error processing order ${guid}:`, error);
        errors.push({ guid, error: error.message });

        await supabaseClient
          .from('lab_orders')
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
        message: "Order sync completed",
        summary: {
          total: ordersData.result_count,
          processed: processedOrders.length,
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
