/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  // API
  readonly VITE_API_URL: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_URL: string

  // Kinde Auth
  readonly VITE_KINDE_DOMAIN: string
  readonly VITE_KINDE_CLIENT_ID: string
  readonly VITE_KINDE_REDIRECT_URI: string
  readonly VITE_KINDE_LOGOUT_URI: string
  readonly VITE_KINDE_GOOGLE_CONNECTION_ID: string
  readonly VITE_KINDE_MANAGEMENT_AUDIENCE: string
  readonly VITE_KINDE_MANAGEMENT_SCOPES: string

  // App domains
  readonly VITE_WRAPPER_DOMAIN: string
  readonly VITE_CRM_DOMAIN: string
  readonly VITE_CRM_CALLBACK_PATH: string
  readonly VITE_HR_APP_URL: string
  readonly VITE_AFFILIATE_APP_URL: string
  readonly VITE_DEFAULT_SUBDOMAIN: string

  // Assets
  readonly VITE_LOGO_URL: string
  readonly VITE_FULL_LOGO_URL: string

  // Secrets
  readonly VITE_JWT_SECRET: string

  // Environment
  readonly VITE_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string;
declare const __APP_BUILD_TIME__: string;
declare const __BUILD_HASH__: string;