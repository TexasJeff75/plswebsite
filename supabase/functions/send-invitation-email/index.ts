import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You've been invited to Proximity Lab Services</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">You're Invited!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Join Proximity Lab Services Deployment Tracker</p>
          </div>

          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-top: 0;">Hello,</p>

            <p style="font-size: 16px;">
              You've been invited to join the Proximity Lab Services Deployment Tracker platform as a <strong>${role}</strong>.
            </p>

            <div style="background: white; border: 2px solid #00d4aa; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
              <p style="margin: 0 0 15px 0; font-size: 14px; color: #64748b;">Click the button below to accept your invitation:</p>
              <a href="${inviteUrl}" style="display: inline-block; background: #00d4aa; color: #0f172a; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Accept Invitation
              </a>
            </div>

            <div style="background: #fff7ed; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Important:</strong> This invitation expires on ${expiryDate}. Please accept it before then to gain access.
              </p>
            </div>

            <div style="margin: 25px 0; padding: 20px; background: white; border-radius: 6px; border: 1px solid #e2e8f0;">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #0f172a;">What to expect:</h3>
              <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569;">
                <li style="margin: 8px 0;">Access deployment tracking and facility management tools</li>
                <li style="margin: 8px 0;">Collaborate with your team in real-time</li>
                <li style="margin: 8px 0;">View detailed reports and analytics</li>
              </ul>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">

            <p style="font-size: 13px; color: #64748b; margin: 0;">
              If you didn't expect this invitation, you can safely ignore this email. The invitation will expire automatically.
            </p>

            <p style="font-size: 13px; color: #64748b; margin: 15px 0 0 0;">
              If you have any questions, please contact your system administrator.
            </p>
          </div>

          <div style="text-align: center; padding: 20px 0; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">Proximity Lab Services</p>
            <p style="margin: 5px 0 0 0;">Deployment Tracker Platform</p>
          </div>
        </body>
      </html>
    `;

    console.log(`Sending invitation email to ${email}`);
    console.log(`Role: ${role}`);
    console.log(`Invite URL: ${inviteUrl}`);
    console.log(`Expires: ${expiryDate}`);

    const { data: emailData, error: emailError } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
      data: {
        role: role,
        invite_url: inviteUrl,
        expires_at: expiresAt,
      },
      redirectTo: inviteUrl,
    });

    if (emailError) {
      console.error('Supabase email error:', emailError);
      throw emailError;
    }

    console.log('Email sent successfully via Supabase');

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation email sent successfully",
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
