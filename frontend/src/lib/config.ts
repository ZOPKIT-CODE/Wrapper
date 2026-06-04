interface Config {
  JWT_SECRET: string;
  NODE_ENV: string;

  // Core URLs
  API_URL: string;
  API_BASE_URL: string;
  WRAPPER_DOMAIN: string;

  // App domains
  CRM_DOMAIN: string;
  CRM_CALLBACK_PATH: string;
  HR_APP_URL: string;
  AFFILIATE_APP_URL: string;

  // Assets
  LOGO_URL: string;
  FULL_LOGO_URL: string;
  /** Full Zopkit wordmark for onboarding (defaults to Cloudinary full logo). */
  ONBOARDING_LOGO_URL: string;
}

const getEnvVar = (key: string, fallback: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const value = import.meta.env[key];
    if (value) return value;
  }
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    if (value) return value;
  }
  return fallback;
};

export const config: Config = {
  JWT_SECRET: getEnvVar('VITE_JWT_SECRET', 'your-super-secret-jwt-key-change-this-in-production'),
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),

  API_URL: getEnvVar('VITE_API_URL', 'http://localhost:3000/api'),
  API_BASE_URL: getEnvVar('VITE_API_BASE_URL', 'http://localhost:3000'),
  WRAPPER_DOMAIN: getEnvVar('VITE_WRAPPER_DOMAIN', 'https://wrapper.zopkit.com'),

  CRM_DOMAIN: getEnvVar('VITE_CRM_DOMAIN', 'https://crm.zopkit.com'),
  CRM_CALLBACK_PATH: getEnvVar('VITE_CRM_CALLBACK_PATH', '/callback'),
  HR_APP_URL: getEnvVar('VITE_HR_APP_URL', 'http://localhost:3003'),
  AFFILIATE_APP_URL: getEnvVar('VITE_AFFILIATE_APP_URL', 'http://localhost:3004'),

  LOGO_URL: getEnvVar(
    'VITE_LOGO_URL',
    'https://res.cloudinary.com/dr9vzaa7u/image/upload/v1765126845/Zopkit_Simple_Logo_glohfr.jpg',
  ),
  FULL_LOGO_URL: getEnvVar(
    'VITE_FULL_LOGO_URL',
    'https://res.cloudinary.com/dr9vzaa7u/image/upload/v1771698937/Zopkit-full_n7lm0f.png',
  ),
  ONBOARDING_LOGO_URL: getEnvVar(
    'VITE_ONBOARDING_LOGO_URL',
    'https://res.cloudinary.com/dr9vzaa7u/image/upload/v1765126845/Zopkit_Simple_Logo_glohfr.jpg',
  ),
};

export const {
  JWT_SECRET,
  WRAPPER_DOMAIN,
  NODE_ENV,
  API_URL,
  API_BASE_URL,
  CRM_DOMAIN,
  CRM_CALLBACK_PATH,
  HR_APP_URL,
  AFFILIATE_APP_URL,
  LOGO_URL,
  FULL_LOGO_URL,
  ONBOARDING_LOGO_URL,
} = config;

export const isDevelopment = () => NODE_ENV === 'development';
export const isProduction = () => NODE_ENV === 'production'; 