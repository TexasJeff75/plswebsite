const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email service not configured', details: 'RESEND_API_KEY is not set.' }),
      };
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Supabase not configured', details: 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.' }),
      };
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
      };
    }

    const { reportId } = JSON.parse(event.body || '{}');
    if (!reportId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing reportId' }),
      };
    }

    const supabase = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });

    const { data: report, error: reportError } = await supabase
      .from('commission_reports')
      .select(`
        *,
        sales_reps(id, name, email),
        commission_periods(id, name, start_date, end_date),
        commission_report_items(
          *,
          qbo_invoices(invoice_number, num, customer_name, invoice_date, transaction_date, total_amount, status, ar_paid, product_service)
        )
      `)
      .eq('id', reportId)
      .maybeSingle();

    if (reportError) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Report query failed', details: reportError.message }),
      };
    }
    if (!report) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Report not found', details: `No report found with id: ${reportId}` }),
      };
    }

    if (report.commission_report_items) {
      report.commission_report_items = report.commission_report_items.slice().sort((a, b) => {
        const dateA = new Date(a.qbo_invoices?.transaction_date || a.qbo_invoices?.invoice_date || 0).getTime();
        const dateB = new Date(b.qbo_invoices?.transaction_date || b.qbo_invoices?.invoice_date || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        const numA = (a.qbo_invoices?.num || a.qbo_invoices?.invoice_number || '').toLowerCase();
        const numB = (b.qbo_invoices?.num || b.qbo_invoices?.invoice_number || '').toLowerCase();
        return numA.localeCompare(numB, undefined, { numeric: true });
      });
    }

    const { data: settings } = await supabase
      .from('commission_settings')
      .select('cc_emails')
      .maybeSingle();

    const repEmail = report.sales_reps?.email;
    if (!repEmail) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Sales rep has no email address configured.' }),
      };
    }

    const repName = report.sales_reps?.name || 'Sales Representative';
    const ccEmails = settings?.cc_emails || [];

    const periodName = report.commission_periods?.name ||
      `${fmtDateShort(report.period_start)} – ${fmtDateShort(report.period_end)}`;

    const subject = `Commission: ${periodName} - ${repName}`;
    const emailHtml = buildEmailHtml(report);
    const emailText = buildEmailText(report);
    const pdfHtml = buildPdfHtml(report);

    const fromEmail = process.env.EMAIL_FROM || 'Proximity Lab Services <noreply@proximitylabservices.com>';

    const emailPayload = {
      from: fromEmail,
      to: [repEmail],
      subject,
      html: emailHtml,
      text: emailText,
      reply_to: 'info@proximitylabservices.com',
      attachments: [
        {
          filename: `Commission_Report_${report.report_number}_${repName.replace(/\s+/g, '_')}.html`,
          content: Buffer.from(pdfHtml).toString('base64'),
          content_type: 'text/html',
        },
      ],
    };

    if (ccEmails.length > 0) {
      emailPayload.cc = ccEmails;
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('Resend API error:', errorData);
      throw new Error(errorData.message || 'Failed to send email via Resend');
    }

    const result = await resendResponse.json();
    console.log('Commission report email sent:', result.id);

    await supabase
      .from('commission_reports')
      .update({
        status: 'Emailed',
        emailed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Commission report emailed successfully',
        emailId: result.id,
        sentTo: repEmail,
        cc: ccEmails,
        subject,
      }),
    };
  } catch (error) {
    console.error('Error sending commission report email:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to send commission report email', details: error.message }),
    };
  }
};

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s.substring(0, 10)) && s.length === 10;
  const dt = isDateOnly ? new Date(`${s}T12:00:00Z`) : new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(d) {
  if (!d) return '—';
  const s = String(d);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s.substring(0, 10)) && s.length === 10;
  const dt = isDateOnly ? new Date(`${s}T12:00:00Z`) : new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric', day: 'numeric', year: '2-digit' });
}

function buildEmailHtml(report) {
  const repName = report.sales_reps?.name || 'Sales Representative';
  const periodName = report.commission_periods?.name ||
    `${fmtDateShort(report.period_start)} – ${fmtDateShort(report.period_end)}`;
  const customerSummary = buildCustomerSummaryHtml(report);

  return `<!DOCTYPE html>
<html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <title>Commission Report — ${periodName} — ${repName}</title>
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
  </style>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1e293b;background-color:#f8fafc;margin:0;padding:0;" bgcolor="#f8fafc">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;">
    <tr><td align="center" style="padding:20px 10px;">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;" bgcolor="#ffffff">
        <!-- Header -->
        <tr><td bgcolor="#0f172a" style="background-color:#0f172a;padding:36px 32px;">
          <div style="font-size:20px;font-weight:800;color:#ffffff;margin-bottom:4px;">Proximity Lab Services</div>
          <div style="font-size:13px;color:#94a3b8;margin-bottom:20px;">Commission Statement</div>
          <div style="font-size:22px;font-weight:700;color:#ffffff;">${repName}</div>
          <div style="font-size:14px;color:#cbd5e1;margin-top:4px;">${periodName}</div>
        </td></tr>
        <!-- Body -->
        <tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:32px;">
          <p style="font-size:15px;color:#334155;margin:0 0 24px 0;">
            Please find your commission report for <strong style="color:#1e293b;">${periodName}</strong> attached to this email as an HTML file.
          </p>
          <!-- Stats row -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td width="33%" style="padding-right:6px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;margin-bottom:4px;">REPORT #</div>
                    <div style="font-size:13px;font-weight:700;color:#0f172a;">${report.report_number}</div>
                  </td></tr>
                </table>
              </td>
              <td width="33%" style="padding:0 3px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;margin-bottom:4px;">TOTAL INVOICED</div>
                    <div style="font-size:14px;font-weight:700;color:#0f172a;">${fmt(report.total_invoice_amount)}</div>
                  </td></tr>
                </table>
              </td>
              <td width="33%" style="padding-left:6px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td bgcolor="#f0fdf4" style="background-color:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px 16px;">
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#16a34a;font-weight:700;margin-bottom:4px;">COMMISSION OWED</div>
                    <div style="font-size:16px;font-weight:800;color:#16a34a;">${fmt(report.total_commission_amount)}</div>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
          <!-- Summary -->
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;margin-bottom:10px;">COMMISSION SUMMARY BY CUSTOMER</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px;">
            ${customerSummary}
          </table>
          <!-- Note -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
            <tr><td bgcolor="#fff7ed" style="background-color:#fff7ed;border-left:4px solid #f59e0b;padding:14px 16px;border-radius:4px;">
              <p style="margin:0;font-size:13px;color:#92400e;">The full commission report with all invoice line items is attached. Please review and reach out with any questions.</p>
            </td></tr>
          </table>
          <p style="font-size:13px;color:#64748b;margin:0;">
            Questions? Contact us at <a href="mailto:info@proximitylabservices.com" style="color:#0ea5e9;text-decoration:underline;">info@proximitylabservices.com</a>.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td bgcolor="#f8fafc" style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:13px;color:#475569;font-weight:700;">Proximity Lab Services</p>
          <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;">16922 Telge Rd., Suite 2 · Cypress, TX 77429</p>
          <p style="margin:0;font-size:12px;color:#64748b;">(210) 316-1792 · info@proximitylabservices.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildCustomerSummaryHtml(report) {
  const items = report.commission_report_items || [];
  const byCustomer = {};
  items.forEach((item) => {
    const key = item.qbo_invoices?.customer_name || 'Unknown';
    if (!byCustomer[key]) byCustomer[key] = { amount: 0, commission: 0, count: 0 };
    byCustomer[key].amount += parseFloat(item.commissionable_amount || 0);
    byCustomer[key].commission += parseFloat(item.commission_amount || 0);
    byCustomer[key].count += 1;
  });

  const rows = Object.entries(byCustomer)
    .sort((a, b) => b[1].commission - a[1].commission)
    .map(([customer, t], idx) => `
      <tr bgcolor="${idx % 2 !== 0 ? '#f8fafc' : '#ffffff'}" style="background-color:${idx % 2 !== 0 ? '#f8fafc' : '#ffffff'};">
        <td style="padding:10px 14px;color:#1e293b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${customer}</td>
        <td style="padding:10px 14px;text-align:center;color:#475569;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${t.count}</td>
        <td style="padding:10px 14px;text-align:right;color:#1e293b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${fmt(t.amount)}</td>
        <td style="padding:10px 14px;text-align:right;color:#475569;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${t.amount > 0 ? ((t.commission / t.amount) * 100).toFixed(1) : '0.0'}%</td>
        <td style="padding:10px 14px;text-align:right;font-weight:700;color:#16a34a;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${fmt(t.commission)}</td>
      </tr>`)
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <thead>
        <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
          <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Customer</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Line Items</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Total Amount</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Eff. Rate</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Commission</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr bgcolor="#ffffff" style="background-color:#ffffff;"><td colspan="5" style="text-align:center;padding:16px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">No data</td></tr>'}</tbody>
      <tfoot>
        <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;border-top:2px solid #e2e8f0;">
          <td style="padding:10px 14px;font-weight:700;font-size:13px;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">Total</td>
          <td style="padding:10px 14px;text-align:center;font-weight:700;font-size:13px;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">${items.length}</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;font-size:13px;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">${fmt(report.total_commissionable_amount)}</td>
          <td style="color:#0f172a;font-family:Arial,Helvetica,sans-serif;"></td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;font-size:14px;color:#16a34a;font-family:Arial,Helvetica,sans-serif;">${fmt(report.total_commission_amount)}</td>
        </tr>
      </tfoot>
    </table>`;
}

function buildEmailText(report) {
  const repName = report.sales_reps?.name || 'Sales Representative';
  const periodName = report.commission_periods?.name ||
    `${fmtDateShort(report.period_start)} – ${fmtDateShort(report.period_end)}`;
  const items = report.commission_report_items || [];

  const byCustomer = {};
  items.forEach((item) => {
    const key = item.qbo_invoices?.customer_name || 'Unknown';
    if (!byCustomer[key]) byCustomer[key] = { amount: 0, commission: 0, count: 0 };
    byCustomer[key].amount += item.commissionable_amount || 0;
    byCustomer[key].commission += item.commission_amount || 0;
    byCustomer[key].count += 1;
  });

  const summaryLines = Object.entries(byCustomer)
    .sort((a, b) => b[1].commission - a[1].commission)
    .map(([customer, t]) => `  ${customer}: ${fmt(t.commission)} (${t.count} line item${t.count !== 1 ? 's' : ''}, ${fmt(t.amount)} total)`)
    .join('\n');

  return `Commission Report — ${periodName} — ${repName}

Hello ${repName},

Please find your commission report for ${periodName} attached to this email.

Report #: ${report.report_number}
Total Invoiced: ${fmt(report.total_invoice_amount)}
Commission Owed: ${fmt(report.total_commission_amount)}

Commission Summary by Customer:
${summaryLines || '  No data'}

Total Commission: ${fmt(report.total_commission_amount)}

The full report with all invoice line items is attached.

If you have any questions, please contact us at info@proximitylabservices.com.

---
Proximity Lab Services
16922 Telge Rd., Suite 2
Cypress, TX 77429
(210) 316-1792
info@proximitylabservices.com
`;
}

function buildPdfHtml(report) {
  const items = report.commission_report_items || [];
  const F = 'font-family:Arial,Helvetica,sans-serif;';

  const byCustomer = {};
  items.forEach((item) => {
    const key = item.qbo_invoices?.customer_name || 'Unknown';
    if (!byCustomer[key]) byCustomer[key] = { amount: 0, commission: 0, count: 0 };
    byCustomer[key].amount += parseFloat(item.commissionable_amount || 0);
    byCustomer[key].commission += parseFloat(item.commission_amount || 0);
    byCustomer[key].count += 1;
  });

  const summaryRows = Object.entries(byCustomer)
    .sort((a, b) => b[1].commission - a[1].commission)
    .map(([customer, t], idx) => `
    <tr bgcolor="${idx % 2 !== 0 ? '#f8fafc' : '#ffffff'}" style="background-color:${idx % 2 !== 0 ? '#f8fafc' : '#ffffff'};">
      <td style="padding:9px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${customer}</td>
      <td style="padding:9px 12px;text-align:center;color:#475569;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${t.count}</td>
      <td style="padding:9px 12px;text-align:right;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${fmt(t.amount)}</td>
      <td style="padding:9px 12px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${t.amount > 0 ? ((t.commission / t.amount) * 100).toFixed(1) : '0.0'}%</td>
      <td style="padding:9px 12px;text-align:right;font-weight:700;color:#16a34a;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${fmt(t.commission)}</td>
    </tr>`).join('');

  const lineItemRows = items.map((item, idx) => {
    const inv = item.qbo_invoices || {};
    const arPaid = inv.ar_paid || '';
    const isPaid = arPaid.toLowerCase() === 'paid';
    const arBg = isPaid ? '#dcfce7' : '#fef9c3';
    const arColor = isPaid ? '#16a34a' : '#ca8a04';
    return `
    <tr bgcolor="${idx % 2 !== 0 ? '#f8fafc' : '#ffffff'}" style="background-color:${idx % 2 !== 0 ? '#f8fafc' : '#ffffff'};">
      <td style="padding:9px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${fmtDateShort(inv.transaction_date || inv.invoice_date)}</td>
      <td style="padding:9px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${inv.num || inv.invoice_number || '—'}</td>
      <td style="padding:9px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:middle;max-width:160px;overflow:hidden;${F}">${inv.customer_name || '—'}</td>
      <td style="padding:9px 12px;color:#475569;border-bottom:1px solid #f1f5f9;vertical-align:middle;max-width:180px;overflow:hidden;${F}">${inv.product_service || '—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${arPaid ? `<span style="padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background-color:${arBg};color:${arColor};${F}">${arPaid}</span>` : '<span style="color:#94a3b8;">—</span>'}</td>
      <td style="padding:9px 12px;text-align:right;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${fmt(item.commissionable_amount)}</td>
      <td style="padding:9px 12px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${((item.commission_rate || 0) * 100).toFixed(1)}%</td>
      <td style="padding:9px 12px;text-align:right;font-weight:600;color:#16a34a;border-bottom:1px solid #f1f5f9;vertical-align:middle;${F}">${fmt(item.commission_amount)}</td>
    </tr>`;
  }).join('');

  const statusClass = (report.status || 'draft').toLowerCase().replace(/\s+/g, '-');
  const badgeColors = {
    approved: 'background-color:#dcfce7;color:#16a34a',
    draft: 'background-color:#f1f5f9;color:#475569',
    'pending-approval': 'background-color:#fef9c3;color:#ca8a04',
    emailed: 'background-color:#ccfbf1;color:#0d9488',
    paid: 'background-color:#dbeafe;color:#2563eb',
    rejected: 'background-color:#fee2e2;color:#dc2626',
  };
  const badgeStyle = badgeColors[statusClass] || 'background-color:#f1f5f9;color:#475569';

  const thStyle = `padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;font-weight:700;${F}`;
  const tfStyle = `padding:9px 12px;font-weight:700;background-color:#f1f5f9;border-top:2px solid #e2e8f0;font-size:13px;color:#0f172a;${F}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>:root{color-scheme:light only;}</style>
</head>
<body style="margin:0;padding:48px;background-color:#ffffff;color:#1e293b;${F}">

<!-- Header -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;border-bottom:2px solid #e2e8f0;padding-bottom:24px;">
  <tr>
    <td style="${F}">
      <div style="font-size:22px;font-weight:800;color:#0f172a;${F}">Proximity Lab Services</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;${F}">Commission Statement</div>
    </td>
    <td style="text-align:right;${F}">
      <div style="font-size:20px;font-weight:700;color:#0f172a;${F}">Commission Report</div>
      <div style="font-size:13px;color:#64748b;margin-top:4px;${F}">${report.report_number}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:2px;${F}">Generated ${fmtDate(report.created_at)}</div>
      <div style="margin-top:8px;"><span style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:10px;font-weight:700;text-transform:uppercase;${badgeStyle};${F}">${report.status}</span></div>
    </td>
  </tr>
</table>

<!-- Rep block -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
  <tr>
    <td style="padding:18px 24px;${F}">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;font-weight:600;margin-bottom:3px;${F}">Sales Representative</div>
      <div style="font-size:15px;font-weight:600;color:#0f172a;${F}">${report.sales_reps?.name || '—'}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;${F}">${report.sales_reps?.email || ''}</div>
    </td>
    <td style="padding:18px 24px;${F}">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;font-weight:600;margin-bottom:3px;${F}">Commission Period</div>
      <div style="font-size:15px;font-weight:600;color:#0f172a;${F}">${report.commission_periods?.name || 'Custom Period'}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;${F}">${fmtDate(report.period_start)} – ${fmtDate(report.period_end)}</div>
    </td>
    <td style="padding:18px 24px;${F}">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;font-weight:600;margin-bottom:3px;${F}">Report Date</div>
      <div style="font-size:15px;font-weight:600;color:#0f172a;${F}">${fmtDate(report.created_at)}</div>
    </td>
  </tr>
</table>

<!-- Summary stats -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
  <tr>
    <td width="25%" style="padding-right:7px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;font-weight:600;margin-bottom:5px;${F}">Line Items</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;${F}">${items.length}</div>
        </td>
      </tr></table>
    </td>
    <td width="25%" style="padding:0 3.5px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;font-weight:600;margin-bottom:5px;${F}">Total Invoiced</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;${F}">${fmt(report.total_invoice_amount)}</div>
        </td>
      </tr></table>
    </td>
    <td width="25%" style="padding:0 3.5px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;font-weight:600;margin-bottom:5px;${F}">Commissionable</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;${F}">${fmt(report.total_commissionable_amount)}</div>
        </td>
      </tr></table>
    </td>
    <td width="25%" style="padding-left:7px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="#f0fdf4" style="background-color:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 18px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#16a34a;font-weight:600;margin-bottom:5px;${F}">Commission Owed</div>
          <div style="font-size:20px;font-weight:800;color:#16a34a;${F}">${fmt(report.total_commission_amount)}</div>
        </td>
      </tr></table>
    </td>
  </tr>
</table>

<!-- Line items table -->
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;font-weight:700;margin-bottom:10px;${F}">Invoice Line Items</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:28px;font-size:12px;">
  <thead>
    <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
      <th style="${thStyle}">Txn Date</th>
      <th style="${thStyle}">Num</th>
      <th style="${thStyle}">Customer</th>
      <th style="${thStyle}">Product / Service</th>
      <th style="${thStyle}">A/R Paid</th>
      <th style="${thStyle}text-align:right;">Amount</th>
      <th style="${thStyle}text-align:right;">Rate</th>
      <th style="${thStyle}text-align:right;">Commission</th>
    </tr>
  </thead>
  <tbody>${lineItemRows || `<tr bgcolor="#ffffff" style="background-color:#ffffff;"><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px;${F}">No line items</td></tr>`}</tbody>
  <tfoot>
    <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
      <td colspan="5" style="${tfStyle}">Total</td>
      <td style="${tfStyle}text-align:right;">${fmt(report.total_commissionable_amount)}</td>
      <td style="${tfStyle}"></td>
      <td style="${tfStyle}text-align:right;color:#16a34a;font-size:14px;">${fmt(report.total_commission_amount)}</td>
    </tr>
  </tfoot>
</table>

<!-- Summary table -->
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;font-weight:700;margin-bottom:10px;${F}">Commission Summary by Customer</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:28px;font-size:12px;">
  <thead>
    <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
      <th style="${thStyle}">Customer</th>
      <th style="${thStyle}text-align:center;">Line Items</th>
      <th style="${thStyle}text-align:right;">Total Amount</th>
      <th style="${thStyle}text-align:right;">Eff. Rate</th>
      <th style="${thStyle}text-align:right;">Commission</th>
    </tr>
  </thead>
  <tbody>${summaryRows || `<tr bgcolor="#ffffff" style="background-color:#ffffff;"><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;${F}">No data</td></tr>`}</tbody>
  <tfoot>
    <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
      <td style="${tfStyle}">Total</td>
      <td style="${tfStyle}text-align:center;">${items.length}</td>
      <td style="${tfStyle}text-align:right;">${fmt(report.total_commissionable_amount)}</td>
      <td style="${tfStyle}"></td>
      <td style="${tfStyle}text-align:right;color:#16a34a;font-size:14px;">${fmt(report.total_commission_amount)}</td>
    </tr>
  </tfoot>
</table>

<!-- Footer / signature -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:40px;border-top:1px solid #e2e8f0;padding-top:20px;">
  <tr>
    <td style="${F}">
      <div style="border-top:1px solid #cbd5e1;width:200px;padding-top:8px;font-size:11px;color:#94a3b8;${F}">Approved By</div>
    </td>
    <td style="${F}">
      <div style="border-top:1px solid #cbd5e1;width:200px;padding-top:8px;font-size:11px;color:#94a3b8;${F}">Sales Representative Signature</div>
    </td>
    <td style="text-align:right;${F}">
      <div style="font-size:11px;color:#94a3b8;${F}">Proximity Lab Services</div>
      <div style="margin-top:4px;font-size:11px;color:#94a3b8;${F}">Confidential Commission Statement</div>
    </td>
  </tr>
</table>

</body>
</html>`;
}
