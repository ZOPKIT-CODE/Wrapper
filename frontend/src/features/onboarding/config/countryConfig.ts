/**
 * Country Configuration System
 * Auto-populates localization settings based on country selection
 */

export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  language: string;
  locale: string;
  dateFormat: string;
  phoneFormat: string;
  timezone: string;
  hasStates: boolean;
  taxSystem: {
    name: string;
    idLabel: string;
    vatLabel: string;
    required: boolean;
  };
}

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  IN: {
    code: 'IN',
    name: 'India',
    currency: 'INR',
    currencySymbol: '₹',
    language: 'en',
    locale: 'en-IN',
    dateFormat: 'DD/MM/YYYY',
    phoneFormat: '+91 XXXXX XXXXX',
    timezone: 'Asia/Kolkata',
    hasStates: true,
    taxSystem: {
      name: 'GST',
      idLabel: 'PAN Number',
      vatLabel: 'GSTIN',
      required: true
    }
  },
  US: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    language: 'en',
    locale: 'en-US',
    dateFormat: 'MM/DD/YYYY',
    phoneFormat: '+1 (XXX) XXX-XXXX',
    timezone: 'America/New_York',
    hasStates: true,
    taxSystem: {
      name: 'Federal Tax',
      idLabel: 'EIN',
      vatLabel: 'Sales Tax ID',
      required: false
    }
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    language: 'en',
    locale: 'en-GB',
    dateFormat: 'DD/MM/YYYY',
    phoneFormat: '+44 XXXX XXXXXX',
    timezone: 'Europe/London',
    hasStates: false,
    taxSystem: {
      name: 'VAT',
      idLabel: 'UTR',
      vatLabel: 'VAT Number',
      required: false
    }
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    currencySymbol: 'C$',
    language: 'en',
    locale: 'en-CA',
    dateFormat: 'YYYY-MM-DD',
    phoneFormat: '+1 (XXX) XXX-XXXX',
    timezone: 'America/Toronto',
    hasStates: true,
    taxSystem: {
      name: 'GST/HST',
      idLabel: 'Business Number',
      vatLabel: 'GST/HST Number',
      required: false
    }
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    currencySymbol: 'A$',
    language: 'en',
    locale: 'en-AU',
    dateFormat: 'DD/MM/YYYY',
    phoneFormat: '+61 XXX XXX XXX',
    timezone: 'Australia/Sydney',
    hasStates: true,
    taxSystem: {
      name: 'GST',
      idLabel: 'TFN',
      vatLabel: 'ABN/ACN',
      required: false
    }
  },
  SG: {
    code: 'SG',
    name: 'Singapore',
    currency: 'SGD',
    currencySymbol: 'S$',
    language: 'en',
    locale: 'en-SG',
    dateFormat: 'DD/MM/YYYY',
    phoneFormat: '+65 XXXX XXXX',
    timezone: 'Asia/Singapore',
    hasStates: false,
    taxSystem: {
      name: 'GST',
      idLabel: 'UEN',
      vatLabel: 'GST Number',
      required: false
    }
  },
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    currencySymbol: 'د.إ',
    language: 'en',
    locale: 'en-AE',
    dateFormat: 'DD/MM/YYYY',
    phoneFormat: '+971 XX XXX XXXX',
    timezone: 'Asia/Dubai',
    hasStates: false,
    taxSystem: {
      name: 'VAT',
      idLabel: 'Trade License',
      vatLabel: 'VAT Number',
      required: false
    }
  }
};

export interface LocalizationSettings {
  currency: string;
  language: string;
  locale: string;
  dateFormat: string;
  phoneFormat: string;
  timezone: string;
  taxLabels: {
    taxId: string;
    vatId: string;
  };
}

/**
 * Auto-populate localization settings based on country selection
 */
export function autoPopulateLocalization(countryCode: string): LocalizationSettings {
  // Normalize country code to uppercase
  const normalizedCode = countryCode?.toUpperCase() || 'IN';
  
  // Get config for the country, fallback to India if not found
  const config = COUNTRY_CONFIGS[normalizedCode] || COUNTRY_CONFIGS['IN'];
  
  return {
    currency: config.currency,
    language: config.language,
    locale: config.locale,
    dateFormat: config.dateFormat,
    phoneFormat: config.phoneFormat,
    timezone: config.timezone,
    taxLabels: {
      taxId: config.taxSystem.idLabel,
      vatId: config.taxSystem.vatLabel
    }
  };
}

/** Uppercase ISO country code, or `fallback` when missing/blank (default India). */
export function resolveCountryCode(raw: unknown, fallback = 'IN'): string {
  const s = raw != null ? String(raw).trim() : '';
  if (!s) return fallback;
  return s.toUpperCase();
}

/**
 * When registration country is India, fills empty regional fields from Indian defaults
 * (currency, locale, timezone, language, billing country).
 */
export function applyIndiaRegionalDefaultsIfMissing(values: Record<string, any>): void {
  const country = resolveCountryCode(values.country ?? values.businessDetails?.country);
  if (country !== 'IN') return;
  const loc = autoPopulateLocalization('IN');
  const setIfEmpty = (key: string, value: string) => {
    const cur = values[key];
    if (cur === undefined || cur === null || String(cur).trim() === '') {
      values[key] = value;
    }
  };
  setIfEmpty('defaultCurrency', loc.currency);
  setIfEmpty('defaultLanguage', loc.language);
  setIfEmpty('defaultLocale', loc.locale);
  setIfEmpty('defaultTimeZone', loc.timezone);
  setIfEmpty('billingCountry', 'IN');
}

/**
 * Get state field configuration based on country
 */
export interface StateFieldConfig {
  visible: boolean;
  required: boolean;
  label: string;
}

export function getStateFieldConfig(countryCode: string): StateFieldConfig {
  const config = COUNTRY_CONFIGS[countryCode];
  
  if (!config || !config.hasStates) {
    return {
      visible: false,
      required: false,
      label: 'State/Province'
    };
  }
  
  return {
    visible: true,
    required: true,
    label: countryCode === 'CA' ? 'Province/Territory' : 
           countryCode === 'AU' ? 'State/Territory' : 
           'State'
  };
}

/**
 * Get country configuration
 */
export function getCountryConfig(countryCode: string): CountryConfig {
  return COUNTRY_CONFIGS[countryCode] || COUNTRY_CONFIGS['IN'];
}

