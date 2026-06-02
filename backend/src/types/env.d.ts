declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Server
      PORT?: string;
      HOST?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
      SERVICE_NAME?: string;
      LOG_LEVEL?: string;
      DISABLE_LOGGING?: string;
      SUPPRESS_CONSOLE?: string;
      BACKEND_VERBOSE_LOGS?: string;

      // Database
      DATABASE_URL?: string;
      DB_POOL_SIZE?: string;
      APP_POOL_SIZE?: string;
      SYSTEM_POOL_SIZE?: string;

      // Authentication (AWS Cognito)
      COGNITO_REGION?: string;
      COGNITO_USER_POOL_ID?: string;
      COGNITO_CLIENT_ID?: string;
      COGNITO_DOMAIN?: string;

      // JWT / Sessions
      JWT_SECRET?: string;
      JWT_SECRET_PREVIOUS?: string;
      JWT_SIGNING_ALG?: 'HS256' | 'RS256';
      JWT_PRIVATE_KEY?: string;
      JWT_PUBLIC_KEY?: string;
      JWT_KEY_ID?: string;
      SESSION_SECRET?: string;
      OPERATIONS_JWT_SECRET?: string;
      SHARED_APP_JWT_SECRET?: string;
      SERVICE_TOKEN_SECRET?: string;
      ALLOWED_SERVICE_TOKENS?: string;
      BCRYPT_ROUNDS?: string;

      // Cookies
      COOKIE_DOMAIN?: string;
      COOKIE_SECURE?: string;
      COOKIE_SAME_SITE?: string;

      // URLs
      FRONTEND_URL?: string;
      FRONTEND_DOMAIN?: string;
      BACKEND_URL?: string;
      BASE_URL?: string;
      BASE_DOMAIN?: string;
      INVITATION_BASE_URL?: string;
      PROTOCOL?: string;

      // App URLs
      CRM_APP_URL?: string;
      HR_APP_URL?: string;
      AFFILIATE_APP_URL?: string;
      ACCOUNTING_APP_URL?: string;
      INVENTORY_APP_URL?: string;
      BUSINESS_SUITE_TARGET_APPS?: string;

      // Rate Limiting
      RATE_LIMIT_MAX?: string;
      RATE_LIMIT_WINDOW?: string;

      // File Uploads
      MAX_FILE_SIZE?: string;
      UPLOAD_DIR?: string;

      // Stripe
      STRIPE_SECRET_KEY?: string;
      STRIPE_PUBLISHABLE_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      BYPASS_WEBHOOK_SIGNATURE?: string;
      /** @deprecated Annual-only billing; monthly price IDs unused */
      STRIPE_STARTER_MONTHLY_PRICE_ID?: string;
      STRIPE_STARTER_YEARLY_PRICE_ID?: string;
      STRIPE_STARTER_YEARLY_INR_PRICE_ID?: string;
      STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID?: string;
      STRIPE_PROFESSIONAL_YEARLY_PRICE_ID?: string;
      STRIPE_PROFESSIONAL_YEARLY_INR_PRICE_ID?: string;
      STRIPE_ENTERPRISE_MONTHLY_PRICE_ID?: string;
      STRIPE_ENTERPRISE_YEARLY_PRICE_ID?: string;
      STRIPE_ENTERPRISE_YEARLY_INR_PRICE_ID?: string;
      STRIPE_PRICE_ID_STARTER?: string;
      STRIPE_PRICE_ID_PROFESSIONAL?: string;
      STRIPE_PRICE_ID_ENTERPRISE?: string;

      // AWS
      AWS_ACCESS_KEY_ID?: string;
      AWS_SECRET_ACCESS_KEY?: string;
      AWS_REGION?: string;
      AWS_HOSTED_ZONE_ID?: string;
      // Dedicated messaging credentials (SNS/SQS/S3).
      // If set, these take precedence over the general AWS credentials so that
      // the Route 53 (DNS_MANAGEMENT) IAM user is not used for SNS:Publish.
      AWS_MESSAGING_ACCESS_KEY_ID?: string;
      AWS_MESSAGING_SECRET_ACCESS_KEY?: string;

      // Email
      BREVO_API_KEY?: string;
      BREVO_SENDER_EMAIL?: string;
      BREVO_SENDER_NAME?: string;

      // Redis
      REDIS_ENABLED?: string;
      REDIS_URL?: string;

      // Temporal
      TEMPORAL_ENABLED?: string;
      TEMPORAL_ADDRESS?: string;
      TEMPORAL_NAMESPACE?: string;
      TEMPORAL_TASK_QUEUE_WRAPPER?: string;

      // AI Services
      OPENAI_API_KEY?: string;

      // Verification
      VERIFICATION_API_KEY?: string;
      VERIFICATION_API_SECRET?: string;
      VERIFICATION_API_VERSION?: string;
      VERIFICATION_USE_LIVE?: string;

      // DNS
      SERVER_TARGET?: string;

      // Credits / Trial
      DEFAULT_FREE_CREDITS?: string;
      TRIAL_PERIOD_DAYS?: string;

      // Wrapper Internal
      WRAPPER_SECRET_KEY?: string;
      WRAPPER_ORG_CODE?: string;
      WRAPPER_API_URL?: string;
      WRAPPER_APP_CODE?: string;
      AUTH_TOKEN?: string;
      API_BASE_URL?: string;
    }
  }
}

export {};
