/**
 * Single source of truth for legal / policy contact details shown on public pages.
 * Update here when company contact information changes.
 */
export const LEGAL_CONTACT = {
  companyLegalName: 'Zopkit Inc.',
  addressLine: 'Hi-Tech City, Hyderabad, India',
  /** Privacy, cookies, data rights, general policy questions */
  privacyEmail: 'hr@zopkit.com',
  /** Subscriptions, billing, refunds, commercial terms */
  billingEmail: 'sales@zopkit.com',
  /** Security reports and vulnerability disclosure */
  securityEmail: 'hr@zopkit.com',
  phoneDisplay: '8971055515',
  phoneTel: '+918971055515',
} as const;
