/**
 * Tenant Onboarding Activities
 *
 * Domain provisioning + 10-day drip email campaign.
 * Each activity is retryable and side-effect isolated.
 */

// ── Email HTML helpers ────────────────────────────────────────────────────────

const BRAND_COLOR = '#0D1B3E';
const CTA_COLOR   = '#2563EB';
const LOGO_URL    = 'https://zopkit.com/logo.png';

function baseTemplate({ preheader, heroIcon, heroTitle, heroSub, body, ctaLabel, ctaUrl }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${heroTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<span style="display:none;font-size:1px;color:#f4f6fb;max-height:0;overflow:hidden;">${preheader}</span>
<div style="max-width:600px;margin:32px auto;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <!-- brand bar -->
  <div style="background:${BRAND_COLOR};padding:20px 36px;display:flex;align-items:center;justify-content:space-between;">
    <img src="${LOGO_URL}" alt="Zopkit" style="height:28px;width:auto;">
    <span style="color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Zopkit</span>
  </div>
  <!-- hero -->
  <div style="background:${BRAND_COLOR};padding:44px 40px 40px;text-align:center;">
    <div style="font-size:40px;margin-bottom:16px;">${heroIcon}</div>
    <h1 style="color:#fff;margin:0 0 10px;font-size:24px;font-weight:700;">${heroTitle}</h1>
    <p style="color:#93C5FD;margin:0;font-size:14px;font-weight:500;">${heroSub}</p>
  </div>
  <!-- body -->
  <div style="background:#fff;padding:36px 40px;">
    ${body}
    ${ctaLabel && ctaUrl ? `
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${ctaUrl}" style="display:inline-block;padding:14px 44px;background:${CTA_COLOR};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">${ctaLabel}</a>
    </div>` : ''}
  </div>
  <!-- footer -->
  <div style="background:${BRAND_COLOR};padding:24px 36px;text-align:center;">
    <p style="color:#93C5FD;margin:0 0 6px;font-size:12px;">Questions? Reply to this email — we read every one.</p>
    <p style="color:#4B6CB7;margin:0;font-size:11px;">© Zopkit · Your AI-first business operating system</p>
  </div>
</div>
</body>
</html>`;
}

function emailTemplates(type, { adminName, companyName, subdomain, loginUrl, plan }) {
  const workspace = `${subdomain}.zopkit.com`;
  const firstName = adminName.split(' ')[0];

  const templates = {
    welcome: {
      subject: `Welcome to Zopkit — your workspace is live 🎉`,
      preheader: `Your ${companyName} workspace is ready. Here's everything you need to get started.`,
      heroIcon: '🎉',
      heroTitle: 'Your workspace is live!',
      heroSub: `${workspace} is ready for your team`,
      body: `
        <p style="color:#1e293b;font-size:15px;margin:0 0 16px;">Hi <strong>${firstName}</strong>,</p>
        <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 20px;">
          Your <strong>${companyName}</strong> workspace has been created and is ready to use.
          Log in with the button below to explore your dashboard.
        </p>
        <table style="width:100%;border:1px solid #e2e8f0;border-radius:8px;border-collapse:collapse;margin:0 0 24px;">
          <tr><td style="padding:10px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Workspace</td><td style="padding:10px 16px;color:#1e293b;font-size:13px;font-weight:600;border-bottom:1px solid #f1f5f9;">${workspace}</td></tr>
          <tr><td style="padding:10px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Plan</td><td style="padding:10px 16px;color:#1e293b;font-size:13px;font-weight:600;border-bottom:1px solid #f1f5f9;">${plan ?? 'Free'}</td></tr>
          <tr><td style="padding:10px 16px;color:#64748b;font-size:13px;">Login</td><td style="padding:10px 16px;font-size:13px;"><a href="${loginUrl}" style="color:${CTA_COLOR};font-weight:600;">Open dashboard</a></td></tr>
        </table>
        <p style="color:#64748b;font-size:13px;margin:0;">🔒 Secure SSO login · No password required</p>`,
      ctaLabel: 'Go to Dashboard',
      ctaUrl: loginUrl,
    },

    getting_started: {
      subject: `3 things to do first in Zopkit`,
      preheader: `Get the most out of your new workspace with these quick wins.`,
      heroIcon: '🚀',
      heroTitle: '3 things to do first',
      heroSub: `Get your ${companyName} workspace up and running`,
      body: `
        <p style="color:#1e293b;font-size:15px;margin:0 0 20px;">Hi <strong>${firstName}</strong>, your workspace has been live for a couple of days — here's how to hit the ground running:</p>
        ${[
          ['👥', 'Invite your team', 'Go to <strong>Settings → Team Members</strong> and add your colleagues. They\'ll get a secure invite link.'],
          ['🏢', 'Complete your org profile', 'Add your company logo, address, and tax details under <strong>Settings → Organization</strong>.'],
          ['🔐', 'Set up roles', 'Control who can do what. Head to <strong>Settings → Roles & Permissions</strong> to customize access levels.'],
        ].map(([icon, title, desc]) => `
          <div style="display:flex;gap:14px;margin-bottom:18px;padding:16px;background:#f8fafc;border-radius:8px;border-left:3px solid ${CTA_COLOR};">
            <span style="font-size:22px;flex-shrink:0;">${icon}</span>
            <div><strong style="color:#1e293b;font-size:14px;">${title}</strong><p style="color:#64748b;font-size:13px;margin:4px 0 0;line-height:1.6;">${desc}</p></div>
          </div>`).join('')}`,
      ctaLabel: 'Open My Workspace',
      ctaUrl: loginUrl,
    },

    feature_highlight: {
      subject: `Your apps are ready — here's what they can do`,
      preheader: `CRM, Financial Accounting and more — a quick tour of your Zopkit apps.`,
      heroIcon: '✨',
      heroTitle: 'Your apps are ready',
      heroSub: `Here\'s what\'s available in your workspace`,
      body: `
        <p style="color:#1e293b;font-size:15px;margin:0 0 20px;">Hi <strong>${firstName}</strong>, your ${companyName} workspace includes powerful apps built for growing businesses:</p>
        ${[
          ['📊', 'CRM', 'Track leads, manage contacts, and close deals — all in one place. Your pipeline is ready to go.'],
          ['💰', 'Financial Accounting', 'Invoices, expenses, journal entries, and real-time P&L. GSTIN-ready and multi-currency.'],
          ['👤', 'Team & Roles', 'Granular permissions so each team member sees exactly what they need — nothing more.'],
        ].map(([icon, name, desc]) => `
          <div style="padding:16px 20px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px;">
            <div style="font-size:20px;margin-bottom:6px;">${icon} <strong style="color:#1e293b;font-size:14px;">${name}</strong></div>
            <p style="color:#64748b;font-size:13px;margin:0;line-height:1.6;">${desc}</p>
          </div>`).join('')}`,
      ctaLabel: 'Explore My Apps',
      ctaUrl: loginUrl,
    },

    pro_tips: {
      subject: `Pro tips from Zopkit power users`,
      preheader: `7 days in — here are the things our best users do differently.`,
      heroIcon: '💡',
      heroTitle: 'Tips from power users',
      heroSub: `Make Zopkit work harder for ${companyName}`,
      body: `
        <p style="color:#1e293b;font-size:15px;margin:0 0 20px;">Hi <strong>${firstName}</strong>, a week in — here are habits that separate good Zopkit users from great ones:</p>
        ${[
          ['Use keyboard shortcuts', 'Press <kbd style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">?</kbd> anywhere to see all shortcuts. Power users rarely touch the mouse.'],
          ['Set up your fiscal year', 'Under Financial Settings → Fiscal Year. Get it right now before you have data to migrate.'],
          ['Tag everything', 'Tags on contacts, transactions, and roles unlock powerful cross-app filters later.'],
          ['Review your audit log weekly', 'Settings → Audit Log shows every action in your workspace. Spot issues early.'],
        ].map(([title, desc]) => `
          <div style="padding:12px 16px;margin-bottom:10px;background:#f8fafc;border-radius:6px;">
            <strong style="color:#1e293b;font-size:14px;">▸ ${title}</strong>
            <p style="color:#64748b;font-size:13px;margin:4px 0 0;line-height:1.6;">${desc}</p>
          </div>`).join('')}`,
      ctaLabel: 'Back to Dashboard',
      ctaUrl: loginUrl,
    },

    advanced_features: {
      subject: `You've been with us 10 days — unlock what's next`,
      preheader: `Here's what ${companyName} can do as you scale on Zopkit.`,
      heroIcon: '🏆',
      heroTitle: '10 days strong!',
      heroSub: `Here\'s what\'s waiting for you as you grow`,
      body: `
        <p style="color:#1e293b;font-size:15px;margin:0 0 20px;">Hi <strong>${firstName}</strong>, you're 10 days in — here's what successful teams unlock next:</p>
        ${[
          ['🔗', 'App integrations', 'Connect your CRM and accounting to sync data automatically — no manual exports.'],
          ['📈', 'Reports & dashboards', 'Build custom reports across CRM pipeline, revenue, and team performance.'],
          ['⚡', 'Automations', 'Set triggers — when a deal closes, auto-create an invoice. Coming soon.'],
          ['🛡️', 'Advanced permissions', 'Field-level and record-level access control for compliance-heavy teams.'],
        ].map(([icon, title, desc]) => `
          <div style="display:flex;gap:12px;padding:14px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px;">
            <span style="font-size:22px;flex-shrink:0;">${icon}</span>
            <div><strong style="color:#1e293b;font-size:14px;">${title}</strong><p style="color:#64748b;font-size:13px;margin:4px 0 0;line-height:1.6;">${desc}</p></div>
          </div>`).join('')}
        <p style="color:#64748b;font-size:13px;margin:20px 0 0;text-align:center;">Need help? Reply to this email — our team responds within a few hours.</p>`,
      ctaLabel: 'See What\'s New',
      ctaUrl: loginUrl,
    },
  };

  return templates[type] ?? templates.welcome;
}

// ── Activities ────────────────────────────────────────────────────────────────

export async function provisionTenantDomain({ tenantId, subdomain }) {
  const { db } = await import('../../src/db/index.js');
  const { tenants } = await import('../../src/db/schema/index.js');
  const { eq } = await import('drizzle-orm');

  const [tenant] = await db.select({
    tenantId: tenants.tenantId,
    subdomain: tenants.subdomain,
    companyName: tenants.companyName,
  }).from(tenants).where(eq(tenants.tenantId, tenantId));

  if (!tenant) throw new Error(`Tenant ${tenantId} not found during domain provisioning`);

  // Subdomain is already stored in DB from createTenant — verify it matches.
  // Future: add DNS record creation, SSL certificate issuance here.
  if (tenant.subdomain !== subdomain) {
    throw new Error(`Subdomain mismatch: expected ${subdomain}, found ${tenant.subdomain}`);
  }

  return { tenantId, subdomain, workspaceUrl: `https://${subdomain}.zopkit.com` };
}

export async function sendOnboardingEmail({ type, tenantId, adminEmail, adminName, companyName, subdomain, loginUrl, plan }) {
  const { default: emailService } = await import('../../src/features/notifications/email/email-service.js');

  const tpl = emailTemplates(type, { adminName, companyName, subdomain, loginUrl, plan });

  await emailService.sendEmail({
    to: [{ email: adminEmail, name: adminName }],
    subject: tpl.subject,
    htmlContent: baseTemplate(tpl),
    textContent: undefined,
  });

  return { type, adminEmail, tenantId, sentAt: new Date().toISOString() };
}
