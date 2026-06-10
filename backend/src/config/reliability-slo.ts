export const RELIABILITY_CONTRACT_VERSION = '2026-02-26';

export const RELIABILITY_SLOS = {
  interAppDeliveryTarget: 0.9999,
  eventAckTarget: 0.999,
  p95PublishLatencyMs: 5000,
  rtoMinutesCritical: 15,
  rpoMinutesCritical: 5,
} as const;

export const ERROR_BUDGETS = {
  interAppDeliveryMonthly: 1 - RELIABILITY_SLOS.interAppDeliveryTarget,
  eventAckMonthly: 1 - RELIABILITY_SLOS.eventAckTarget,
} as const;

export const FAILURE_TAXONOMY = {
  broker_unavailable: 'SNS/SQS connection lost or unreachable',
  unroutable_message: 'Published message was returned as unroutable',
  publish_confirm_timeout: 'SNS did not confirm publish within budget',
  consumer_processing_failure: 'Consumer failed to process message payload',
  retry_exhausted: 'Message exceeded retry budget and moved to DLQ',
  auth_configuration_error: 'Service auth/JWT secret misconfigured',
  contract_drift: 'Payload or route contract mismatch between apps',
  reconciliation_drift: 'Tracking state differs from actual delivery state',
  unknown: 'Any uncategorized failure',
} as const;
