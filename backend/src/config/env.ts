/**
 * Centralized environment configuration with startup validation.
 * Import this instead of reading process.env directly throughout the codebase.
 */

const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
] as const;

const OPTIONAL_VARS = [
  'PORT',
  'NODE_ENV',
  'LOG_LEVEL',
  'SERVICE_NAME',
  // Comma-separated list of previous JWT secrets accepted during a rotation
  // window. Verifiers try JWT_SECRET first, then each entry here. After the
  // rotation completes (>= max token lifetime), unset this variable.
  'JWT_SECRET_PREVIOUS',
  'STRIPE_SECRET_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'SNS_TOPIC_ARN',
  'SQS_QUEUE_URL',
  'ELASTICSEARCH_URL',
  'SENTRY_DSN',
  'SUBSCRIPTION_PERIOD_DAYS',
  'CORS_ORIGINS',
  'FASTIFY_REQUEST_TIMEOUT_MS',
  'STRIPE_TIMEOUT_MS',
  'DISABLE_LOGGING',
  'SUPPRESS_CONSOLE',
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n` +
      `Check your .env file or deployment environment.`
    );
  }

  // Production must have the inter-app SNS topic configured. Silently disabling
  // inter-app events in prod has caused undebuggable downstream drift, so fail
  // fast at boot instead.
  if (process.env.NODE_ENV === 'production' && !process.env.SNS_INTER_APP_TOPIC_ARN) {
    // eslint-disable-next-line no-console
    console.error(
      'FATAL: SNS_INTER_APP_TOPIC_ARN is required in production. ' +
      'Inter-application events would be silently dropped without it. ' +
      'Set SNS_INTER_APP_TOPIC_ARN in your deployment environment and restart.'
    );
    process.exit(1);
  }
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  serviceName: process.env.SERVICE_NAME ?? 'wrapper-backend',

  // Database
  databaseUrl: process.env.DATABASE_URL ?? '',

  // Auth (AWS Cognito)
  cognitoRegion: process.env.COGNITO_REGION ?? '',
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID ?? '',
  cognitoClientId: process.env.COGNITO_CLIENT_ID ?? '',
  cognitoDomain: process.env.COGNITO_DOMAIN ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  /**
   * Previous JWT secrets accepted during rotation. Parsed lazily by verifiers
   * (comma-split, trimmed, empties filtered). Returns `[]` when unset.
   */
  jwtSecretPrevious: (process.env.JWT_SECRET_PREVIOUS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Payment providers
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',

  // AWS
  awsRegion: process.env.AWS_REGION ?? 'us-east-1',
  snsTopicArn: process.env.SNS_TOPIC_ARN ?? '',
  sqsQueueUrl: process.env.SQS_QUEUE_URL ?? '',

  // Observability
  elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  sentryDsn: process.env.SENTRY_DSN ?? '',

  // Feature config
  subscriptionPeriodDays: Number(process.env.SUBSCRIPTION_PERIOD_DAYS ?? 30),
  corsOrigins: process.env.CORS_ORIGINS ?? '',

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
} as const;
