import { api } from './client'

export const subscriptionAPI = {
  debugAuth: () => api.get('/subscriptions/debug-auth'),

  getCurrent: () => api.get('/subscriptions/current'),
  getAvailablePlans: () => api.get('/subscriptions/plans'),
  getBillingHistory: () => api.get('/subscriptions/billing-history'),
  getConfigStatus: () => api.get('/subscriptions/config-status'),
  createCheckout: (data: {
    planId: string;
    successUrl: string;
    cancelUrl: string;
    currency?: 'usd' | 'inr';
    /** @deprecated Annual-only; omit or use yearly */
    billingCycle?: 'yearly';
  }) => api.post('/subscriptions/checkout', data),
  checkProfileStatus: () => api.get('/payment-upgrade/profile-status'),
  changePlan: (data: {
    planId: string;
    currency?: 'usd' | 'inr';
    billingCycle?: 'yearly';
  }) => api.post('/subscriptions/change-plan', data),
  cancelSubscription: () => api.post('/subscriptions/cancel'),
  updatePaymentMethod: () => api.post('/subscriptions/update-payment-method'),
  getUsage: () => api.get('/subscriptions/usage'),

  immediateDowngrade: (data: { newPlan: string; reason?: string; refundRequested?: boolean }) =>
    api.post('/subscriptions/immediate-downgrade', data),
  processRefund: (data: { paymentId: string; amount?: number; reason?: string }) =>
    api.post('/subscriptions/refund', data),
  getPaymentDetailsById: (paymentId: string) =>
    api.get(`/subscriptions/payment/${paymentId}`),
  getSubscriptionActions: () =>
    api.get('/subscriptions/actions'),
  getPlanLimits: () =>
    api.get('/subscriptions/plan-limits'),
  cleanupDuplicatePayments: () =>
    api.post('/subscriptions/cleanup-duplicate-payments'),
  getPaymentDetailsBySession: (sessionId: string) => api.get(`/subscriptions/payment/${sessionId}`),
  toggleTrialRestrictions: (disable: boolean) =>
    api.post('/subscriptions/toggle-trial-restrictions', { disable }),
}
