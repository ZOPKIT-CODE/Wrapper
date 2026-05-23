/**
 * Tenant Onboarding Workflow
 *
 * Triggered immediately after a tenant completes onboarding.
 * Handles domain provisioning and a 10-day drip email campaign.
 *
 * Idempotency: workflowId = `tenant-onboarding-${tenantId}`
 * Duplicate starts are rejected by Temporal.
 *
 * DETERMINISM RULES: No Date.now(), Math.random(), or I/O in this file.
 */

import { proxyActivities, sleep } from '@temporalio/workflow';

const { provisionTenantDomain, sendOnboardingEmail } = proxyActivities({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '5s',
    maximumInterval: '2m',
    maximumAttempts: 5,
  },
});

/**
 * @param {object} payload
 * @param {string} payload.tenantId
 * @param {string} payload.adminEmail
 * @param {string} payload.adminName
 * @param {string} payload.companyName
 * @param {string} payload.subdomain
 * @param {string} payload.loginUrl
 * @param {string} payload.plan
 */
export async function tenantOnboardingWorkflow(payload) {
  const { tenantId, adminEmail, adminName, companyName, subdomain, loginUrl, plan } = payload;

  const emailPayload = { tenantId, adminEmail, adminName, companyName, subdomain, loginUrl, plan };

  // Step 1 — Verify domain is provisioned (subdomain in DB; future: DNS + SSL)
  await provisionTenantDomain({ tenantId, subdomain });

  // Step 2 — Day 0: Welcome email
  await sendOnboardingEmail({ type: 'welcome', ...emailPayload });

  // Step 3 — Day 2: Getting started guide
  await sleep('2 days');
  await sendOnboardingEmail({ type: 'getting_started', ...emailPayload });

  // Step 4 — Day 4: Feature highlight
  await sleep('2 days');
  await sendOnboardingEmail({ type: 'feature_highlight', ...emailPayload });

  // Step 5 — Day 7: Pro tips
  await sleep('3 days');
  await sendOnboardingEmail({ type: 'pro_tips', ...emailPayload });

  // Step 6 — Day 10: Advanced features
  await sleep('3 days');
  await sendOnboardingEmail({ type: 'advanced_features', ...emailPayload });
}
