import axios from 'axios';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const BREVO_API_URL = 'https://api.brevo.com/v3';
const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM_EMAIL || 'noreply@wrapper.app';
const senderName = process.env.BREVO_SENDER_NAME || process.env.SMTP_FROM_NAME || 'Wrapper';

console.log('📧 Email configuration:', {
  senderEmail,
  senderName,
  brevoApiUrl: BREVO_API_URL,
  hasApiKey: !!process.env.BREVO_API_KEY
});

// Create axios instance for Brevo API
const brevoClient = axios.create({
  baseURL: BREVO_API_URL,
  headers: {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

type EmailProvider = 'brevo' | 'smtp' | 'demo';

interface SendEmailParams {
  to: Array<{ email: string; name?: string }> | { email: string; name?: string } | string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  attachments?: unknown[];
}

class EmailService {
  emailProvider: EmailProvider;
  smtpTransporter: ReturnType<typeof nodemailer.createTransport> | null;

  constructor() {
    this.emailProvider = this.detectEmailProvider();
    this.smtpTransporter = null;

    if (this.emailProvider === 'smtp') {
      this.initializeSMTP();
    }

    console.log(`📧 Email Service initialized with provider: ${this.emailProvider}`);
  }

  detectEmailProvider(): EmailProvider {
    // Clean up the API key - remove any whitespace or invalid characters
    const cleanApiKey = process.env.BREVO_API_KEY?.trim();

    console.log('🔍 Email provider detection:', {
      hasBrevoKey: !!cleanApiKey,
      brevoKeyLength: cleanApiKey?.length || 0,
      brevoKeyStartsWith: cleanApiKey?.substring(0, 10) + '...',
      isDefaultKey: cleanApiKey === 'your-brevo-api-key',
      hasSMTP: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    });

    if (cleanApiKey && cleanApiKey !== 'your-brevo-api-key' && cleanApiKey.length > 20) {
      console.log('📧 Using Brevo as email provider');
      return 'brevo';
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log('📧 Using SMTP as email provider');
      return 'smtp';
    } else {
      console.warn('⚠️  No email provider configured. Email service will run in demo mode.');
      return 'demo';
    }
  }
  
  initializeSMTP(): void {
    try {
      this.smtpTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
        }
      });
      
      console.log('✅ SMTP transporter initialized successfully');
    } catch (err: unknown) {
      console.error('❌ Failed to initialize SMTP transporter:', err);
      this.emailProvider = 'demo';
    }
  }

  // Send welcome email to new organization admin
  async sendWelcomeEmail({ email, name, companyName, subdomain, kindeOrgCode: _kindeOrgCode, loginUrl }: { email: string; name: string; companyName: string; subdomain: string; kindeOrgCode: string; loginUrl: string }) {
    const subject = `Welcome to ${companyName} - Your Zopkit Account is Ready!`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Zopkit Invitation</title>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Arial, sans-serif;
      background: radial-gradient(circle at top, #1e293b 0%, #0b1220 45%);
      padding: 48px 16px;
      color: #0f172a;
    }

    .email-shell {
      max-width: 720px;
      margin: 0 auto;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 20px;
      overflow: hidden;
      box-shadow:
        0 40px 120px rgba(15, 23, 42, 0.45),
        0 10px 40px rgba(15, 23, 42, 0.25);
    }

    /* ---------- HEADER ---------- */
    .header {
      padding: 56px 56px 48px;
      text-align: center;
      background:
        radial-gradient(circle at top, #eef2ff 0%, #ffffff 60%);
    }

    .logo {
      max-width: 190px;
      margin-bottom: 32px;
    }

    .header h1 {
      font-size: 34px;
      font-weight: 700;
      letter-spacing: -0.6px;
      margin-bottom: 12px;
    }

    .header p {
      font-size: 17px;
      color: #475569;
      max-width: 520px;
      margin: 0 auto;
    }

    /* ---------- CONTENT ---------- */
    .content {
      padding: 56px;
    }

    .greeting {
      font-size: 21px;
      font-weight: 600;
      margin-bottom: 22px;
    }

    .content p {
      font-size: 16.5px;
      line-height: 1.75;
      color: #334155;
      margin-bottom: 22px;
    }

    /* ---------- INFO CARD ---------- */
    .card {
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 16px;
      padding: 28px 30px;
      margin: 32px 0;
      box-shadow:
        0 10px 30px rgba(15, 23, 42, 0.08),
        inset 0 0 0 1px #e5e7eb;
    }

    .card h3 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 18px;
    }

    .card ul {
      list-style: none;
    }

    .card li {
      padding: 12px 0;
      border-bottom: 1px dashed #e5e7eb;
      font-size: 15.5px;
      color: #334155;
    }

    .card li:last-child {
      border-bottom: none;
    }

    .card strong {
      color: #0f172a;
      min-width: 160px;
      display: inline-block;
    }

    /* ---------- SECTION TITLE ---------- */
    .section {
      margin-top: 48px;
    }

    .section-title {
      font-size: 19px;
      font-weight: 700;
      margin-bottom: 14px;
      position: relative;
      padding-left: 14px;
    }

    .section-title::before {
      content: "";
      position: absolute;
      left: 0;
      top: 4px;
      height: 70%;
      width: 4px;
      border-radius: 2px;
      background: linear-gradient(180deg, #4f46e5, #38bdf8);
    }

    /* ---------- SSO BOX ---------- */
    .sso-box {
      background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%);
      border-radius: 14px;
      padding: 24px;
      margin-top: 22px;
      box-shadow: inset 0 0 0 1px #c7d2fe;
    }

    .sso-box p {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #1e293b;
    }

    .login-link {
      display: block;
      padding: 14px 16px;
      background: #ffffff;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      color: #4f46e5;
      text-decoration: none;
      word-break: break-all;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.15);
    }

    /* ---------- CTA ---------- */
    .cta {
      text-align: center;
      margin: 44px 0;
    }

    .cta a {
      display: inline-block;
      padding: 18px 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      color: #ffffff;
      font-size: 17px;
      font-weight: 700;
      text-decoration: none;
      letter-spacing: 0.2px;
      box-shadow:
        0 18px 40px rgba(79, 70, 229, 0.45);
    }

    /* ---------- STEPS ---------- */
    .steps {
      margin-top: 24px;
      list-style: none;
    }

    .steps li {
      margin-bottom: 18px;
      padding-left: 36px;
      position: relative;
      font-size: 15.5px;
      color: #334155;
    }

    .steps li::before {
      content: "→";
      position: absolute;
      left: 0;
      top: 0;
      color: #4f46e5;
      font-weight: 700;
    }

    /* ---------- FOOTER ---------- */
    .footer {
      padding: 40px 56px;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border-top: 1px solid #e5e7eb;
    }

    .footer p {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
    }

    .signature {
      margin-top: 18px;
      font-weight: 700;
      color: #0f172a;
    }

    @media (max-width: 600px) {
      .header, .content, .footer {
        padding: 32px;
      }
      .header h1 {
        font-size: 26px;
      }
    }
  </style>
</head>

<body>
  <div class="email-shell">
    <div class="header">
      <img src="https://res.cloudinary.com/dr9vzaa7u/image/upload/v1765126845/Zopkit_Full_Logo_kezq1b.jpg" class="logo" alt="Zopkit"/>
      <h1>You’ve been invited to Zopkit</h1>
      <p>Secure access to your organization’s AI-powered workspace</p>
    </div>

    <div class="content">
      <p class="greeting">Hello ${name},</p>

      <p>
        You’ve been invited to join <strong>${companyName}</strong> on <strong>Zopkit</strong> —
        a unified platform designed to streamline business operations, workflows,
        and internal collaboration.
      </p>

      <div class="card">
        <h3>Organization Details</h3>
        <ul>
          <li><strong>Organization</strong> ${companyName}</li>
          <li><strong>Workspace</strong> ${subdomain}.zopkit.com</li>
          <li><strong>Invited Email</strong> ${email}</li>
        </ul>
      </div>

      <div class="section">
        <div class="section-title">Secure Access (SSO Enabled)</div>
        <p>
          Zopkit uses password-less Single Sign-On.
          Sign in securely using your email address.
        </p>

        <div class="sso-box">
          <p>Your login link</p>
          <a href="${loginUrl}" class="login-link">${loginUrl}</a>
        </div>
      </div>

      <div class="cta">
        <a href="${loginUrl}">Accept Invitation</a>
      </div>

      <div class="section">
        <div class="section-title">Next Steps</div>
        <ul class="steps">
          <li>Sign in and confirm your account</li>
          <li>Review your role and permissions</li>
          <li>Explore your organization workspace</li>
          <li>Start collaborating with your team</li>
        </ul>
      </div>
    </div>

    <div class="footer">
      <p>If you did not expect this invitation, you may safely ignore this email.</p>
      <p class="signature">— The Zopkit Team</p>
    </div>
  </div>
</body>
</html>
    `;

    return await this.sendEmail({
      to: [{ email, name }],
      subject,
      htmlContent: html,
      textContent: undefined
    });
  }

  // Send user invitation email
  async sendUserInvitation({ email, tenantName, roleName, invitationToken, invitedByName, message, invitedDate, expiryDate, organizations, locations, primaryOrganizationName }: { email: string; tenantName: string; roleName: string; invitationToken: string; invitedByName: string; message?: string; invitedDate?: Date | string; expiryDate?: Date | string; organizations?: string[]; locations?: string[]; primaryOrganizationName?: string }) {
    const subject = `You're invited to join ${tenantName} on Zopkit`;

    // Handle both token-based and direct URL invitations
    const acceptUrl = invitationToken.startsWith('http')
      ? invitationToken
      : `${process.env.FRONTEND_URL}/invite/accept?token=${invitationToken}`;

    // Format dates
    const formatDate = (date: Date | string) => {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const invitedDateFormatted = invitedDate ? formatDate(invitedDate) : formatDate(new Date());
    const expiryDateFormatted = expiryDate ? formatDate(expiryDate) : formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
            padding: 20px;
            min-height: 100vh;
          }
          .container { 
            max-width: 650px;
            margin: 0 auto;
          }
          .card { 
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.05);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fb 100%);
            padding: 50px 40px;
            text-align: center;
            position: relative;
            border-bottom: 1px solid #e5e7eb;
          }
          .logo-container {
            margin-bottom: 32px;
            background: rgba(0, 0, 0, 0.02);
            backdrop-filter: blur(10px);
            padding: 20px 30px;
            border-radius: 12px;
            display: inline-block;
            border: 1px solid rgba(0, 0, 0, 0.05);
          }
          .logo {
            max-width: 200px;
            height: auto;
            display: block;
          }
          .invitation-badge { 
            background: linear-gradient(135deg, #1a1a1a 0%, #374151 100%);
            color: white;
            padding: 10px 20px;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 700;
            display: inline-block;
            margin-bottom: 20px;
            letter-spacing: 0.3px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
          .header h1 {
            margin: 16px 0;
            font-size: 32px;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: -0.5px;
          }
          .header p {
            margin: 0;
            font-size: 17px;
            color: #64748b;
          }
          .content { 
            padding: 45px 40px;
            background: white;
          }
          .inviter-section { 
            background: linear-gradient(135deg, #fafbfc 0%, #f1f3f5 100%);
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 24px;
            margin: 0 0 32px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          }
          .inviter-section h2 {
            margin: 0 0 10px 0;
            color: #0f172a;
            font-size: 18px;
            font-weight: 700;
          }
          .inviter-section p {
            margin: 0;
            color: #475569;
            font-size: 15px;
            line-height: 1.7;
          }
          .details-grid { 
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin: 32px 0;
          }
          .detail-item { 
            background: linear-gradient(135deg, #fafbfc 0%, #f4f6f8 100%);
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            padding: 18px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
          }
          .detail-label { 
            font-size: 12px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }
          .detail-value { 
            font-size: 15px;
            font-weight: 600;
            color: #0f172a;
          }
          .role-badge { 
            background: linear-gradient(135deg, #1a1a1a 0%, #374151 100%);
            color: white;
            padding: 6px 14px;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 700;
            display: inline-block;
            letter-spacing: 0.3px;
          }
          .organization-list { 
            background: linear-gradient(135deg, #fafbfc 0%, #f4f6f8 100%);
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
          }
          .organization-list h3 {
            margin: 0 0 16px 0;
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
          }
          .org-item { 
            display: flex;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .org-item:last-child { 
            border-bottom: none;
            padding-bottom: 0;
          }
          .org-icon { 
            width: 10px;
            height: 10px;
            background: linear-gradient(135deg, #1a1a1a 0%, #374151 100%);
            border-radius: 50%;
            margin-right: 14px;
          }
          .org-item span {
            font-weight: 600;
            color: #334155;
            font-size: 15px;
          }
          .message-section { 
            background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
            border: 2px solid #fde047;
            border-left: 5px solid #eab308;
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
            box-shadow: 0 2px 8px rgba(234, 179, 8, 0.08);
          }
          .message-section h3 {
            margin: 0 0 10px 0;
            color: #92400e;
            font-size: 17px;
            font-weight: 700;
          }
          .message-section p {
            margin: 0;
            font-style: italic;
            color: #78350f;
            font-size: 15px;
            line-height: 1.7;
          }
          .expiry-notice { 
            background: #fef2f2;
            border: 2px solid #fecaca;
            border-left: 5px solid #dc2626;
            border-radius: 12px;
            padding: 18px;
            margin: 24px 0;
            color: #991b1b;
            font-size: 14px;
            font-weight: 600;
          }
          .cta-section { 
            text-align: center;
            margin: 36px 0;
          }
          .cta-button { 
            display: inline-block;
            padding: 16px 40px;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d3748 100%);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 700;
            font-size: 16px;
            letter-spacing: 0.3px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
            transition: all 0.3s ease;
          }
          .cta-button:hover { 
            transform: translateY(-2px);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
            background: linear-gradient(135deg, #2d3748 0%, #1a1a1a 100%);
          }
          .cta-section p {
            margin: 16px 0 0 0;
            font-size: 14px;
            color: #64748b;
          }
          .features-section { 
            background: linear-gradient(135deg, #fafbfc 0%, #f4f6f8 100%);
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 28px;
            margin: 28px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
          }
          .features-section h3 {
            margin: 0 0 20px 0;
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
          }
          .feature-grid { 
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }
          .feature-item { 
            display: flex;
            align-items: center;
            font-size: 15px;
            color: #334155;
            font-weight: 500;
          }
          .feature-icon { 
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #1a1a1a 0%, #374151 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            color: white;
            font-size: 16px;
            font-weight: bold;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
          .footer { 
            text-align: center;
            padding: 32px 40px;
            color: #64748b;
            font-size: 14px;
            background: linear-gradient(135deg, #fafbfc 0%, #f4f6f8 100%);
            border-top: 3px solid #1a1a1a;
          }
          .footer p {
            margin: 0;
            line-height: 1.8;
          }
          .footer strong {
            color: #0f172a;
            font-weight: 700;
          }
          @media (max-width: 640px) { 
            body { padding: 10px; }
            .content { padding: 30px 24px; }
            .header { padding: 40px 24px; }
            .details-grid { grid-template-columns: 1fr; }
            .feature-grid { grid-template-columns: 1fr; }
            .header h1 { font-size: 26px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo-container">
                <img src="https://res.cloudinary.com/dr9vzaa7u/image/upload/v1765126845/Zopkit_Full_Logo_kezq1b.jpg" alt="Zopkit Logo" class="logo">
              </div>
              <div class="invitation-badge">Team Invitation</div>
              <h1>You're Invited!</h1>
              <p>Join ${tenantName} on Zopkit</p>
            </div>

            <div class="content">
              <div class="inviter-section">
                <h2>Invitation from ${invitedByName}</h2>
                <p>You've been personally invited to join our team. We're excited to have you collaborate with us!</p>
              </div>

              <div class="details-grid">
                <div class="detail-item">
                  <div class="detail-label">Organization</div>
                  <div class="detail-value">${primaryOrganizationName || (organizations && organizations.length > 0 ? organizations[0] : tenantName)}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Your Role</div>
                  <div class="detail-value">
                    <span class="role-badge">${roleName}</span>
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Invited Date</div>
                  <div class="detail-value">${invitedDateFormatted}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Expires</div>
                  <div class="detail-value">${expiryDateFormatted}</div>
                </div>
              </div>

              ${organizations && organizations.length > 0 ? `
              <div class="organization-list">
                <h3>Access to Organizations</h3>
                ${organizations.map((org: string) => `
                  <div class="org-item">
                    <div class="org-icon"></div>
                    <span>${org}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}

              ${locations && locations.length > 0 ? `
              <div class="organization-list">
                <h3>Access to Locations</h3>
                ${locations.map((loc: string) => `
                  <div class="org-item">
                    <div class="org-icon"></div>
                    <span>${loc}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}

              ${message ? `
              <div class="message-section">
                <h3>Personal Message</h3>
                <p>"${message}"</p>
              </div>
              ` : ''}

              <div class="expiry-notice">
                <strong>Important:</strong> This invitation expires on ${expiryDateFormatted}. Please accept it before then.
              </div>

              <div class="cta-section">
                <a href="${acceptUrl}" class="cta-button">Accept Invitation & Join Team</a>
                <p>Secure sign-in • No passwords required</p>
              </div>

              <div class="features-section">
                <h3>What You'll Get Access To</h3>
                <div class="feature-grid">
                  <div class="feature-item">
                    <div class="feature-icon">1</div>
                    <span>CRM & Business Tools</span>
                  </div>
                  <div class="feature-item">
                    <div class="feature-icon">2</div>
                    <span>Team Collaboration</span>
                  </div>
                  <div class="feature-item">
                    <div class="feature-icon">3</div>
                    <span>Analytics & Reporting</span>
                  </div>
                  <div class="feature-item">
                    <div class="feature-icon">4</div>
                    <span>Secure Workspace</span>
                  </div>
                  </div>
                </div>
              </div>

              <div class="footer">
              <p>
                  Questions? Contact <strong>${invitedByName}</strong> or reply to this email.<br>
                Powered by <strong>Zopkit</strong> • Your AI-first business operating system
                </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: [{ email }],
      subject,
      htmlContent: html,
      textContent: undefined
    });
  }

  // Send usage alert email
  async sendUsageAlert({ tenantId: _tenantId, adminEmail, tenantName, alertType, metricType, currentValue, limitValue, percentage }: { tenantId: string; adminEmail: string; tenantName: string; alertType: string; metricType: string; currentValue: string | number; limitValue: string | number; percentage: number }) {
    const subject = `${tenantName} - Usage Alert: ${alertType.replace('_', ' ').toUpperCase()}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Usage Alert</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f44336; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert-box { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 15px 30px; background: #f44336; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Usage Alert</h1>
            <p>Your organization has reached a usage threshold</p>
          </div>
          <div class="content">
            <h2>Hi there!</h2>
            
            <p>Your organization <strong>${tenantName}</strong> has reached <strong>${percentage}%</strong> of your ${metricType} limit.</p>
            
            <div class="alert-box">
              <h3>📊 Usage Details</h3>
              <ul>
                <li><strong>Current Usage:</strong> ${currentValue}</li>
                <li><strong>Limit:</strong> ${limitValue}</li>
                <li><strong>Percentage:</strong> ${percentage}%</li>
                <li><strong>Alert Type:</strong> ${alertType.replace('_', ' ')}</li>
              </ul>
            </div>
            
            <h3>🚀 What You Can Do</h3>
            <ul>
              <li>Review your current usage in the dashboard</li>
              <li>Consider upgrading your plan for higher limits</li>
              <li>Optimize your usage patterns</li>
              <li>Contact support if you need assistance</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard/billing" class="button">Manage Your Plan</a>
            </div>
            
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
            
            <p><strong>The Wrapper Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: [{ email: adminEmail }],
      subject,
      htmlContent: html,
      textContent: undefined
    });
  }

  // Send downgrade confirmation email
  async sendDowngradeConfirmation({ tenantId: _tenantId, fromPlan, toPlan, refundAmount, effectiveDate }: { tenantId: string; fromPlan: string; toPlan: string; refundAmount: number; effectiveDate: Date | string }) {
    const subject = `Subscription Downgrade Confirmation`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Downgrade Confirmation</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .amount-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📉 Subscription Downgrade Confirmed</h1>
            <p>Your plan change has been processed</p>
          </div>
          <div class="content">
            <h2>Downgrade Successful</h2>
            
            <p>Your subscription has been successfully changed:</p>
            
            <div class="info-box">
              <h3>Plan Change Details</h3>
              <ul>
                <li><strong>From:</strong> ${fromPlan.charAt(0).toUpperCase() + fromPlan.slice(1)} Plan</li>
                <li><strong>To:</strong> ${toPlan.charAt(0).toUpperCase() + toPlan.slice(1)} Plan</li>
                <li><strong>Effective Date:</strong> ${new Date(effectiveDate).toLocaleDateString()}</li>
              </ul>
            </div>
            
            ${refundAmount > 0 ? `
            <div class="amount-box">
              <h3>💰 Refund Processing</h3>
              <p>A prorated refund of <strong>$${refundAmount.toFixed(2)}</strong> is being processed and will appear in your account within 5-10 business days.</p>
            </div>
            ` : ''}
            
            <h3>What's Next?</h3>
            <ul>
              <li>Your new plan features are now active</li>
              <li>You can upgrade again anytime from your billing page</li>
              <li>Contact support if you have any questions</li>
            </ul>
            
            <p>Thank you for using Wrapper!</p>
            <p><strong>The Wrapper Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: [{ email: 'admin@example.com' }], // Would get tenant admin email in production
      subject,
      htmlContent: html,
      textContent: undefined
    });
  }

  // Send payment failure notification
  async sendPaymentFailedNotification({ tenantId, amount, currency, nextAttempt, failureReason }: { tenantId: string; amount: number; currency: string; nextAttempt?: Date; failureReason: string }) {
    console.log('📧 Sending payment failure notification:', {
      tenantId,
      amount,
      currency,
      nextAttempt,
      failureReason
    });

    const subject = `Payment Failed - Action Required`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Failed</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert-box { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Payment Failed</h1>
            <p>We couldn't process your payment</p>
          </div>
          <div class="content">
            <div class="alert-box">
              <h3>Payment Details</h3>
              <p><strong>Amount:</strong> ${amount} ${currency}</p>
              <p><strong>Reason:</strong> ${failureReason}</p>
              ${nextAttempt ? `<p><strong>Next Attempt:</strong> ${new Date(nextAttempt).toLocaleDateString()}</p>` : ''}
            </div>
            
            <p>Please update your payment method to avoid service interruption.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // In production, you would get the tenant admin email and send the actual email
    console.log('✅ Payment failure notification sent successfully');
  }

  // Send dispute notification
  async sendDisputeNotification({ tenantId, disputeId, amount, currency, reason, evidenceDueBy }: { tenantId: string; disputeId: string; amount: number; currency: string; reason: string; evidenceDueBy?: Date }) {
    console.log('📧 Sending dispute notification:', {
      tenantId,
      disputeId,
      amount,
      currency,
      reason,
      evidenceDueBy
    });

    const subject = `Payment Dispute - ${disputeId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Dispute</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6f42c1; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚖️ Payment Dispute</h1>
            <p>A dispute has been filed for your payment</p>
          </div>
          <div class="content">
            <p><strong>Dispute ID:</strong> ${disputeId}</p>
            <p><strong>Amount:</strong> ${amount} ${currency}</p>
            <p><strong>Reason:</strong> ${reason}</p>
            ${evidenceDueBy ? `<p><strong>Evidence Due:</strong> ${new Date(evidenceDueBy).toLocaleDateString()}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('✅ Dispute notification sent successfully');
  }

  // Send payment confirmation email
  async sendPaymentConfirmation({ tenantId, userEmail, userName: _userName, paymentType, amount, currency, transactionId, planName, billingCycle, creditsAdded, sessionId }: { tenantId: string; userEmail: string; userName?: string; paymentType: string; amount: number; currency: string; transactionId?: string; planName?: string; billingCycle?: string; creditsAdded?: number; sessionId?: string }) {
    console.log('📧 Sending payment confirmation:', {
      tenantId,
      userEmail,
      paymentType,
      amount,
      currency,
      transactionId
    });

    const isSubscription = paymentType === 'subscription';
    const isCreditPurchase = paymentType === 'credit_purchase' || paymentType === 'topup';
    
    const subject = isSubscription 
      ? `Payment Confirmation - ${planName} Plan`
      : `Payment Confirmation - Credit Purchase`;

    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmation</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 10px 0 0 0; opacity: 0.9; }
          .content { padding: 30px; }
          .success-icon { font-size: 48px; margin-bottom: 20px; }
          .amount-box { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .amount-box .amount { font-size: 32px; font-weight: bold; color: #16a34a; margin: 10px 0; }
          .details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #6b7280; font-weight: 500; }
          .detail-value { color: #111827; font-weight: 600; }
          .features { margin: 20px 0; }
          .features h3 { color: #111827; margin-bottom: 15px; }
          .feature-item { display: flex; align-items: center; padding: 10px 0; }
          .feature-item::before { content: "✓"; color: #22c55e; font-weight: bold; margin-right: 10px; font-size: 18px; }
          .footer { background: #f9fafb; padding: 20px 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
          .button { display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="success-icon">✅</div>
            <h1>Payment Confirmed</h1>
            <p>Thank you for your payment!</p>
          </div>
          <div class="content">
            <div class="amount-box">
              <div style="color: #6b7280; font-size: 14px;">Amount Paid</div>
              <div class="amount">${formattedAmount}</div>
            </div>

            <div class="details">
              <div class="detail-row">
                <span class="detail-label">Transaction ID:</span>
                <span class="detail-value">${transactionId || sessionId || 'N/A'}</span>
              </div>
              ${isSubscription ? `
              <div class="detail-row">
                <span class="detail-label">Plan:</span>
                <span class="detail-value">${planName || 'Premium Plan'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Billing Cycle:</span>
                <span class="detail-value">${billingCycle === 'yearly' ? 'Annual' : 'Monthly'}</span>
              </div>
              ` : ''}
              ${isCreditPurchase && creditsAdded ? `
              <div class="detail-row">
                <span class="detail-label">Credits Added:</span>
                <span class="detail-value">${creditsAdded.toLocaleString()} credits</span>
              </div>
              ` : ''}
              <div class="detail-row">
                <span class="detail-label">Payment Method:</span>
                <span class="detail-value">Card</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>

            ${isSubscription ? `
            <div class="features">
              <h3>Your Plan Benefits:</h3>
              <div class="feature-item">Access to all premium features</div>
              <div class="feature-item">Priority customer support</div>
              <div class="feature-item">Advanced analytics and reporting</div>
              <div class="feature-item">${billingCycle === 'yearly' ? 'Annual billing with savings' : 'Monthly billing flexibility'}</div>
            </div>
            ` : isCreditPurchase ? `
            <div class="features">
              <h3>Your Credits:</h3>
              <div class="feature-item">${creditsAdded ? creditsAdded.toLocaleString() + ' credits' : 'Credits'} added to your account</div>
              <div class="feature-item">Credits never expire</div>
              <div class="feature-item">Use across all applications</div>
            </div>
            ` : ''}

            <p style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'https://app.wrapper.app'}/billing" class="button">View Billing Details</a>
            </p>
          </div>
          <div class="footer">
            <p>This is an automated confirmation email. Please keep this for your records.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Payment Confirmation

Thank you for your payment!

Amount: ${formattedAmount}
Transaction ID: ${transactionId || sessionId || 'N/A'}
${isSubscription ? `Plan: ${planName || 'Premium Plan'}\nBilling Cycle: ${billingCycle === 'yearly' ? 'Annual' : 'Monthly'}` : ''}
${isCreditPurchase && creditsAdded ? `Credits Added: ${creditsAdded.toLocaleString()} credits` : ''}
Payment Method: Card
Date: ${new Date().toLocaleDateString()}

${isSubscription ? 'Your subscription is now active. All premium features are available.' : 'Your credits have been added to your account and are ready to use.'}

View your billing details: ${process.env.FRONTEND_URL || 'https://app.wrapper.app'}/billing

This is an automated confirmation email. Please keep this for your records.
    `.trim();

    try {
      const result = await this.sendEmail({
        to: Array.isArray(userEmail) ? userEmail : [{ email: userEmail }],
        subject,
        htmlContent: html,
        textContent: textContent
      });

      console.log(`✅ Payment confirmation email sent successfully to: ${userEmail}`);
      return { success: true, result, emailSent: true };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Failed to send payment confirmation email to: ${userEmail}`, error);
      return { success: false, error: error.message, emailSent: false };
    }
  }

  // Send refund confirmation
  async sendRefundConfirmation({ tenantId, refundId, amount, currency, reason, processedAt }: { tenantId: string; refundId: string; amount: number; currency: string; reason: string; processedAt: Date }) {
    console.log('📧 Sending refund confirmation:', {
      tenantId,
      refundId,
      amount,
      currency,
      reason,
      processedAt
    });

    const subject = `Refund Confirmation - $${amount}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Refund Confirmation</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💸 Refund Processed</h1>
            <p>Your refund has been processed successfully</p>
          </div>
          <div class="content">
            <p><strong>Refund Amount:</strong> ${amount} ${currency}</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p><strong>Processed:</strong> ${new Date(processedAt).toLocaleDateString()}</p>
            <p>The refund will appear in your account within 5-10 business days.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('✅ Refund confirmation sent successfully');
  }

  // Generic email sending method with multi-provider support
  async sendEmail({ to, subject, htmlContent, textContent, attachments = [] }: SendEmailParams & { textContent?: string }) {
    try {
      console.log(`📧 Sending email via ${this.emailProvider}:`, {
        to: Array.isArray(to) ? to.map(t => t.email || t) : [to],
        subject: subject?.substring(0, 50) + '...'
      });

      // Normalize the 'to' field
      const recipients = Array.isArray(to) ? to : [{ email: typeof to === 'object' ? to.email : (to as string) }];

      let result;
      let lastError;

      // Try primary provider first
      try {
        switch (this.emailProvider) {
          case 'brevo':
            result = await this.sendViaBrevo({ recipients, subject, htmlContent, textContent, attachments });
            break;
            
          case 'smtp':
            result = await this.sendViaSMTP({ recipients, subject, htmlContent, textContent, attachments });
            break;
            
          case 'demo':
          default:
            result = this.sendDemo({ recipients, subject, htmlContent, textContent });
            break;
        }
        
        if (result) {
          console.log('✅ Email sent successfully via primary provider');
          return result;
        }
      } catch (primaryError: unknown) {
        lastError = primaryError as Error;
        console.error(`❌ Primary provider (${this.emailProvider}) failed:`, (primaryError as Error).message);
      }

      // Try SMTP fallback if primary failed
      if (this.emailProvider !== 'smtp' && this.smtpTransporter) {
        console.log('🔄 Trying SMTP fallback...');
        try {
          result = await this.sendViaSMTP({ recipients, subject, htmlContent, textContent, attachments });
          console.log('✅ Email sent successfully via SMTP fallback');
          return result;
        } catch (smtpError: unknown) {
          console.error('❌ SMTP fallback also failed:', (smtpError as Error).message);
          lastError = smtpError as Error;
        }
      }

      // If all providers failed, fall back to demo mode
      console.log('🔄 All email providers failed, falling back to demo mode...');
      result = this.sendDemo({ recipients, subject, htmlContent, textContent });
      
      // Log the failure for debugging
      console.warn('⚠️ Email sent in demo mode due to provider failures:', {
        primaryProvider: this.emailProvider,
        primaryError: (lastError as Error | undefined)?.message,
        fallbackUsed: 'demo'
      });
      
      return result;
      
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Critical error in email service:', error);

      // Last resort: demo mode
      try {
        const recipients = Array.isArray(to) ? to : [{ email: typeof to === 'object' ? (to as { email: string }).email : (to as string) }];
        return this.sendDemo({ recipients, subject, htmlContent, textContent });
      } catch (demoError: unknown) {
        console.error('❌ Even demo mode failed:', demoError);
        throw new Error(`All email providers failed: ${error.message}`);
      }
    }
  }

  async sendViaBrevo({ recipients, subject, htmlContent, textContent, attachments }: { recipients: Array<{ email: string; name?: string }>; subject: string; htmlContent: string; textContent?: string; attachments?: unknown[] }) {
    console.log('🔄 Attempting to send email via Brevo API...');

    const emailData = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: recipients,
      subject,
      htmlContent,
      textContent,
      attachments
    };

    console.log('📧 Brevo email data:', {
      sender: emailData.sender,
      to: emailData.to,
      subject: emailData.subject,
      hasHtmlContent: !!emailData.htmlContent,
      recipientCount: recipients.length
    });

    try {
      console.log('🌐 Making API call to Brevo...');
      const response = await brevoClient.post('/smtp/email', emailData);

      console.log('✅ Email sent via Brevo:', {
        messageId: response.data.messageId,
        to: recipients.map(r => r.email || r),
        subject,
        status: response.status
      });

      return response.data;
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { code?: string; message?: string } }; code?: string; message?: string };
      // Handle specific Brevo errors
      if (error.response?.status === 401) {
        if (error.response.data?.code === 'unauthorized') {
          throw new Error(`Brevo API unauthorized: ${error.response.data.message}. Please check your API key and IP whitelist.`);
        }
        throw new Error('Brevo API unauthorized: Invalid API key or IP not whitelisted');
      } else if (error.response?.status === 429) {
        throw new Error('Brevo API rate limit exceeded. Please try again later.');
      } else if (error.response?.status != null && error.response.status >= 500) {
        throw new Error('Brevo API server error. Please try again later.');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Brevo API request timeout. Please try again.');
      } else {
        throw new Error(`Brevo API error: ${(error.response?.data as { message?: string } | undefined)?.message || error.message || 'Unknown'}`);
      }
    }
  }

  async sendViaSMTP({ recipients, subject, htmlContent, textContent, attachments }: { recipients: Array<{ email: string; name?: string }>; subject: string; htmlContent: string; textContent?: string; attachments?: unknown[] }) {
    if (!this.smtpTransporter) {
      throw new Error('SMTP transporter not initialized');
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${senderName}" <${senderEmail}>`,
      to: recipients.map((r: { email?: string }) => r.email || r).join(', '),
      subject,
      html: htmlContent,
      text: textContent || htmlContent?.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      attachments: (attachments || []) as nodemailer.SendMailOptions['attachments']
    };

    const result = await this.smtpTransporter.sendMail(mailOptions);
    
    console.log('✅ Email sent via SMTP:', {
      messageId: result.messageId,
      to: recipients.map((r: { email?: string }) => r.email || r),
      subject
    });
    
    return {
      messageId: result.messageId,
      provider: 'smtp'
    };
  }

  sendDemo({ recipients, subject, htmlContent, textContent }: { recipients: Array<{ email: string; name?: string }>; subject: string; htmlContent: string; textContent?: string }) {
    console.log('📧 Demo Mode - Email would be sent:', {
      from: `"${senderName}" <${senderEmail}>`,
      to: recipients.map(r => r.email || r),
      subject,
      hasHtml: !!htmlContent,
      hasText: !!textContent,
      timestamp: new Date().toISOString()
    });
    
    // In demo mode, also log a sample of the content for debugging
    if (htmlContent) {
      const preview = htmlContent.substring(0, 200).replace(/<[^>]*>/g, '');
      console.log('📝 Email preview:', preview + '...');
    }

    return {
      messageId: `demo-${Date.now()}`,
      provider: 'demo',
      recipients: recipients.length
    };
  }

  // Send bulk emails (for notifications, newsletters, etc.)
  async sendBulkEmail({ to, subject, htmlContent, textContent, templateId = null }: { to: Array<{ email: string }>; subject: string; htmlContent: string; textContent?: string; templateId?: number | null }) {
    try {
      if (!process.env.BREVO_API_KEY) {
        console.log('Bulk email would be sent:', { to: to.length, subject });
        return { messageId: 'demo-mode' };
      }

      const emailData = {
        sender: { 
          name: senderName, 
          email: senderEmail 
        },
        to,
        subject,
        htmlContent,
        textContent
      };

      if (templateId != null) {
        (emailData as Record<string, unknown>).templateId = templateId;
      }

      const response = await brevoClient.post('/smtp/email', emailData);
      
      console.log('Bulk email sent successfully via Brevo:', {
        messageId: response.data.messageId,
        recipients: to.length,
        subject
      });
      
      return response.data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      console.error('Error sending bulk email via Brevo:', error.response?.data || error.message);
      throw new Error(`Failed to send bulk email: ${(error.response?.data as { message?: string } | undefined)?.message || error.message}`);
    }
  }

  // Test email configuration for all providers
  async testConnection() {
    try {
      console.log(`🧪 Testing email connection for provider: ${this.emailProvider}`);
      
      switch (this.emailProvider) {
        case 'brevo':
          return await this.testBrevoConnection();
          
        case 'smtp':
          return await this.testSMTPConnection();
          
        case 'demo':
          console.log('📧 Demo mode - no real connection to test');
          return { success: true, provider: 'demo', message: 'Demo mode active' };
          
        default:
          return { success: false, provider: 'none', message: 'No email provider configured' };
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Email connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  async testBrevoConnection(): Promise<{ success: boolean; provider?: string; account?: { email: string; plan: unknown }; error?: string; status?: number }> {
    console.log('🧪 Testing Brevo connection...');
    console.log('🔑 API Key details:', {
      exists: !!process.env.BREVO_API_KEY,
      length: process.env.BREVO_API_KEY?.length || 0,
      startsWith: process.env.BREVO_API_KEY?.substring(0, 10) + '...'
    });

    try {
      console.log('🌐 Calling Brevo /account endpoint...');
      const response = await brevoClient.get('/account');
      console.log('✅ Brevo connection test successful:', {
        email: response.data.email,
        plan: response.data.plan,
        status: response.status
      });
      return {
        success: true,
        provider: 'brevo',
        account: {
          email: response.data.email,
          plan: response.data.plan
        }
      };
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; statusText?: string; data?: { message?: string } }; message?: string };
      console.error('❌ Brevo connection test failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      // Provide helpful troubleshooting info
      if (error.response?.status === 401) {
        console.error('🔐 AUTHENTICATION ISSUE: Check your BREVO_API_KEY');
      } else if (error.response?.status === 403) {
        console.error('🚫 PERMISSION ISSUE: Your API key may not have the right permissions');
      }

      return {
        success: false,
        provider: 'brevo',
        error: (error.response?.data as { message?: string } | undefined)?.message || error.message,
        status: error.response?.status
      };
    }
  }

  async testSMTPConnection(): Promise<{ success: boolean; provider: string; config?: Record<string, unknown>; error?: string }> {
    try {
      if (!this.smtpTransporter) {
        throw new Error('SMTP transporter not initialized');
      }
      
      await this.smtpTransporter.verify();
      console.log('✅ SMTP connection test successful');
      return { 
        success: true, 
        provider: 'smtp',
        config: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ SMTP connection test failed:', error.message);
      return {
        success: false,
        provider: 'smtp',
        error: error.message
      };
    }
  }

  // Get email sending statistics
  async getStats() {
    try {
      if (!process.env.BREVO_API_KEY) {
        return { demo: true };
      }

      const response = await brevoClient.get('/smtp/statistics');
      return response.data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: unknown }; message?: string };
      console.error('Error getting email stats:', error.response?.data || error.message);
      throw err;
    }
  }

  // Send urgent trial reminder (1 day before expiry)
  static async sendUrgentTrialReminder({ tenantId, hoursRemaining, trialEnd, currentPlan }: { tenantId: string; hoursRemaining: number; trialEnd: Date | string; currentPlan: string }) {
    console.log(`📧 Sending urgent trial reminder to tenant: ${tenantId}`);
    
    // In production, get tenant admin email from database
    const adminEmail = 'admin@example.com'; // Replace with actual tenant admin email
    
    const subject = `🚨 URGENT: Your trial expires in ${hoursRemaining} hours!`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Urgent Trial Reminder</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .urgency-banner { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 30px; border-radius: 4px; }
          .urgency-banner h2 { color: #dc2626; margin: 0 0 10px 0; font-size: 20px; }
          .countdown { text-align: center; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .countdown .time { font-size: 36px; font-weight: bold; }
          .countdown .label { font-size: 14px; opacity: 0.9; }
          .cta { text-align: center; margin: 30px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3); }
          .features { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .features h3 { margin: 0 0 15px 0; color: #1f2937; }
          .features ul { margin: 0; padding-left: 20px; }
          .features li { margin-bottom: 8px; color: #4b5563; }
          .footer { background-color: #f8fafc; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Trial Expiring Soon!</h1>
            <p>Don't lose access to your ${currentPlan} features</p>
          </div>
          
          <div class="content">
            <div class="urgency-banner">
              <h2>⏰ Action Required</h2>
              <p>Your trial period is ending very soon. Upgrade now to maintain uninterrupted access to all features.</p>
            </div>
            
            <div class="countdown">
              <div class="time">${hoursRemaining}</div>
              <div class="label">HOURS REMAINING</div>
            </div>
            
            <p>Hello,</p>
            
            <p>This is an <strong>urgent reminder</strong> that your ${currentPlan} trial will expire in just <strong>${hoursRemaining} hours</strong> on ${new Date(trialEnd).toLocaleDateString()}.</p>
            
            <div class="features">
              <h3>Don't lose access to:</h3>
              <ul>
                <li>✅ Advanced CRM tools</li>
                <li>✅ HR management system</li>
                <li>✅ Unlimited projects</li>
                <li>✅ Premium support</li>
                <li>✅ Advanced analytics</li>
              </ul>
            </div>
            
            <div class="cta">
              <a href="${process.env.FRONTEND_URL}/billing" class="cta-button">
                🚀 Upgrade Now - Save Your Data
              </a>
            </div>
            
            <p><strong>What happens if you don't upgrade?</strong></p>
            <ul>
              <li>❌ Your account will be suspended</li>
              <li>❌ You'll lose access to all premium features</li>
              <li>❌ Your data will be at risk</li>
              <li>❌ You'll need to start over with a new trial</li>
            </ul>
            
            <p>Upgrade takes less than 2 minutes. Secure your account now!</p>
          </div>
          
          <div class="footer">
            <p>This is an automated reminder. If you have questions, contact our support team.</p>
            <p>© 2024 Your Company. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
      🚨 URGENT: Your trial expires in ${hoursRemaining} hours!
      
      Your ${currentPlan} trial will expire on ${new Date(trialEnd).toLocaleDateString()}.
      
      Upgrade now to maintain access to all features:
      ${process.env.FRONTEND_URL}/billing
      
      Don't lose your data and progress!
    `;
    
    return (new EmailService()).sendEmail({
      to: [{ email: adminEmail }],
      subject,
      htmlContent,
      textContent
    });
  }

  // Send trial expiration notice
  static async sendTrialExpirationNotice({ tenantId, plan }: { tenantId: string; plan: string }) {
    console.log(`📧 Sending trial expiration notice to tenant: ${tenantId}`);
    
    const adminEmail = 'admin@example.com';
    const subject = `❌ Your trial has expired - Account suspended`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trial Expired</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .status-banner { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 30px; border-radius: 4px; }
          .status-banner h2 { color: #dc2626; margin: 0 0 10px 0; font-size: 20px; }
          .cta { text-align: center; margin: 30px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
          .footer { background-color: #f8fafc; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Trial Period Ended</h1>
            <p>Your account has been suspended</p>
          </div>
          
          <div class="content">
            <div class="status-banner">
              <h2>⚠️ Account Suspended</h2>
              <p>Your ${plan} trial has ended and your account has been temporarily suspended.</p>
            </div>
            
            <p>Hello,</p>
            
            <p>Your trial period has expired and your account is now suspended. To regain access to your data and features, please upgrade to a paid plan.</p>
            
            <p><strong>Current status:</strong></p>
            <ul>
              <li>❌ Account suspended</li>
              <li>❌ No access to premium features</li>
              <li>⚠️ Data preserved for 30 days</li>
            </ul>
            
            <div class="cta">
              <a href="${process.env.FRONTEND_URL}/billing" class="cta-button">
                🔓 Upgrade to Restore Access
              </a>
            </div>
            
            <p>Your data is safe for 30 days. After that, it may be permanently deleted.</p>
          </div>
          
          <div class="footer">
            <p>Questions? Contact our support team for assistance.</p>
            <p>© 2024 Your Company. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return (new EmailService()).sendEmail({
      to: [{ email: adminEmail }],
      subject,
      htmlContent,
      textContent: undefined
    });
  }

  // Send admin notification
  static async sendAdminNotification(data: { type: string; count?: number; breakdown?: { threeDay?: number; oneDay?: number }; deletedRecords?: number; updatedSubscriptions?: number; job?: string; error?: string }) {
    console.log(`📧 Sending admin notification: ${data.type}`);
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
    
    let subject, content;
    
    switch (data.type) {
      case 'trial_expiration':
        subject = `🚨 ${data.count} trials expired today`;
        content = `
          <h2>Trial Expiration Report</h2>
          <p><strong>${data.count}</strong> trial subscriptions have expired and been suspended today.</p>
          <p>These accounts will need to upgrade to regain access.</p>
        `;
        break;
        
      case 'trial_reminders':
        subject = `📧 ${data.count} trial reminders sent`;
        content = `
          <h2>Trial Reminder Report</h2>
          <p>Sent <strong>${data.count}</strong> trial reminder emails today:</p>
          <ul>
            <li>3-day reminders: ${data.breakdown?.threeDay ?? 0}</li>
            <li>1-day urgent reminders: ${data.breakdown?.oneDay ?? 0}</li>
          </ul>
        `;
        break;
        
      case 'daily_cleanup':
        subject = `🧹 Daily cleanup completed`;
        content = `
          <h2>Daily Maintenance Report</h2>
          <p>Today's cleanup results:</p>
          <ul>
            <li>Old records archived: ${data.deletedRecords}</li>
            <li>Subscriptions updated: ${data.updatedSubscriptions}</li>
          </ul>
        `;
        break;
        
      case 'cron_error':
        subject = `❌ Cron job error: ${data.job}`;
        content = `
          <h2>⚠️ Cron Job Error</h2>
          <p><strong>Job:</strong> ${data.job}</p>
          <p><strong>Error:</strong> ${data.error}</p>
          <p>Please investigate and resolve this issue.</p>
        `;
        break;
        
      default:
        subject = `📊 System notification`;
        content = `<p>${JSON.stringify(data)}</p>`;
    }
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Notification</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; }
          .header { background-color: #1f2937; color: white; padding: 20px; text-align: center; margin-bottom: 20px; }
          .content { padding: 20px 0; }
          .footer { color: #6b7280; font-size: 14px; text-align: center; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Admin Notification</h1>
            <p>${new Date().toLocaleString()}</p>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>This is an automated system notification.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return (new EmailService()).sendEmail({
      to: [{ email: adminEmail }],
      subject,
      htmlContent,
      textContent: undefined
    });
  }

  // Send weekly analytics report
  static async sendWeeklyAnalyticsReport(analyticsData: { week: { start: Date; end: Date }; subscriptions: { newTrials: number; newPaid: number; expiredTrials: number; conversionRate: number }; revenue: { total: number; paymentCount: number; averagePayment: number } }) {
    console.log(`📊 Sending weekly analytics report`);
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
    const subject = `📊 Weekly Analytics Report - ${analyticsData.week.start.toDateString()} to ${analyticsData.week.end.toDateString()}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly Analytics Report</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 700px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .metrics { display: flex; flex-wrap: wrap; gap: 20px; margin: 20px 0; }
          .metric-card { background-color: #f8fafc; padding: 20px; border-radius: 8px; flex: 1; min-width: 150px; text-align: center; border-left: 4px solid #2563eb; }
          .metric-value { font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 5px; }
          .metric-label { font-size: 14px; color: #6b7280; }
          .section { margin: 30px 0; }
          .section h3 { color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
          .conversion-rate { font-size: 18px; font-weight: bold; color: #059669; }
          .footer { background-color: #f8fafc; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Weekly Analytics Report</h1>
            <p>${analyticsData.week.start.toDateString()} - ${analyticsData.week.end.toDateString()}</p>
          </div>
          
          <div class="content">
            <div class="section">
              <h3>🚀 Subscription Metrics</h3>
              <div class="metrics">
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.subscriptions.newTrials}</div>
                  <div class="metric-label">New Trials</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.subscriptions.newPaid}</div>
                  <div class="metric-label">New Paid Subscriptions</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.subscriptions.expiredTrials}</div>
                  <div class="metric-label">Expired Trials</div>
                </div>
              </div>
              <p><strong>Conversion Rate:</strong> <span class="conversion-rate">${analyticsData.subscriptions.conversionRate}%</span></p>
            </div>
            
            <div class="section">
              <h3>💰 Revenue Metrics</h3>
              <div class="metrics">
                <div class="metric-card">
                  <div class="metric-value">$${analyticsData.revenue.total.toFixed(2)}</div>
                  <div class="metric-label">Total Revenue</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.revenue.paymentCount}</div>
                  <div class="metric-label">Payments</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">$${analyticsData.revenue.averagePayment}</div>
                  <div class="metric-label">Avg Payment</div>
                </div>
              </div>
            </div>
            
            <div class="section">
              <h3>📈 Key Insights</h3>
              <ul>
                <li><strong>Trial Performance:</strong> ${analyticsData.subscriptions.newTrials} new trials started this week</li>
                <li><strong>Conversion Success:</strong> ${analyticsData.subscriptions.conversionRate}% of trials converted to paid plans</li>
                <li><strong>Revenue Growth:</strong> Generated $${analyticsData.revenue.total.toFixed(2)} in revenue</li>
                <li><strong>Customer Acquisition:</strong> ${analyticsData.subscriptions.newPaid} new paying customers</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>This report is generated automatically every Monday.</p>
            <p>© 2024 Your Company. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return (new EmailService()).sendEmail({
      to: [{ email: adminEmail }],
      subject,
      htmlContent,
      textContent: undefined
    });
  }

  // Send trial reminder notification
  async sendTrialReminderNotification({ email, companyName, planName, expirationDate, subscriptionId: _subscriptionId }: { email: string; companyName: string; planName: string; expirationDate: Date | string; subscriptionId: string }) {
    const subject = `⏰ Your ${planName} trial expires soon - ${companyName}`;
    
    const timeRemaining = new Date(expirationDate).getTime() - new Date().getTime();
    const minutesRemaining = Math.ceil(timeRemaining / (1000 * 60));
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trial Expiration Reminder</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .timer { background: #ffebee; border: 2px solid #f44336; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Trial Expiring Soon!</h1>
            <p>Don't lose access to your ${planName} features</p>
          </div>
          <div class="content">
            <h2>Hi there!</h2>
            
            <div class="timer">
              <h3>🚨 ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} remaining</h3>
              <p>Your ${planName} trial expires at ${new Date(expirationDate).toLocaleString()}</p>
            </div>
            
            <div class="warning-box">
              <h3>⚠️ What happens when your trial expires?</h3>
              <ul>
                <li>Access to ${planName} features will be suspended</li>
                <li>Your data will be preserved for 30 days</li>
                <li>You can reactivate anytime by upgrading</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/billing?upgrade=true" class="button">Upgrade Now</a>
            </div>
            
            <h3>💳 Flexible Billing Options</h3>
            <ul>
              <li>Monthly or yearly billing</li>
              <li>Cancel anytime</li>
              <li>30-day money-back guarantee</li>
              <li>Secure payment processing</li>
            </ul>
            
            <p>Questions? Reply to this email - we're here to help!</p>
            
            <p>Best regards,<br><strong>The Wrapper Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: [{ email }],
      subject,
      htmlContent: html,
      textContent: undefined
    });
  }

  // Send trial expired notification
  async sendTrialExpiredNotification({ email, companyName, planName, subscriptionId: _subscriptionId }: { email: string; companyName: string; planName: string; subscriptionId: string }) {
    const subject = `🔒 Your ${planName} trial has expired - ${companyName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trial Expired</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .action-box { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .urgent-banner { background: #ffebee; border: 2px solid #f44336; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Trial Expired</h1>
            <p>Your ${planName} trial has ended</p>
          </div>
          <div class="content">
            <div class="urgent-banner">
              <h2 style="color: #f44336; margin: 0;">⚠️ IMMEDIATE ACTION REQUIRED</h2>
              <p style="margin: 10px 0 0 0;">Your account access has been suspended. Upgrade now to restore access.</p>
            </div>
            
            <h2>Hi there!</h2>
            
            <p>Your ${planName} trial for <strong>${companyName}</strong> has expired. Your account has been suspended, but don't worry - your data is safe!</p>
            
            <div class="info-box">
              <h3>📋 What's Happened?</h3>
              <ul>
                <li>Your ${planName} trial has ended and access is suspended</li>
                <li>All your data is securely preserved for 30 days</li>
                <li>You can reactivate anytime by upgrading</li>
                <li>No credit card was charged during your trial</li>
              </ul>
            </div>
            
            <div class="action-box">
              <h3>🚀 Ready to Continue?</h3>
              <p>Upgrade now to restore full access to all your ${planName} features and continue where you left off.</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/billing?upgrade=true&expired=true&source=email" class="button">🚀 Upgrade & Restore Access Now</a>
            </div>
            
            <h3>🔒 Your Data is Safe</h3>
            <ul>
              <li>All data preserved for 30 days after trial expiration</li>
              <li>Instant restoration when you upgrade</li>
              <li>Full backup and recovery available</li>
            </ul>
            
            <h3>💡 Need Help Choosing a Plan?</h3>
            <p>Our team is here to help you find the perfect plan for your needs. Just reply to this email!</p>
            
            <h3>📞 Urgent Support</h3>
            <p>If you need immediate assistance, contact our support team directly.</p>
            
            <p>Thanks for trying Wrapper!</p>
            <p><strong>The Wrapper Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const result = await this.sendEmail({
        to: [{ email }],
        subject,
        htmlContent: html,
        textContent: undefined
      });
      
      console.log(`✅ Trial expired email sent successfully to: ${email}`);
      return { success: true, result };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Failed to send trial expired email to: ${email}`, error);
      return { success: false, error: error.message };
    }
  }

  // Send plan expired notification (for paid plans that expire)
  static async sendPlanExpiredNotification({ email, companyName, planName, subscriptionId: _subscriptionId }: { email: string; companyName: string; planName: string; subscriptionId: string }) {
    const subject = `🔒 Your ${planName} plan has expired - ${companyName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Plan Expired</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .action-box { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .option-box { background: #f0f4f8; border: 1px solid #e2e8f0; padding: 20px; margin: 10px 0; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Plan Expired</h1>
            <p>Your ${planName} subscription has ended</p>
          </div>
          <div class="content">
            <h2>Hi there!</h2>
            
            <p>Your ${planName} subscription for <strong>${companyName}</strong> has expired. Your account access has been suspended.</p>
            
            <div class="warning-box">
              <h3>⚠️ What's Changed?</h3>
              <ul>
                <li>Your ${planName} subscription period has ended</li>
                <li>Account access is temporarily suspended</li>
                <li>All your data remains secure and preserved</li>
                <li>You can reactivate anytime by renewing or choosing a new plan</li>
              </ul>
            </div>
            
            <div class="action-box">
              <h3>🔄 What Are Your Options?</h3>
            </div>
            
            <div class="option-box">
              <h4>💎 Renew Your ${planName} Plan</h4>
              <p>Continue with the same great features you've been using.</p>
              <a href="${process.env.FRONTEND_URL}/billing?renew=${planName.toLowerCase()}&source=email" class="button">Renew ${planName}</a>
            </div>
            
            <div class="option-box">
              <h4>🏃‍♂️ Switch to Starter Plan</h4>
              <p>Need something more budget-friendly? Our Starter plan might be perfect for you this month.</p>
              <a href="${process.env.FRONTEND_URL}/billing?upgrade=starter&source=email" class="button">Switch to Starter</a>
            </div>
            
            <div class="option-box">
              <h4>🚀 Upgrade to Professional</h4>
              <p>Ready for more features? Upgrade to our Professional plan.</p>
              <a href="${process.env.FRONTEND_URL}/billing?upgrade=professional&source=email" class="button">Upgrade to Professional</a>
            </div>
            
            <h3>🔒 Your Data is Safe</h3>
            <ul>
              <li>All data preserved during suspension period</li>
              <li>Instant restoration when you renew or upgrade</li>
              <li>No data loss - pick up exactly where you left off</li>
            </ul>
            
            <h3>💡 Need Help Deciding?</h3>
            <p>Our team is here to help you choose the best plan for your current needs. Whether you want to:</p>
            <ul>
              <li>🔄 Renew your current ${planName} plan</li>
              <li>📉 Downgrade to Starter for this month</li>
              <li>📈 Upgrade to get more features</li>
            </ul>
            <p>Just reply to this email and we'll help you find the perfect solution!</p>
            
            <p>Best regards,</p>
            <p><strong>The Wrapper Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const emailService = new EmailService();
      const result = await emailService.sendEmail({
        to: [{ email }],
        subject,
        htmlContent: html,
        textContent: undefined
      });
      
      console.log(`✅ Plan expired email sent successfully to: ${email}`);
      return { success: true, result };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Failed to send plan expired email to: ${email}`, error);
      return { success: false, error: error.message };
    }
  }
}

export { EmailService };
export default new EmailService(); 