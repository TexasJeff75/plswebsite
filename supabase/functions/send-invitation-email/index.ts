import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationEmailRequest {
  email: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, role, inviteUrl, expiresAt }: InvitationEmailRequest = await req.json();

    if (!email || !role || !inviteUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({
          error: "Email service not configured",
          details: "RESEND_API_KEY environment variable is not set. Please configure it in Supabase Edge Function secrets.",
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

    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailText = `You're Invited to Proximity Lab Services Deployment Tracker

Hello,

You've been invited to join the Proximity Lab Services Deployment Tracker platform as a ${role}.

To accept your invitation, please click the link below or copy it into your browser:

${inviteUrl}

IMPORTANT: This invitation expires on ${expiryDate}. Please accept it before then to gain access.

What to expect:
- Access deployment tracking and facility management tools
- Collaborate with your team in real-time
- View detailed reports and analytics

If you didn't expect this invitation, you can safely ignore this email. The invitation will expire automatically.

If you have any questions, please contact your system administrator.

---
Proximity Lab Services
Deployment Tracker Platform
16922 Telge Rd., Suite 2
Cypress, TX 77429
(210) 316-1792
info@proximitylabservices.com
`;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You've been invited to Proximity Lab Services</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc;">
          <div style="background-color: #ffffff; margin: 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Team Invitation</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Proximity Lab Services Deployment Tracker</p>
            </div>

            <div style="padding: 40px 30px; background-color: #ffffff;">
              <p style="font-size: 16px; margin: 0 0 20px 0; color: #1e293b;">Hello,</p>

              <p style="font-size: 16px; margin: 0 0 25px 0; color: #334155;">
                You have been invited to join the Proximity Lab Services Deployment Tracker platform with the role of <strong>${role}</strong>.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteUrl}" style="display: inline-block; background-color: #00d4aa; color: #0f172a; padding: 16px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 10px 0;">Accept Invitation</a>
                <p style="margin: 15px 0 0 0; font-size: 13px; color: #64748b;">
                  Or copy this link: <a href="${inviteUrl}" style="color: #0ea5e9; word-break: break-all;">${inviteUrl}</a>
                </p>
              </div>

              <div style="background-color: #fff7ed; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>Important:</strong> This invitation expires on ${expiryDate}.
                </p>
              </div>

              <div style="margin: 30px 0;">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #0f172a; font-weight: 600;">Platform Features:</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569;">
                  <li style="margin: 8px 0;">Deployment tracking and facility management</li>
                  <li style="margin: 8px 0;">Real-time team collaboration</li>
                  <li style="margin: 8px 0;">Comprehensive reports and analytics</li>
                </ul>
              </div>

              <div style="border-top: 1px solid #e2e8f0; margin: 30px 0; padding-top: 25px;">
                <p style="font-size: 13px; color: #64748b; margin: 0 0 10px 0;">
                  If you didn't expect this invitation, you can safely ignore this email.
                </p>
                <p style="font-size: 13px; color: #64748b; margin: 0;">
                  Questions? Contact your system administrator.
                </p>
              </div>
            </div>

            <div style="background-color: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 5px 0; font-size: 14px; color: #475569; font-weight: 600;">Proximity Lab Services</p>
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b;">Deployment Tracker Platform</p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                16922 Telge Rd., Suite 2, Cypress, TX 77429<br>
                (210) 316-1792 | info@proximitylabservices.com
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log(`Sending invitation email to ${email}`);
    console.log(`Role: ${role}`);
    console.log(`Invite URL: ${inviteUrl}`);
    console.log(`Expires: ${expiryDate}`);

    const fromEmail = Deno.env.get('EMAIL_FROM') || 'Proximity Lab Services <noreply@proximitylabservices.com>';

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "You're invited to Proximity Lab Services Deployment Tracker",
        html: emailHtml,
        text: emailText,
        reply_to: 'info@proximitylabservices.com',
        headers: {
          'X-Entity-Ref-ID': `invitation-${Date.now()}`,
        },
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('Resend API error:', errorData);
      throw new Error(errorData.message || 'Failed to send email via Resend');
    }

    const result = await resendResponse.json();
    console.log('Email sent successfully via Resend:', result.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation email sent successfully",
        emailId: result.id,
        details: {
          email,
          role,
          expiresAt: expiryDate,
        },
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
    console.error("Error processing invitation email:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to process invitation email",
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
