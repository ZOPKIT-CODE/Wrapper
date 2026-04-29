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

// Shared CSS injected into every template's <style> block
// NOTE: Email-safe CSS — no gradients, no position:absolute, no filter, no ::before pseudo-elements.
// Gmail and most email clients strip these properties, causing broken layouts.
const SHARED_CSS = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background-color: #EFF6FF;
      padding: 40px 16px;
      color: #0D1B3E;
    }
    .wrapper {
      max-width: 620px;
      margin: 0 auto;
      border-radius: 16px;
      overflow: hidden;
    }
    /* Brand bar */
    .brand-bar {
      background-color: #0D1B3E;
      padding: 22px 36px;
      display: table;
      width: 100%;
    }
    .brand-logo {
      display: table-cell;
      height: 30px;
      width: auto;
      vertical-align: middle;
    }
    .brand-badge {
      display: table-cell;
      vertical-align: middle;
      text-align: right;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #93C5FD;
      background-color: rgba(255,255,255,0.10);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px;
      padding: 4px 12px;
      white-space: nowrap;
    }
    /* Hero */
    .hero {
      background-color: #0D1B3E;
      padding: 52px 40px 48px;
      text-align: center;
    }
    .hero-icon {
      font-size: 44px;
      display: block;
      margin-bottom: 20px;
    }
    .hero h1 {
      font-size: 28px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.4px;
      margin-bottom: 10px;
    }
    .hero-sub {
      font-size: 15px;
      color: #93C5FD;
      font-weight: 500;
    }
    /* Body card */
    .body-card {
      background-color: #ffffff;
      padding: 40px 40px 36px;
    }
    /* Section labels */
    .label {
      font-size: 11px;
      font-weight: 700;
      color: #2563EB;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 6px;
    }
    /* Info rows */
    .info-table { width:100%; border-collapse:collapse; margin:20px 0; }
    .info-table td { padding:12px 0; border-bottom:1px solid #EFF6FF; vertical-align:top; }
    .info-table tr:last-child td { border-bottom:none; }
    .info-label { width:40%; font-size:13px; color:#64748B; font-weight:500; }
    .info-value { font-size:14px; color:#0D1B3E; font-weight:600; }
    /* Highlight box */
    .highlight-box {
      background-color: #F8FAFF;
      border: 1px solid #DBEAFE;
      border-radius: 10px;
      padding: 20px 24px;
      margin: 20px 0;
    }
    .highlight-box .hl-label {
      font-size: 11px; font-weight:700; color:#2563EB;
      text-transform:uppercase; letter-spacing:0.6px; margin-bottom:8px;
    }
    .highlight-box .hl-value {
      font-size: 22px; font-weight:800; color:#0D1B3E;
    }
    /* CTA button */
    .cta { text-align:center; margin: 32px 0 24px; }
    .cta a {
      display: inline-block;
      padding: 16px 48px;
      background-color: #2563EB;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 0.2px;
    }
    .cta-note { margin-top:10px; font-size:12px; color:#94A3B8; text-align:center; }
    /* Alert strip */
    .alert-strip {
      border-radius: 8px;
      padding: 14px 18px;
      margin: 16px 0;
      font-size: 14px;
      font-weight: 500;
    }
    .alert-warning { background-color:#FFF7ED; border-left:4px solid #F97316; color:#C2410C; }
    .alert-danger  { background-color:#FFF1F2; border-left:4px solid #F43F5E; color:#BE123C; }
    .alert-success { background-color:#F0FDF4; border-left:4px solid #22C55E; color:#15803D; }
    .alert-info    { background-color:#F0F7FF; border-left:4px solid #2563EB; color:#1B2E5A; }
    /* Checklist */
    .checklist { list-style:none; margin:16px 0; padding:0; }
    .checklist li {
      padding: 9px 0 9px 0;
      font-size: 14px;
      color: #475569;
      border-bottom: 1px solid #EFF6FF;
    }
    .checklist li:last-child { border-bottom:none; }
    /* Body text */
    .body-card p {
      font-size: 15px;
      line-height: 1.75;
      color: #475569;
      margin-bottom: 18px;
    }
    .body-card p strong { color:#0D1B3E; }
    /* Footer */
    .footer {
      background-color: #0D1B3E;
      padding: 28px 36px;
      text-align: center;
    }
    .footer-logo { height:24px; width:auto; opacity:0.7; margin-bottom:14px; }
    .footer-divider { width:36px; height:2px; background-color:rgba(255,255,255,0.15); margin:12px auto; border-radius:2px; }
    .footer p { font-size:13px; color:#93C5FD; line-height:1.8; margin:0; }
    .footer strong { color:#ffffff; }
    .footer-copy { font-size:12px; color:rgba(147,197,253,0.7) !important; margin-top:6px !important; }
    /* Responsive */
    @media (max-width:600px) {
      body { padding:20px 10px; }
      .brand-bar { padding:18px 24px; }
      .hero { padding:36px 24px 32px; }
      .body-card { padding:28px 24px 24px; }
      .footer { padding:24px; }
      .cta a { padding:14px 32px; }
    }
`;

const LOGO_URL = 'https://res.cloudinary.com/dr9vzaa7u/image/upload/v1765126845/Zopkit_Full_Logo_kezq1b.jpg';

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

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Zopkit</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <!-- ① BRAND BAR -->
    <div class="brand-bar" style="background-color:#0D1B3E;padding:22px 36px;">
      <img src="${LOGO_URL}" alt="Zopkit" class="brand-logo" style="height:30px;width:auto;">
      <span class="brand-badge" style="color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Welcome</span>
    </div>

    <!-- ② HERO -->
    <div class="hero" style="background-color:#0D1B3E;padding:52px 40px 48px;text-align:center;">
      <div class="hero-icon" style="font-size:44px;margin-bottom:20px;">🎉</div>
      <h1>Welcome to Zopkit!</h1>
      <p class="hero-sub" style="font-size:15px;color:#93C5FD;font-weight:500;margin:0;">Your workspace is live and ready</p>
    </div>

    <!-- ③ BODY -->
    <div class="body-card" style="background-color:#ffffff;padding:40px 40px 36px;">
      <p>Hi <strong>${name}</strong>, your account for <strong>${companyName}</strong> has been created and is ready to use.</p>

      <table class="info-table">
        <tr>
          <td class="info-label">Organization</td>
          <td class="info-value">${companyName}</td>
        </tr>
        <tr>
          <td class="info-label">Workspace</td>
          <td class="info-value">${subdomain}.zopkit.com</td>
        </tr>
        <tr>
          <td class="info-label">Email</td>
          <td class="info-value">${email}</td>
        </tr>
      </table>

      <div class="highlight-box">
        <div class="hl-label">Your Login Link</div>
        <div class="hl-value" style="font-size:14px;word-break:break-all;">
          <a href="${loginUrl}" style="color:#2563EB;text-decoration:none;font-weight:700;">${loginUrl}</a>
        </div>
      </div>

      <div class="cta" style="text-align:center;margin:32px 0 24px;">
        <a style="display:inline-block;padding:16px 48px;background-color:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;" href="${loginUrl}">Go to Your Dashboard</a>
        <div class="cta-note">🔒 Secure SSO login · No password required</div>
      </div>

      <ul class="checklist">
        <li>Complete your organization profile</li>
        <li>Invite your team members</li>
        <li>Explore your applications</li>
        <li>Set up roles and permissions</li>
      </ul>
    </div>

    <!-- ④ FOOTER -->
    <div class="footer" style="background-color:#0D1B3E;padding:28px 36px;text-align:center;">
      <img src="${LOGO_URL}" alt="Zopkit" class="footer-logo" style="height:24px;width:auto;opacity:0.7;margin-bottom:14px;">
      <div class="footer-divider"></div>
      <p>Questions? We're here to help — reply to this email.</p>
      <p class="footer-copy">Powered by <strong>Zopkit</strong> — Your AI-first business operating system</p>
    </div>
  </div>
</body>
</html>`;

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
            background-color: #EFF6FF;
            padding: 32px 16px;
            min-height: 100vh;
          }
          .container {
            max-width: 620px;
            margin: 0 auto;
          }
          /* ── Top brand bar ── */
          .brand-bar {
            background-color: #0D1B3E;
            border-radius: 16px 16px 0 0;
            padding: 28px 40px;
            display: table;
            width: 100%;
          }
          .brand-bar-inner {
            display: table-row;
          }
          .brand-logo-cell {
            display: table-cell;
            vertical-align: middle;
          }
          .brand-logo-cell img {
            height: 36px;
            width: auto;
            display: block;
          }
          .brand-badge-cell {
            display: table-cell;
            vertical-align: middle;
            text-align: right;
          }
          .brand-badge {
            display: inline-block;
            background-color: rgba(255,255,255,0.12);
            color: #93C5FD;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            padding: 5px 14px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.15);
          }
          /* ── Hero section ── */
          .hero {
            background-color: #0D1B3E;
            padding: 52px 40px 48px;
            text-align: center;
          }
          .hero-icon {
            display: inline-block;
            width: 68px; height: 68px;
            line-height: 68px;
            text-align: center;
            background-color: rgba(255,255,255,0.10);
            border: 2px solid rgba(255,255,255,0.15);
            border-radius: 20px;
            margin-bottom: 24px;
            font-size: 28px;
          }
          .hero h1 {
            font-size: 30px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -0.5px;
            margin-bottom: 10px;
          }
          .hero p {
            font-size: 16px;
            color: #93C5FD;
            font-weight: 500;
          }
          /* ── Card body ── */
          .card-body {
            background: #ffffff;
            padding: 40px 40px 32px;
          }
          /* ── Inviter chip ── */
          .inviter-chip {
            display: inline-block;
            background-color: #EFF6FF;
            border: 1px solid #BFDBFE;
            border-radius: 24px;
            padding: 6px 14px 6px 8px;
            margin-bottom: 28px;
          }
          .inviter-avatar {
            width: 28px; height: 28px;
            background-color: #0D1B3E;
            border-radius: 50%;
            display: inline-block;
            text-align: center;
            line-height: 28px;
            color: white;
            font-size: 12px;
            font-weight: 700;
          }
          .inviter-chip span {
            font-size: 13px;
            font-weight: 600;
            color: #1B2E5A;
          }
          /* ── Headline ── */
          .card-headline {
            font-size: 22px;
            font-weight: 800;
            color: #0D1B3E;
            margin-bottom: 8px;
            letter-spacing: -0.3px;
          }
          .card-subline {
            font-size: 15px;
            color: #64748b;
            margin-bottom: 32px;
            line-height: 1.6;
          }
          /* ── Detail grid ── */
          .details-grid {
            display: table;
            width: 100%;
            border-collapse: separate;
            border-spacing: 12px;
            margin: 0 -12px 24px;
          }
          .details-row { display: table-row; }
          .detail-item {
            display: table-cell;
            width: 50%;
            background: #F8FAFF;
            border: 1px solid #DBEAFE;
            border-radius: 10px;
            padding: 16px 18px;
            vertical-align: top;
          }
          .detail-label {
            font-size: 11px;
            font-weight: 700;
            color: #2563EB;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-bottom: 5px;
          }
          .detail-value {
            font-size: 14px;
            font-weight: 600;
            color: #0D1B3E;
          }
          .role-badge {
            display: inline-block;
            background-color: #0D1B3E;
            color: #ffffff;
            padding: 6px 14px;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.3px;
          }
          .organization-list {
            background-color: #fafbfc;
            border: 2px solid #e5e7eb;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.4px;
            padding: 4px 12px;
            border-radius: 20px;
          }
          /* ── Entity list ── */
          .entity-list {
            background: #F8FAFF;
            border: 1px solid #DBEAFE;
            border-radius: 10px;
            padding: 16px 20px;
            margin: 0 0 20px;
          }
          .entity-list-title {
            font-size: 12px;
            font-weight: 700;
            color: #2563EB;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-bottom: 10px;
          }
          .entity-item {
            display: table;
            width: 100%;
            padding: 8px 0;
            border-bottom: 1px solid #DBEAFE;
          }
          .entity-item:last-child { border-bottom: none; padding-bottom: 0; }
          .entity-dot {
            display: table-cell;
            vertical-align: middle;
            width: 20px;
          }
          .entity-dot-inner {
            width: 7px; height: 7px;
            background: #2563EB;
            border-radius: 50%;
          }
          .entity-name {
            display: table-cell;
            vertical-align: middle;
            font-size: 14px;
            font-weight: 600;
            color: #1B2E5A;
          }
          /* ── Personal message ── */
          .message-section {
            background: #F0F7FF;
            border-left: 4px solid #2563EB;
            border-radius: 0 8px 8px 0;
            padding: 16px 20px;
            margin: 0 0 24px;
          }
          .message-label {
            font-size: 11px;
            font-weight: 700;
            color: #2563EB;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-bottom: 6px;
          }
          .message-text {
            font-size: 14px;
            color: #1B2E5A;
            font-style: italic;
            line-height: 1.6;
          }
          /* ── Expiry ── */
          .expiry-notice {
            display: table;
            width: 100%;
            background: #FFF7ED;
            border: 1px solid #FED7AA;
            border-radius: 8px;
            padding: 12px 16px;
            margin: 0 0 28px;
          }
          .expiry-icon { display: table-cell; vertical-align: middle; width: 24px; font-size: 16px; }
          .expiry-text {
            display: table-cell;
            vertical-align: middle;
            font-size: 13px;
            color: #C2410C;
            font-weight: 500;
          }
          /* ── CTA ── */
          .cta-section { text-align: center; margin: 0 0 32px; }
          .cta-button {
            display: inline-block;
            padding: 16px 48px;
            background-color: #2563EB;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 700;
            font-size: 15px;
            letter-spacing: 0.2px;
          }
          .cta-note {
            margin-top: 12px;
            font-size: 12px;
            color: #94A3B8;
          }
          /* ── Feature strip ── */
          .feature-strip {
            display: table;
            width: 100%;
            border-top: 1px solid #EFF6FF;
            padding-top: 24px;
            margin-bottom: 0;
          }
          .feature-cell {
            display: table-cell;
            width: 25%;
            text-align: center;
            padding: 0 8px;
            vertical-align: top;
          }
          .feature-icon-wrap {
            display: inline-block;
            width: 40px; height: 40px;
            background-color: #0D1B3E;
            border-radius: 10px;
            margin-bottom: 8px;
            font-size: 18px;
            text-align: center;
            line-height: 40px;
          }
          .feature-label {
            font-size: 12px;
            color: #64748B;
            font-weight: 500;
            line-height: 1.4;
          }
          /* ── Footer ── */
          .footer {
            background-color: #0D1B3E;
            border-radius: 0 0 16px 16px;
            padding: 28px 40px;
            text-align: center;
          }
          .footer p {
            color: #93C5FD;
            font-size: 13px;
            line-height: 1.8;
            margin: 0;
          }
          .footer strong { color: #ffffff; }
          .footer-divider {
            width: 40px; height: 2px;
            background: rgba(255,255,255,0.15);
            margin: 16px auto;
            border-radius: 2px;
          }
          /* ── Responsive ── */
          @media (max-width: 600px) {
            body { padding: 16px 10px; }
            .brand-bar { padding: 20px 24px; }
            .hero { padding: 36px 24px 32px; }
            .card-body { padding: 28px 24px 24px; }
            .footer { padding: 24px; }
            .detail-item { display: block; width: 100%; margin-bottom: 10px; }
            .feature-cell { display: block; width: 50%; float: left; margin-bottom: 16px; }
          }
        </style>
      </head>
      <body>
        <div class="container">

          <!-- Brand bar -->
          <div class="brand-bar" style="background-color:#0D1B3E;padding:28px 40px;border-radius:16px 16px 0 0;">
            <div class="brand-bar-inner">
              <div class="brand-logo-cell">
                <img src="${LOGO_URL}" alt="Zopkit" style="height:32px;width:auto;display:block;">
              </div>
              <div class="brand-badge-cell">
                <span class="brand-badge">Team Invitation</span>
              </div>
            </div>
          </div>

          <!-- Hero -->
          <div class="hero" style="background-color:#0D1B3E;padding:52px 40px 48px;text-align:center;">
            <div class="hero-icon" style="font-size:44px;margin-bottom:20px;">&#128100;</div>
            <h1>You're Invited!</h1>
            <p>Join <strong style="color:#ffffff;">${tenantName}</strong> on Zopkit</p>
          </div>

          <!-- Card body -->
          <div class="card-body">

            <!-- Inviter chip -->
            <div class="inviter-chip">
              <div class="inviter-avatar">${invitedByName.charAt(0).toUpperCase()}</div>
              <span>${invitedByName} invited you</span>
            </div>

            <div class="card-headline">Welcome to the team</div>
            <div class="card-subline">
              You've been personally invited to collaborate with <strong>${tenantName}</strong>.
              Accept below to get started immediately.
            </div>

            <!-- Details grid (table-based for email clients) -->
            <table class="details-grid" cellpadding="0" cellspacing="0">
              <tr class="details-row">
                <td class="detail-item">
                  <div class="detail-label">Organisation</div>
                  <div class="detail-value">${primaryOrganizationName || (organizations && organizations.length > 0 ? organizations[0] : tenantName)}</div>
                </td>
                <td style="width:12px;"></td>
                <td class="detail-item">
                  <div class="detail-label">Your Role</div>
                  <div class="detail-value"><span class="role-badge">${roleName}</span></div>
                </td>
              </tr>
              <tr><td colspan="3" style="height:12px;"></td></tr>
              <tr class="details-row">
                <td class="detail-item">
                  <div class="detail-label">Invited On</div>
                  <div class="detail-value">${invitedDateFormatted}</div>
                </td>
                <td style="width:12px;"></td>
                <td class="detail-item">
                  <div class="detail-label">Expires</div>
                  <div class="detail-value">${expiryDateFormatted}</div>
                </td>
              </tr>
            </table>

            ${organizations && organizations.length > 1 ? `
            <div class="entity-list">
              <div class="entity-list-title">Access to Organisations</div>
              ${organizations.map((org: string) => `
                <div class="entity-item">
                  <div class="entity-dot"><div class="entity-dot-inner"></div></div>
                  <div class="entity-name">${org}</div>
                </div>
              `).join('')}
            </div>
            ` : ''}

            ${locations && locations.length > 0 ? `
            <div class="entity-list">
              <div class="entity-list-title">Access to Locations</div>
              ${locations.map((loc: string) => `
                <div class="entity-item">
                  <div class="entity-dot"><div class="entity-dot-inner"></div></div>
                  <div class="entity-name">${loc}</div>
                </div>
              `).join('')}
            </div>
            ` : ''}

            ${message ? `
            <div class="message-section">
              <div class="message-label">Personal message</div>
              <div class="message-text">"${message}"</div>
            </div>
            ` : ''}

            <!-- Expiry notice -->
            <div class="expiry-notice">
              <div class="expiry-icon">&#9201;</div>
              <div class="expiry-text">
                <strong>Expires ${expiryDateFormatted}</strong> — accept before then to secure your access.
              </div>
            </div>

            <!-- CTA -->
            <div class="cta-section">
              <a href="${acceptUrl}" class="cta-button" style="display:inline-block;padding:16px 48px;background-color:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Accept Invitation &amp; Join Team</a>
              <div class="cta-note">&#128274; Secure sign-in &bull; No password required &bull; Takes less than 60 seconds</div>
            </div>

            <!-- Feature strip -->
            <div class="feature-strip">
              <div class="feature-cell">
                <div class="feature-icon-wrap">&#128202;</div>
                <div class="feature-label">CRM &amp; Business Tools</div>
              </div>
              <div class="feature-cell">
                <div class="feature-icon-wrap">&#129309;</div>
                <div class="feature-label">Team Collaboration</div>
              </div>
              <div class="feature-cell">
                <div class="feature-icon-wrap">&#128200;</div>
                <div class="feature-label">Analytics &amp; Reporting</div>
              </div>
              <div class="feature-cell">
                <div class="feature-icon-wrap">&#128274;</div>
                <div class="feature-label">Secure Workspace</div>
              </div>
            </div>

          </div><!-- /card-body -->

          <!-- Footer -->
          <div class="footer" style="background-color:#0D1B3E;padding:28px 40px;text-align:center;border-radius:0 0 16px 16px;">
            <p style="color:#93C5FD;font-size:13px;line-height:1.8;margin:0;">Questions? Reach out to <strong style="color:#ffffff;">${invitedByName}</strong> or reply to this email.</p>
            <div class="footer-divider"></div>
            <p>Powered by <strong>Zopkit</strong> &bull; Your AI-first business operating system</p>
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

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Usage Alert</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <!-- ① BRAND BAR -->
    <div class="brand-bar" style="background-color:#0D1B3E;padding:22px 36px;">
      <img src="${LOGO_URL}" alt="Zopkit" class="brand-logo" style="height:30px;width:auto;">
      <span class="brand-badge" style="color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Usage Alert</span>
    </div>

    <!-- ② HERO -->
    <div class="hero" style="background-color:#0D1B3E;padding:52px 40px 48px;text-align:center;">
      <div class="hero-icon" style="font-size:44px;margin-bottom:20px;">⚠️</div>
      <h1>Credit Usage Warning</h1>
      <p class="hero-sub" style="font-size:15px;color:#93C5FD;font-weight:500;margin:0;">Your ${metricType} usage has reached ${percentage}%</p>
    </div>

    <!-- ③ BODY -->
    <div class="body-card" style="background-color:#ffffff;padding:40px 40px 36px;">
      <div class="alert-strip alert-warning">
        <strong>${tenantName}</strong> has used <strong>${percentage}%</strong> of its ${metricType} limit.
      </div>

      <table class="info-table">
        <tr>
          <td class="info-label">Metric Type</td>
          <td class="info-value">${metricType}</td>
        </tr>
        <tr>
          <td class="info-label">Current Usage</td>
          <td class="info-value">${currentValue}</td>
        </tr>
        <tr>
          <td class="info-label">Limit</td>
          <td class="info-value">${limitValue}</td>
        </tr>
        <tr>
          <td class="info-label">Usage</td>
          <td class="info-value">${percentage}%</td>
        </tr>
        <tr>
          <td class="info-label">Alert Type</td>
          <td class="info-value">${alertType}</td>
        </tr>
      </table>

      <div class="highlight-box">
        <div class="hl-label">Usage Percentage</div>
        <div class="hl-value">${percentage}%</div>
      </div>

      <div class="cta" style="text-align:center;margin:32px 0 24px;">
        <a style="display:inline-block;padding:16px 48px;background-color:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;" href="${process.env.FRONTEND_URL}/dashboard/billing">Manage Plan &amp; Credits</a>
      </div>

      <ul class="checklist">
        <li>Review your current usage on the dashboard</li>
        <li>Consider upgrading for higher limits</li>
        <li>Purchase additional credits if needed</li>
        <li>Optimise usage patterns to reduce consumption</li>
      </ul>
    </div>

    <!-- ④ FOOTER -->
    <div class="footer" style="background-color:#0D1B3E;padding:28px 36px;text-align:center;">
      <img src="${LOGO_URL}" alt="Zopkit" class="footer-logo" style="height:24px;width:auto;opacity:0.7;margin-bottom:14px;">
      <div class="footer-divider"></div>
      <p>This alert was sent because usage exceeded a configured threshold.</p>
      <p class="footer-copy">Powered by <strong>Zopkit</strong> — Your AI-first business operating system</p>
    </div>
  </div>
</body>
</html>`;

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

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Updated</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <!-- ① BRAND BAR -->
    <div class="brand-bar" style="background-color:#0D1B3E;padding:22px 36px;">
      <img src="${LOGO_URL}" alt="Zopkit" class="brand-logo" style="height:30px;width:auto;">
      <span class="brand-badge" style="color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Plan Change</span>
    </div>

    <!-- ② HERO -->
    <div class="hero" style="background-color:#0D1B3E;padding:52px 40px 48px;text-align:center;">
      <div class="hero-icon" style="font-size:44px;margin-bottom:20px;">📋</div>
      <h1>Subscription Updated</h1>
      <p class="hero-sub" style="font-size:15px;color:#93C5FD;font-weight:500;margin:0;">Your plan change has been confirmed</p>
    </div>

    <!-- ③ BODY -->
    <div class="body-card" style="background-color:#ffffff;padding:40px 40px 36px;">
      <p>Your Zopkit subscription has been successfully changed.</p>

      <table class="info-table">
        <tr>
          <td class="info-label">Previous Plan</td>
          <td class="info-value">${fromPlan} Plan</td>
        </tr>
        <tr>
          <td class="info-label">New Plan</td>
          <td class="info-value">${toPlan} Plan</td>
        </tr>
        <tr>
          <td class="info-label">Effective Date</td>
          <td class="info-value">${new Date(effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
        </tr>
      </table>

      ${refundAmount > 0 ? `
      <div class="alert-strip alert-success">
        A prorated refund of <strong>$${refundAmount.toFixed(2)} USD</strong> will appear in your account within 5–10 business days.
      </div>
      ` : ''}

      <div class="cta" style="text-align:center;margin:32px 0 24px;">
        <a style="display:inline-block;padding:16px 48px;background-color:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;" href="${process.env.FRONTEND_URL}/dashboard/billing">View Billing Details</a>
      </div>

      <ul class="checklist">
        <li>Your new plan features are now active</li>
        <li>Previous plan features remain until the effective date</li>
        <li>You can upgrade again at any time</li>
      </ul>
    </div>

    <!-- ④ FOOTER -->
    <div class="footer" style="background-color:#0D1B3E;padding:28px 36px;text-align:center;">
      <img src="${LOGO_URL}" alt="Zopkit" class="footer-logo" style="height:24px;width:auto;opacity:0.7;margin-bottom:14px;">
      <div class="footer-divider"></div>
      <p>Need help choosing the right plan? Contact our team.</p>
      <p class="footer-copy">Powered by <strong>Zopkit</strong> — Your AI-first business operating system</p>
    </div>
  </div>
</body>
</html>`;

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

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <!-- ① BRAND BAR -->
    <div class="brand-bar" style="background-color:#0D1B3E;padding:22px 36px;">
      <img src="${LOGO_URL}" alt="Zopkit" class="brand-logo" style="height:30px;width:auto;">
      <span class="brand-badge" style="color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Payment Alert</span>
    </div>

    <!-- ② HERO -->
    <div class="hero" style="background-color:#0D1B3E;padding:52px 40px 48px;text-align:center;">
      <div class="hero-icon" style="font-size:44px;margin-bottom:20px;">❌</div>
      <h1>Payment Failed</h1>
      <p class="hero-sub" style="font-size:15px;color:#93C5FD;font-weight:500;margin:0;">Action required to maintain your subscription</p>
    </div>

    <!-- ③ BODY -->
    <div class="body-card" style="background-color:#ffffff;padding:40px 40px 36px;">
      <div class="alert-strip alert-danger">
        We were unable to process your payment. Please update your payment method to avoid service interruption.
      </div>

      <table class="info-table">
        <tr>
          <td class="info-label">Amount</td>
          <td class="info-value">${amount} ${currency}</td>
        </tr>
        <tr>
          <td class="info-label">Failure Reason</td>
          <td class="info-value">${failureReason}</td>
        </tr>
        <tr>
          <td class="info-label">Next Attempt</td>
          <td class="info-value">${nextAttempt ? new Date(nextAttempt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</td>
        </tr>
      </table>

      <div class="cta" style="text-align:center;margin:32px 0 24px;">
        <a style="display:inline-block;padding:16px 48px;background-color:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;" href="${process.env.FRONTEND_URL}/dashboard/billing">Update Payment Method</a>
      </div>

      <ul class="checklist">
        <li>Update your card details in the billing settings</li>
        <li>Ensure sufficient funds are available</li>
        <li>Contact your bank if the issue persists</li>
        <li>Reach out to Zopkit support for help</li>
      </ul>
    </div>

    <!-- ④ FOOTER -->
    <div class="footer" style="background-color:#0D1B3E;padding:28px 36px;text-align:center;">
      <img src="${LOGO_URL}" alt="Zopkit" class="footer-logo" style="height:24px;width:auto;opacity:0.7;margin-bottom:14px;">
      <div class="footer-divider"></div>
      <p>Your service will be paused if payment is not resolved within 7 days.</p>
      <p class="footer-copy">Powered by <strong>Zopkit</strong> — Your AI-first business operating system</p>
    </div>
  </div>
</body>
</html>`;

    return await this.sendEmail({
      to: [{ email: 'admin@example.com' }],
      subject,
      htmlContent: html,
      textContent: undefined
    });
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

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Dispute Filed</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <!-- ① BRAND BAR -->
    <div class="brand-bar" style="background-color:#0D1B3E;padding:22px 36px;">
      <img src="${LOGO_URL}" alt="Zopkit" class="brand-logo" style="height:30px;width:auto;">
      <span class="brand-badge" style="color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Dispute Notice</span>
    </div>

    <!-- ② HERO -->
    <div class="hero" style="background-color:#0D1B3E;padding:52px 40px 48px;text-align:center;">
      <div class="hero-icon" style="font-size:44px;margin-bottom:20px;">⚖️</div>
      <h1>Payment Dispute Filed</h1>
      <p class="hero-sub" style="font-size:15px;color:#93C5FD;font-weight:500;margin:0;">A dispute has been raised on your account</p>
    </div>

    <!-- ③ BODY -->
    <div class="body-card" style="background-color:#ffffff;padding:40px 40px 36px;">
      <div class="alert-strip alert-warning">
        A payment dispute has been filed. Please review the details and provide evidence promptly.
      </div>

      <table class="info-table">
        <tr>
          <td class="info-label">Dispute ID</td>
          <td class="info-value">${disputeId}</td>
        </tr>
        <tr>
          <td class="info-label">Amount</td>
          <td class="info-value">${amount} ${currency}</td>
        </tr>
        <tr>
          <td class="info-label">Reason</td>
          <td class="info-value">${reason}</td>
        </tr>
        <tr>
          <td class="info-label">Evidence Due</td>
          <td class="info-value">${evidenceDueBy ? new Date(evidenceDueBy).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Contact support'}</td>
        </tr>
      </table>

      <div class="cta" style="text-align:center;margin:32px 0 24px;">
        <a style="display:inline-block;padding:16px 48px;background-color:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;" href="${process.env.FRONTEND_URL}/dashboard/billing">Respond to Dispute</a>
      </div>

      <ul class="checklist">
        <li>Gather transaction evidence and receipts</li>
        <li>Submit documentation before the deadline</li>
        <li>Contact Zopkit support for guidance</li>
        <li>Review your Stripe dashboard for details</li>
      </ul>
    </div>

    <!-- ④ FOOTER -->
    <div class="footer" style="background-color:#0D1B3E;padding:28px 36px;text-align:center;">
      <img src="${LOGO_URL}" alt="Zopkit" class="footer-logo" style="height:24px;width:auto;opacity:0.7;margin-bottom:14px;">
      <div class="footer-divider"></div>
      <p>Disputes must be responded to within the deadline to avoid automatic charge reversal.</p>
      <p class="footer-copy">Powered by <strong>Zopkit</strong> — Your AI-first business operating system</p>
    </div>
  </div>
</body>
</html>`;

    return await this.sendEmail({
      to: [{ email: 'admin@example.com' }],
      subject,
      htmlContent: html,
      textContent: undefined
    });
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

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <!-- ① BRAND BAR -->
    <div class="brand-bar" style="background-color:#0D1B3E;padding:22px 36px;">
      <img src="${LOGO_URL}" alt="Zopkit" class="brand-logo" style="height:30px;width:auto;">
      <span class="brand-badge" style="color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Payment Confirmed</span>
    </div>

    <!-- ② HERO -->
    <div class="hero" style="background-color:#0D1B3E;padding:52px 40px 48px;text-align:center;">
      <div class="hero-icon" style="font-size:44px;margin-bottom:20px;">✅</div>
      <h1>Payment Successful</h1>
      <p class="hero-sub" style="font-size:15px;color:#93C5FD;font-weight:500;margin:0;">Thank you for your payment</p>
    </div>

    <!-- ③ BODY -->
    <div class="body-card" style="background-color:#ffffff;padding:40px 40px 36px;">
      <div class="alert-strip alert-success">
        Your payment has been processed successfully. A receipt has been sent to your email.
      </div>

      <div class="highlight-box">
        <div class="hl-label">Amount Paid</div>
        <div class="hl-value">${formattedAmount}</div>
      </div>

      <table class="info-table">
        <tr>
          <td class="info-label">Transaction ID</td>
          <td class="info-value">${transactionId || sessionId || 'N/A'}</td>
        </tr>
        <tr>
          <td class="info-label">Payment Type</td>
          <td class="info-value">${isSubscription ? `${planName} Subscription` : isCreditPurchase ? 'Credit Purchase' : paymentType}</td>
        </tr>
        ${isSubscription ? `
        <tr>
          <td class="info-label">Billing Cycle</td>
          <td class="info-value">${billingCycle === 'yearly' ? 'Annual' : 'Monthly'}</td>
        </tr>
        ` : ''}
        ${isCreditPurchase && creditsAdded ? `
        <tr>
          <td class="info-label">Credits Added</td>
          <td class="info-value">${creditsAdded.toLocaleString()} credits</td>
        </tr>
        ` : ''}
        <tr>
          <td class="info-label">Payment Method</td>
          <td class="info-value">Card</td>
        </tr>
        <tr>
          <td class="info-label">Date</td>
          <td class="info-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
        </tr>
      </table>

      <div class="cta" style="text-align:center;margin:32px 0 24px;">
        <a style="display:inline-block;padding:16px 48px;background-color:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;" href="${process.env.FRONTEND_URL}/dashboard">View Dashboard</a>
      </div>

      ${isSubscription ? `
      <ul class="checklist">
        <li>All premium features are now active</li>
        <li>Access your upgraded workspace immediately</li>
        <li>Priority support is enabled for your plan</li>
      </ul>
      ` : isCreditPurchase && creditsAdded ? `
      <ul class="checklist">
        <li>${creditsAdded.toLocaleString()} credits added to your account</li>
        <li>Credits are available immediately</li>
        <li>Use across all Zopkit applications</li>
      </ul>
      ` : ''}
    </div>

    <!-- ④ FOOTER -->
    <div class="footer" style="background-color:#0D1B3E;padding:28px 36px;text-align:center;">
      <img src="${LOGO_URL}" alt="Zopkit" class="footer-logo" style="height:24px;width:auto;opacity:0.7;margin-bottom:14px;">
      <div class="footer-divider"></div>
      <p>Keep this email as your receipt. VAT/GST receipts available in billing settings.</p>
      <p class="footer-copy">Powered by <strong>Zopkit</strong> — Your AI-first business operating system</p>
    </div>
  </div>
</body>
</html>`;

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

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refund Confirmed</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <!-- ① BRAND BAR -->
    <div class="brand-bar" style="background-color:#0D1B3E;padding:22px 36px;">
      <img src="${LOGO_URL}" alt="Zopkit" class="brand-logo" style="height:30px;width:auto;">
      <span class="brand-badge" style="color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Refund Processed</span>
    </div>

    <!-- ② HERO -->
    <div class="hero" style="background-color:#0D1B3E;padding:52px 40px 48px;text-align:center;">
      <div class="hero-icon" style="font-size:44px;margin-bottom:20px;">💸</div>
      <h1>Refund Confirmed</h1>
      <p class="hero-sub" style="font-size:15px;color:#93C5FD;font-weight:500;margin:0;">Your refund has been processed</p>
    </div>

    <!-- ③ BODY -->
    <div class="body-card" style="background-color:#ffffff;padding:40px 40px 36px;">
      <div class="alert-strip alert-success">
        Your refund has been successfully processed and is on its way.
      </div>

      <table class="info-table">
        <tr>
          <td class="info-label">Refund ID</td>
          <td class="info-value">${refundId}</td>
        </tr>
        <tr>
          <td class="info-label">Amount</td>
          <td class="info-value">${amount} ${currency}</td>
        </tr>
        <tr>
          <td class="info-label">Reason</td>
          <td class="info-value">${reason}</td>
        </tr>
        <tr>
          <td class="info-label">Processed On</td>
          <td class="info-value">${new Date(processedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
        </tr>
      </table>

      <div class="highlight-box">
        <div class="hl-label">Refund Amount</div>
        <div class="hl-value">${amount} ${currency}</div>
      </div>

      <p>Refunds typically take <strong>5–10 business days</strong> to appear in your account, depending on your bank.</p>

      <div class="cta" style="text-align:center;margin:32px 0 24px;">
        <a style="display:inline-block;padding:16px 48px;background-color:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;" href="${process.env.FRONTEND_URL}/dashboard/billing">View Billing History</a>
      </div>
    </div>

    <!-- ④ FOOTER -->
    <div class="footer" style="background-color:#0D1B3E;padding:28px 36px;text-align:center;">
      <img src="${LOGO_URL}" alt="Zopkit" class="footer-logo" style="height:24px;width:auto;opacity:0.7;margin-bottom:14px;">
      <div class="footer-divider"></div>
      <p>If you don't see the refund within 10 business days, contact your bank or reach out to us.</p>
      <p class="footer-copy">Powered by <strong>Zopkit</strong> — Your AI-first business operating system</p>
    </div>
  </div>
</body>
</html>`;

    return await this.sendEmail({
      to: [{ email: 'admin@example.com' }],
      subject,
      htmlContent: html,
      textContent: undefined
    });
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
          .header { background-color: #dc2626; color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .urgency-banner { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 30px; border-radius: 4px; }
          .urgency-banner h2 { color: #dc2626; margin: 0 0 10px 0; font-size: 20px; }
          .countdown { text-align: center; background-color: #dc2626; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .countdown .time { font-size: 36px; font-weight: bold; }
          .countdown .label { font-size: 14px; opacity: 0.9; }
          .cta { text-align: center; margin: 30px 0; }
          .cta-button { display: inline-block; background-color: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
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
          .header { background-color: #6b7280; color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .status-banner { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 30px; border-radius: 4px; }
          .status-banner h2 { color: #dc2626; margin: 0 0 10px 0; font-size: 20px; }
          .cta { text-align: center; margin: 30px 0; }
          .cta-button { display: inline-block; background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
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
          .header { background-color: #2563eb; color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .metrics { margin: 20px 0; }
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

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Trial is Ending Soon</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <!-- ① BRAND BAR -->
    <div class="brand-bar" style="background-color:#0D1B3E;padding:22px 36px;">
      <img src="${LOGO_URL}" alt="Zopkit" class="brand-logo" style="height:30px;width:auto;">
      <span class="brand-badge" style="color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Trial Reminder</span>
    </div>

    <!-- ② HERO -->
    <div class="hero" style="background-color:#0D1B3E;padding:52px 40px 48px;text-align:center;">
      <div class="hero-icon" style="font-size:44px;margin-bottom:20px;">⏰</div>
      <h1>Your Trial is Ending Soon</h1>
      <p class="hero-sub" style="font-size:15px;color:#93C5FD;font-weight:500;margin:0;">Upgrade now to keep all your features</p>
    </div>

    <!-- ③ BODY -->
    <div class="body-card" style="background-color:#ffffff;padding:40px 40px 36px;">
      <p>Your <strong>${planName}</strong> trial is ending on <strong>${new Date(expirationDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>.</p>

      <div class="alert-strip alert-warning">
        After your trial ends, access to premium features will be restricted. Upgrade now to continue without interruption.
      </div>

      <table class="info-table">
        <tr>
          <td class="info-label">Plan</td>
          <td class="info-value">${planName}</td>
        </tr>
        <tr>
          <td class="info-label">Trial Expires</td>
          <td class="info-value">${new Date(expirationDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
        </tr>
        <tr>
          <td class="info-label">Subscription ID</td>
          <td class="info-value">${_subscriptionId}</td>
        </tr>
      </table>

      <div class="cta" style="text-align:center;margin:32px 0 24px;">
        <a style="display:inline-block;padding:16px 48px;background-color:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;" href="${process.env.FRONTEND_URL}/dashboard/billing">Upgrade Your Plan</a>
      </div>

      <ul class="checklist">
        <li>Choose the plan that fits your team</li>
        <li>Keep all your data and settings</li>
        <li>Continue using all premium features</li>
        <li>Cancel anytime — no lock-in</li>
      </ul>
    </div>

    <!-- ④ FOOTER -->
    <div class="footer" style="background-color:#0D1B3E;padding:28px 36px;text-align:center;">
      <img src="${LOGO_URL}" alt="Zopkit" class="footer-logo" style="height:24px;width:auto;opacity:0.7;margin-bottom:14px;">
      <div class="footer-divider"></div>
      <p>Questions about pricing? Reply to this email or visit our pricing page.</p>
      <p class="footer-copy">Powered by <strong>Zopkit</strong> — Your AI-first business operating system</p>
    </div>
  </div>
</body>
</html>`;

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

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Trial Has Ended</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <!-- ① BRAND BAR -->
    <div class="brand-bar" style="background-color:#0D1B3E;padding:22px 36px;">
      <img src="${LOGO_URL}" alt="Zopkit" class="brand-logo" style="height:30px;width:auto;">
      <span class="brand-badge" style="color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Trial Ended</span>
    </div>

    <!-- ② HERO -->
    <div class="hero" style="background-color:#0D1B3E;padding:52px 40px 48px;text-align:center;">
      <div class="hero-icon" style="font-size:44px;margin-bottom:20px;">🔒</div>
      <h1>Your Trial Has Ended</h1>
      <p class="hero-sub" style="font-size:15px;color:#93C5FD;font-weight:500;margin:0;">Reactivate to regain full access</p>
    </div>

    <!-- ③ BODY -->
    <div class="body-card" style="background-color:#ffffff;padding:40px 40px 36px;">
      <div class="alert-strip alert-danger">
        Your <strong>${planName}</strong> trial has expired. Your data is safe — simply upgrade to regain full access.
      </div>

      <p>We hope you enjoyed exploring Zopkit. To continue using all features, please select a plan.</p>

      <table class="info-table">
        <tr>
          <td class="info-label">Plan</td>
          <td class="info-value">${planName}</td>
        </tr>
        <tr>
          <td class="info-label">Subscription ID</td>
          <td class="info-value">${_subscriptionId}</td>
        </tr>
        <tr>
          <td class="info-label">Status</td>
          <td class="info-value">Trial Ended</td>
        </tr>
      </table>

      <div class="cta" style="text-align:center;margin:32px 0 24px;">
        <a style="display:inline-block;padding:16px 48px;background-color:#2563EB;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;" href="${process.env.FRONTEND_URL}/dashboard/billing">Choose a Plan &amp; Reactivate</a>
      </div>

      <ul class="checklist">
        <li>All your data and settings are preserved</li>
        <li>Pick the plan that fits your team size</li>
        <li>Reactivate in under 2 minutes</li>
        <li>Priority onboarding support included</li>
      </ul>
    </div>

    <!-- ④ FOOTER -->
    <div class="footer" style="background-color:#0D1B3E;padding:28px 36px;text-align:center;">
      <img src="${LOGO_URL}" alt="Zopkit" class="footer-logo" style="height:24px;width:auto;opacity:0.7;margin-bottom:14px;">
      <div class="footer-divider"></div>
      <p>Your account will remain on free tier until you upgrade.</p>
      <p class="footer-copy">Powered by <strong>Zopkit</strong> — Your AI-first business operating system</p>
    </div>
  </div>
</body>
</html>`;

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
          .header { background-color: #ff9800; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background-color: #2196f3; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
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
