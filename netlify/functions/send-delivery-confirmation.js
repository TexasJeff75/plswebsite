const nodemailer = require('nodemailer');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const {
      orderNumber,
      facilityName,
      facilityAddress,
      itemList,
      recipientTypedName,
      courierTypedName,
      pickupSignatureBase64,
      deliverySignatureBase64,
      deliveryLocalTimestamp,
      customerAdminEmail,
      courierEmail,
    } = JSON.parse(event.body);

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.FROM_EMAIL || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('SMTP not configured - skipping delivery confirmation email');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Email skipped - SMTP not configured' }),
      };
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });

    const itemRows = (itemList || []).map(item =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${item.name || item.description}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right">&times;${item.qty}</td></tr>`
    ).join('');

    const pickupSigSection = pickupSignatureBase64
      ? `<h3 style="margin:24px 0 8px;color:#1e293b">Pick-up Signature</h3><img src="${pickupSignatureBase64}" style="max-height:80px;border:1px solid #cbd5e1;border-radius:4px;background:#fff" alt="Pick-up signature" />`
      : '';

    const deliverySigSection = deliverySignatureBase64
      ? `<h3 style="margin:24px 0 8px;color:#1e293b">Recipient Signature</h3><img src="${deliverySignatureBase64}" style="max-height:80px;border:1px solid #cbd5e1;border-radius:4px;background:#fff" alt="Recipient signature" />`
      : '';

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0f766e;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px">Supply Order Delivered</h1>
      <p style="color:#ccfbf1;margin:4px 0 0;font-size:14px">Order ${orderNumber}</p>
    </div>
    <div style="padding:32px">
      <p style="color:#334155;margin:0 0 24px">Your supply order has been delivered to <strong>${facilityName}</strong>.</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Item</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Qty</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;margin-bottom:24px">
        <tr><td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">Facility</td><td style="padding:10px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0">${facilityName}</td></tr>
        ${facilityAddress ? `<tr><td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">Address</td><td style="padding:10px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0">${facilityAddress}</td></tr>` : ''}
        <tr><td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">Received By</td><td style="padding:10px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0">${recipientTypedName}</td></tr>
        <tr><td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">Delivered By</td><td style="padding:10px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0">${courierTypedName}</td></tr>
        <tr><td style="padding:10px 16px;font-size:13px;color:#64748b">Delivered At</td><td style="padding:10px 16px;font-size:13px;color:#1e293b">${deliveryLocalTimestamp}</td></tr>
      </table>

      ${deliverySigSection}
      ${pickupSigSection}
    </div>
    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="color:#94a3b8;font-size:12px;margin:0">This is an automated message from Proximity Deployment Tracker.</p>
    </div>
  </div>
</body>
</html>`;

    const recipients = [customerAdminEmail, courierEmail].filter(Boolean).join(',');

    if (!recipients) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'No recipients specified' }),
      };
    }

    await transporter.sendMail({
      from: `"Proximity Deployment" <${fromEmail}>`,
      to: recipients,
      subject: `Supply Order Delivered - ${orderNumber} - ${facilityName}`,
      html: emailHtml,
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Delivery confirmation email sent successfully' }),
    };
  } catch (error) {
    console.error('Error sending delivery confirmation email:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to send email', details: error.message }),
    };
  }
};
