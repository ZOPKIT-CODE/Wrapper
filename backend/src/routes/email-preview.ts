/**
 * Email Preview & Test Routes
 * Renders email templates as HTML for in-browser preview and sends test emails.
 * Available at: GET  /api/email-preview/render?template=welcome
 *               POST /api/email-preview/send-test
 *
 * These routes are intentionally unauthenticated so the frontend demo page can
 * call them without an active session. Lock them down (or remove them entirely)
 * before shipping to production.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ── Mock data used when the caller supplies no overrides ──────────────────────
const MOCKS: Record<string, Record<string, unknown>> = {
  welcome: {
    email: 'jane.doe@acme.com',
    name: 'Jane Doe',
    companyName: 'Acme Corporation',
    subdomain: 'acme',
    kindeOrgCode: 'org_demo',
    loginUrl: 'https://app.zopkit.com/dashboard',
  },
  invitation: {
    email: 'john.smith@example.com',
    tenantName: 'Acme Corporation',
    roleName: 'Senior Manager',
    invitationToken: 'demo-preview-token-0000',
    invitedByName: 'Jane Doe',
    message: 'Hi John! Really excited to have you on the team.',
    invitedDate: new Date().toISOString(),
    expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    organizations: ['Acme HQ', 'Acme West Coast'],
    locations: ['San Francisco Office', 'New York Office'],
    primaryOrganizationName: 'Acme HQ',
  },
  usageAlert: {
    tenantId: 'demo-tenant',
    adminEmail: 'admin@acme.com',
    tenantName: 'Acme Corporation',
    alertType: 'credit_low',
    metricType: 'Credits',
    currentValue: '850',
    limitValue: '1000',
    percentage: 85,
  },
  downgradeConfirmation: {
    tenantId: 'demo-tenant',
    fromPlan: 'Professional',
    toPlan: 'Starter',
    refundAmount: 49.99,
    effectiveDate: new Date(Date.now() + 30 * 86400000).toISOString(),
  },
  paymentFailed: {
    tenantId: 'demo-tenant',
    amount: 99.99,
    currency: 'USD',
    nextAttempt: new Date(Date.now() + 3 * 86400000),
    failureReason: 'Insufficient funds',
  },
  dispute: {
    tenantId: 'demo-tenant',
    disputeId: 'dp_demo_123456',
    amount: 99.99,
    currency: 'USD',
    reason: 'Product not received',
    evidenceDueBy: new Date(Date.now() + 7 * 86400000),
  },
  paymentConfirmation: {
    tenantId: 'demo-tenant',
    userEmail: 'jane@acme.com',
    userName: 'Jane Doe',
    paymentType: 'subscription',
    amount: 99.99,
    currency: 'USD',
    transactionId: 'txn_demo_abc123',
    planName: 'Professional',
    billingCycle: 'monthly',
    creditsAdded: 5000,
    sessionId: 'cs_demo_xyz',
  },
  refundConfirmation: {
    tenantId: 'demo-tenant',
    refundId: 're_demo_abc123',
    amount: 49.99,
    currency: 'USD',
    reason: 'Customer requested cancellation',
    processedAt: new Date(),
  },
  trialReminder: {
    email: 'jane@acme.com',
    companyName: 'Acme Corporation',
    planName: 'Professional Trial',
    expirationDate: new Date(Date.now() + 3 * 86400000),
    subscriptionId: 'sub_demo_123',
  },
  trialExpired: {
    email: 'jane@acme.com',
    companyName: 'Acme Corporation',
    planName: 'Professional Trial',
    subscriptionId: 'sub_demo_123',
  },
};

/** Render a template HTML by intercepting the email service's sendEmail call. */
async function renderTemplate(templateName: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const EmailService = (await import('../utils/email.js')).default;
  const params = { ...MOCKS[templateName], ...overrides } as Record<string, unknown>;

  let capturedHtml = '';

  // Temporarily replace sendEmail to capture the rendered HTML
  const svc = EmailService as unknown as Record<string, unknown>;
  const original = svc.sendEmail as (...args: unknown[]) => unknown;
  svc.sendEmail = async ({ htmlContent }: { htmlContent: string }) => {
    capturedHtml = htmlContent;
    return { success: true, messageId: 'preview', provider: 'preview' };
  };

  try {
    switch (templateName) {
      case 'welcome':
        await EmailService.sendWelcomeEmail(params as Parameters<typeof EmailService.sendWelcomeEmail>[0]);
        break;
      case 'invitation':
        await EmailService.sendUserInvitation(params as Parameters<typeof EmailService.sendUserInvitation>[0]);
        break;
      case 'usageAlert':
        await (EmailService as unknown as { sendUsageAlert: (p: unknown) => Promise<unknown> }).sendUsageAlert(params);
        break;
      case 'downgradeConfirmation':
        await (EmailService as unknown as { sendDowngradeConfirmation: (p: unknown) => Promise<unknown> }).sendDowngradeConfirmation(params);
        break;
      case 'paymentFailed':
        await (EmailService as unknown as { sendPaymentFailedNotification: (p: unknown) => Promise<unknown> }).sendPaymentFailedNotification(params);
        break;
      case 'dispute':
        await (EmailService as unknown as { sendDisputeNotification: (p: unknown) => Promise<unknown> }).sendDisputeNotification(params);
        break;
      case 'paymentConfirmation':
        await (EmailService as unknown as { sendPaymentConfirmation: (p: unknown) => Promise<unknown> }).sendPaymentConfirmation(params);
        break;
      case 'refundConfirmation':
        await (EmailService as unknown as { sendRefundConfirmation: (p: unknown) => Promise<unknown> }).sendRefundConfirmation(params);
        break;
      case 'trialReminder':
        await (EmailService as unknown as { sendTrialReminderNotification: (p: unknown) => Promise<unknown> }).sendTrialReminderNotification(params);
        break;
      case 'trialExpired':
        await (EmailService as unknown as { sendTrialExpiredNotification: (p: unknown) => Promise<unknown> }).sendTrialExpiredNotification(params);
        break;
      default:
        throw new Error(`Unknown template: ${templateName}`);
    }
  } finally {
    // Always restore the original method
    svc.sendEmail = original;
  }

  return capturedHtml;
}

export default async function emailPreviewRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /api/email-preview/render?template=welcome ───────────────────────
  fastify.get('/render', async (request: FastifyRequest, reply: FastifyReply) => {
    const { template } = request.query as Record<string, string>;

    if (!template || !MOCKS[template]) {
      return reply.code(400).send({
        error: 'Invalid template',
        available: Object.keys(MOCKS),
      });
    }

    try {
      const html = await renderTemplate(template);
      return reply.type('text/html').send(html);
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  // ── GET /api/email-preview/templates ────────────────────────────────────
  fastify.get('/templates', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      templates: Object.keys(MOCKS).map(id => ({
        id,
        label: TEMPLATE_META[id]?.label ?? id,
        description: TEMPLATE_META[id]?.description ?? '',
        category: TEMPLATE_META[id]?.category ?? 'general',
      })),
    });
  });

  // ── POST /api/email-preview/send-test ────────────────────────────────────
  fastify.post('/send-test', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const { template, sendTo } = body as { template: string; sendTo: string };

    if (!template || !MOCKS[template]) {
      return reply.code(400).send({ error: 'Invalid template', available: Object.keys(MOCKS) });
    }
    if (!sendTo || !sendTo.includes('@')) {
      return reply.code(400).send({ error: 'sendTo must be a valid email address' });
    }

    try {
      const EmailService = (await import('../utils/email.js')).default;
      const params = { ...MOCKS[template], email: sendTo, adminEmail: sendTo, userEmail: sendTo } as Record<string, unknown>;

      let result: unknown;
      switch (template) {
        case 'welcome':            result = await EmailService.sendWelcomeEmail(params as Parameters<typeof EmailService.sendWelcomeEmail>[0]); break;
        case 'invitation':         result = await EmailService.sendUserInvitation(params as Parameters<typeof EmailService.sendUserInvitation>[0]); break;
        case 'usageAlert':         result = await (EmailService as unknown as { sendUsageAlert: (p: unknown) => Promise<unknown> }).sendUsageAlert(params); break;
        case 'downgradeConfirmation': result = await (EmailService as unknown as { sendDowngradeConfirmation: (p: unknown) => Promise<unknown> }).sendDowngradeConfirmation(params); break;
        case 'paymentFailed':      result = await (EmailService as unknown as { sendPaymentFailedNotification: (p: unknown) => Promise<unknown> }).sendPaymentFailedNotification(params); break;
        case 'dispute':            result = await (EmailService as unknown as { sendDisputeNotification: (p: unknown) => Promise<unknown> }).sendDisputeNotification(params); break;
        case 'paymentConfirmation':result = await (EmailService as unknown as { sendPaymentConfirmation: (p: unknown) => Promise<unknown> }).sendPaymentConfirmation(params); break;
        case 'refundConfirmation': result = await (EmailService as unknown as { sendRefundConfirmation: (p: unknown) => Promise<unknown> }).sendRefundConfirmation(params); break;
        case 'trialReminder':      result = await (EmailService as unknown as { sendTrialReminderNotification: (p: unknown) => Promise<unknown> }).sendTrialReminderNotification(params); break;
        case 'trialExpired':       result = await (EmailService as unknown as { sendTrialExpiredNotification: (p: unknown) => Promise<unknown> }).sendTrialExpiredNotification(params); break;
        default: throw new Error(`Unknown template: ${template}`);
      }

      return reply.send({ success: true, sentTo: sendTo, template, result });
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });
}

// ── Template metadata ─────────────────────────────────────────────────────────
const TEMPLATE_META: Record<string, { label: string; description: string; category: string }> = {
  welcome: {
    label: 'Welcome Email',
    description: 'Sent to new admins after completing onboarding',
    category: 'Onboarding',
  },
  invitation: {
    label: 'Team Invitation',
    description: 'Sent when a user is invited to join an organisation',
    category: 'Onboarding',
  },
  usageAlert: {
    label: 'Usage Alert',
    description: 'Sent when credit/resource usage crosses a threshold',
    category: 'Billing',
  },
  downgradeConfirmation: {
    label: 'Downgrade Confirmation',
    description: 'Sent when a tenant downgrades their subscription plan',
    category: 'Billing',
  },
  paymentFailed: {
    label: 'Payment Failed',
    description: 'Sent when a payment attempt is declined',
    category: 'Billing',
  },
  dispute: {
    label: 'Dispute Notification',
    description: 'Sent when a payment dispute is raised',
    category: 'Billing',
  },
  paymentConfirmation: {
    label: 'Payment Confirmation',
    description: 'Sent after a successful payment or subscription upgrade',
    category: 'Billing',
  },
  refundConfirmation: {
    label: 'Refund Confirmation',
    description: 'Sent when a refund has been processed',
    category: 'Billing',
  },
  trialReminder: {
    label: 'Trial Reminder',
    description: 'Sent a few days before a trial expires',
    category: 'Subscriptions',
  },
  trialExpired: {
    label: 'Trial Expired',
    description: 'Sent when a trial period ends without conversion',
    category: 'Subscriptions',
  },
};
