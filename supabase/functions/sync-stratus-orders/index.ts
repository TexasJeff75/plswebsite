import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRATUS_BASE_URL = "https://testapi.stratusdx.net/interface";
const STRATUS_USERNAME = Deno.env.get("STRATUS_USERNAME") ?? "";
const STRATUS_PASSWORD = Deno.env.get("STRATUS_PASSWORD") ?? "";

const MAX_BATCHES = 50;
const BATCH_SIZE = 5;
const CONCURRENT_LIMIT = 3;
const RETRY_DELAY_MS = 1000;

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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseInsuranceRow(orderId: string, type: string, ins: any) {
  return {
    lab_order_id: orderId,
    insurance_type: type,
    policy_number: ins.policy_number || ins.policynumber || null,
    group_number: ins.group_number || ins.groupnumber || null,
    plan_name: ins.plan_name || ins.planname || null,
    insured_name: ins.insured_name || ins.insuredname || null,
    insured_id: ins.insured_id || ins.insuredid || null,
    insured_dob: ins.insured_dob || ins.insureddob || null,
    insured_relationship: ins.insured_relationship || ins.insuredrelationship || null,
    insured_address: ins.insured_address || ins.insuredaddress || null,
    insured_city: ins.insured_city || ins.insuredcity || null,
    insured_state: ins.insured_state || ins.insuredstate || null,
    insured_zip: ins.insured_zip || ins.insuredzip || null,
    insured_phone: ins.insured_phone || ins.insuredphone || null,
    payer_id: ins.payer_id || ins.payerid || null,
    payer_name: ins.payer_name || ins.payername || null,
    payer_address: ins.payer_address || ins.payeraddress || null,
    payer_city: ins.payer_city || ins.payercity || null,
    payer_state: ins.payer_state || ins.payerstate || null,
    payer_zip: ins.payer_zip || ins.payerzip || null,
    payer_phone: ins.payer_phone || ins.payerphone || null,
    copay: ins.copay || null,
    deductible: ins.deductible || null,
    raw_data: ins,
  };
}

async function processOrderWithRetry(
  guid: string,
  supabaseClient: any,
  headers: any,
  retries = 2
): Promise<{ guid: string; status: string; error?: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data: existing } = await supabaseClient
        .from('lab_orders')
        .select('id, sync_status, organization_id, facility_id')
        .eq('stratus_guid', guid)
        .maybeSingle();

      if (existing && existing.sync_status === 'acknowledged') {
        console.log(`Order ${guid} already acknowledged, re-ACKing to clear queue`);
        const reAckResponse = await fetch(`${STRATUS_BASE_URL}/order/${guid}/ack`, {
          method: "POST",
          headers,
        });

        if (reAckResponse.ok) {
          return { guid, status: 're-acknowledged' };
        }
        throw new Error(`Re-ACK failed: ${reAckResponse.statusText}`);
      }

      console.log(`[${guid}] Retrieving order details...`);
      const detailResponse = await fetch(`${STRATUS_BASE_URL}/order/${guid}`, {
        method: "GET",
        headers,
      });

      if (!detailResponse.ok) {
        throw new Error(`Failed to fetch order: ${detailResponse.statusText}`);
      }

      const orderData = await detailResponse.json();

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
            console.log(`[${guid}] Mapped to org: ${organizationId}, facility: ${facilityId}`);

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

      // Parse nested objects from the API response
      const patient = orderData.patient || {};
      const provider = orderData.provider || {};
      const lab = orderData.lab || {};
      const order = orderData.order || {};
      const location = orderData.location || {};
      const org = orderData.organization || {};
      const panels = Array.isArray(orderData.panels) ? orderData.panels : [];
      const dxCodes = Array.isArray(orderData.diagnosis_codes) ? orderData.diagnosis_codes : [];
      const medications = Array.isArray(orderData.medications) ? orderData.medications : [];
      const primaryIns = orderData.primary_insurance || {};
      const secondaryIns = orderData.secondary_insurance || {};

      const customFields: Record<string, string> = {};
      for (let i = 1; i <= 16; i++) {
        const key = `custom_field${i}`;
        if (order[key]) customFields[key] = order[key];
      }

      const { data: upsertedOrder, error: upsertError } = await supabaseClient
        .from('lab_orders')
        .upsert({
          stratus_guid: guid,
          organization_id: organizationId,
          facility_id: facilityId,
          order_data: orderData,
          sync_status: 'retrieved',
          retrieved_at: new Date().toISOString(),
          accession_id: order.accession_id ? String(order.accession_id) : null,
          accession_number: order.accession_id ? String(order.accession_id) : null,
          order_status: orderData.status || null,
          organization_name: org.name || null,
          location_name: location.name || null,
          provider_name: [provider.first_name, provider.last_name].filter(Boolean).join(' ') || null,
          patient_initials: [patient.first_name?.[0], patient.last_name?.[0]].filter(Boolean).join('') || null,
          panels: panels.map((p: any) => p.panel_name || p.testmethod_name).filter(Boolean),
          // Parsed patient fields
          patient_first_name: patient.first_name || null,
          patient_last_name: patient.last_name || null,
          patient_dob: patient.dob || null,
          patient_gender: patient.gender_code || null,
          patient_id: patient.patient_id || null,
          patient_phone_home: patient.home_phone || null,
          patient_phone_mobile: patient.mobile_phone || null,
          patient_phone_office: patient.office_phone || null,
          patient_email: patient.email_address || null,
          patient_address: patient.address_street || null,
          patient_city: patient.address_city || null,
          patient_state: patient.address_state_code || null,
          patient_zip: patient.address_zip || null,
          // Parsed provider fields
          provider_first_name: provider.first_name || null,
          provider_last_name: provider.last_name || null,
          provider_npi: provider.npi || null,
          // Parsed lab fields
          lab_name: lab.name || null,
          lab_phone: lab.phone || null,
          lab_clia: lab.clia || null,
          lab_address: lab.address_street || null,
          lab_city: lab.address_city || null,
          lab_state: lab.address_state_code || null,
          lab_zip: lab.address_zip || null,
          // Order timestamps
          collected_datetime: order.collected_datetime || null,
          requisition_datetime: order.requisition_datetime || null,
          received_datetime: order.received_datetime || null,
          finalized_datetime: order.finalized_datetime || null,
          requisition_by: order.requisition_by || null,
          order_comments: order.comments || null,
          custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
        }, {
          onConflict: 'stratus_guid',
          ignoreDuplicates: false
        })
        .select('id')
        .single();

      if (upsertError) {
        throw new Error(`Upsert failed: ${upsertError.message}`);
      }

      const orderId = upsertedOrder.id;

      // Delete existing child rows and re-insert (idempotent upsert pattern)
      await supabaseClient.from('stratus_order_panels').delete().eq('lab_order_id', orderId);
      await supabaseClient.from('stratus_order_diagnosis_codes').delete().eq('lab_order_id', orderId);
      await supabaseClient.from('stratus_order_medications').delete().eq('lab_order_id', orderId);
      await supabaseClient.from('stratus_order_insurance').delete().eq('lab_order_id', orderId);

      // Insert panels
      const panelRows = [];
      for (let i = 0; i < panels.length; i++) {
        const p = panels[i];
        panelRows.push({
          lab_order_id: orderId,
          panel_name: p.panel_name || null,
          panel_code: p.panel_code || null,
          cpt_code: p.cpt_code || null,
          testmethod_code: p.testmethod_code || null,
          testmethod_name: p.testmethod_name || null,
          rapid_order: p.rapid_order || null,
          sample_type: p.sample_type || null,
          specimen_type: p.specimen_type || null,
          interface_code: p.interface_code || null,
          interface_text: p.interface_text || null,
          orderset_name: p.orderset_name || null,
          orderset_billing_code: p.orderset_billing_code || null,
          alt_panel_name: p.alt_panel_name || null,
          panel_notes: p.panel_notes || null,
          runby: p.runby || null,
          runby_datetime: p.runby_datetime || null,
          comments: p.comments || null,
          sort_order: i,
        });
      }
      if (panelRows.length > 0) {
        const { data: insertedPanels, error: panelErr } = await supabaseClient
          .from('stratus_order_panels')
          .insert(panelRows)
          .select('id, sort_order');
        if (panelErr) console.error(`[${guid}] Panel insert error: ${panelErr.message}`);

        // Insert tests nested under panels
        if (insertedPanels && insertedPanels.length > 0) {
          const testRows = [];
          for (const ip of insertedPanels) {
            const panel = panels[ip.sort_order];
            const tests = Array.isArray(panel?.tests) ? panel.tests : [];
            for (let j = 0; j < tests.length; j++) {
              const t = tests[j];
              testRows.push({
                lab_order_id: orderId,
                order_panel_id: ip.id,
                test_code: t.test_code || null,
                test_name: t.test_name || t.test_description || null,
                loinc_code: t.loinc_code || null,
                loinc_text: t.loinc_text || null,
                cpt_code: t.cpt_code || null,
                test_uom: t.test_uom || null,
                test_description: t.test_description || null,
                test_notes: t.test_notes || null,
                sort_order: j,
              });
            }
          }
          if (testRows.length > 0) {
            const { error: testErr } = await supabaseClient
              .from('stratus_order_tests')
              .insert(testRows);
            if (testErr) console.error(`[${guid}] Test insert error: ${testErr.message}`);
          }
        }
      }

      // Insert diagnosis codes
      if (dxCodes.length > 0) {
        const dxRows = dxCodes.map((d: any, i: number) => ({
          lab_order_id: orderId,
          code: d.code || null,
          name: d.name || null,
          sort_order: i,
        }));
        const { error: dxErr } = await supabaseClient
          .from('stratus_order_diagnosis_codes')
          .insert(dxRows);
        if (dxErr) console.error(`[${guid}] DX code insert error: ${dxErr.message}`);
      }

      // Insert medications
      if (medications.length > 0) {
        const medRows = medications.map((m: any, i: number) => ({
          lab_order_id: orderId,
          code: m.code || null,
          name: m.name || null,
          sort_order: i,
        }));
        const { error: medErr } = await supabaseClient
          .from('stratus_order_medications')
          .insert(medRows);
        if (medErr) console.error(`[${guid}] Medication insert error: ${medErr.message}`);
      }

      // Insert insurance (primary + secondary)
      const insRows = [];
      if (primaryIns && Object.keys(primaryIns).length > 0) {
        insRows.push(parseInsuranceRow(orderId, 'primary', primaryIns));
      }
      if (secondaryIns && Object.keys(secondaryIns).length > 0) {
        insRows.push(parseInsuranceRow(orderId, 'secondary', secondaryIns));
      }
      if (insRows.length > 0) {
        const { error: insErr } = await supabaseClient
          .from('stratus_order_insurance')
          .insert(insRows);
        if (insErr) console.error(`[${guid}] Insurance insert error: ${insErr.message}`);
      }

      console.log(`[${guid}] Acknowledging order...`);
      const ackResponse = await fetch(`${STRATUS_BASE_URL}/order/${guid}/ack`, {
        method: "POST",
        headers,
      });

      if (!ackResponse.ok) {
        throw new Error(`Failed to ACK: ${ackResponse.statusText}`);
      }

      await supabaseClient
        .from('lab_orders')
        .update({
          sync_status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('stratus_guid', guid);

      console.log(`[${guid}] ✓ Successfully processed`);
      return { guid, status: 'success' };

    } catch (error) {
      console.error(`[${guid}] Attempt ${attempt + 1}/${retries + 1} failed:`, error.message);

      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      await supabaseClient
        .from('lab_orders')
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
      chunk.map(guid => processOrderWithRetry(guid, supabaseClient, headers))
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

    console.log("=== StratusDX Orders Sync Started ===");
    console.log(`Max batches: ${MAX_BATCHES} | Batch size: ${BATCH_SIZE} | Concurrent: ${CONCURRENT_LIMIT}`);

    const allResults = [];
    let batchNumber = 0;
    let totalProcessed = 0;
    let continueProcessing = true;

    while (continueProcessing && batchNumber < MAX_BATCHES) {
      batchNumber++;
      console.log(`\n--- Batch ${batchNumber} ---`);

      const listResponse = await fetch(`${STRATUS_BASE_URL}/orders`, {
        method: "GET",
        headers,
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to fetch orders: ${listResponse.statusText}`);
      }

      const ordersData: StratusOrdersResponse = await listResponse.json();
      console.log(`Queue status: ${ordersData.result_count} retrieved | ${ordersData.total_count} total in queue`);

      if (!ordersData.results || ordersData.results.length === 0 || ordersData.total_count === 0) {
        console.log("✓ Queue empty - no more records to process");
        continueProcessing = false;
        break;
      }

      const batchResults = await processBatchConcurrently(
        ordersData.results,
        supabaseClient,
        headers
      );

      allResults.push(...batchResults);
      totalProcessed += batchResults.length;

      const successCount = batchResults.filter(r => r.status === 'success' || r.status === 're-acknowledged').length;
      const errorCount = batchResults.filter(r => r.status === 'error').length;
      console.log(`Batch ${batchNumber} complete: ${successCount} success, ${errorCount} errors`);

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
        message: "Order sync completed",
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
    console.error("Fatal error syncing orders:", error);

    return new Response(
      JSON.stringify({
        success: false,
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
