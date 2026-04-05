/**
 * Onboarding Schemas and Constants
 */

// Organization Sizes
export const ORGANIZATION_SIZES = [
  { id: '1-10', name: '1-10 employees' },
  { id: '11-50', name: '11-50 employees' },
  { id: '51-200', name: '51-200 employees' },
  { id: '201-500', name: '201-500 employees' },
  { id: '501-1000', name: '501-1000 employees' },
  { id: '1000+', name: '1000+ employees' },
];

// Contact Methods
export const CONTACT_METHODS = [
  { id: 'email', name: 'Email' },
  { id: 'phone', name: 'Phone' },
  { id: 'sms', name: 'SMS/Text' },
  { id: 'whatsapp', name: 'WhatsApp' },
];

// Contact Salutations
export const CONTACT_SALUTATIONS = [
  { id: 'mr', name: 'Mr.' },
  { id: 'mrs', name: 'Mrs.' },
  { id: 'ms', name: 'Ms.' },
  { id: 'dr', name: 'Dr.' },
  { id: 'prof', name: 'Prof.' },
  { id: 'none', name: 'None' },
];

// Contact Authority Levels
export const CONTACT_AUTHORITY_LEVELS = [
  { id: 'owner', name: 'Owner/Founder' },
  { id: 'ceo', name: 'CEO' },
  { id: 'cfo', name: 'CFO' },
  { id: 'cto', name: 'CTO' },
  { id: 'director', name: 'Director' },
  { id: 'manager', name: 'Manager' },
  { id: 'admin', name: 'Administrator' },
  { id: 'other', name: 'Other' },
];

// Languages
export const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'hi', name: 'Hindi' },
  { id: 'es', name: 'Spanish' },
  { id: 'fr', name: 'French' },
  { id: 'de', name: 'German' },
  { id: 'zh', name: 'Chinese' },
  { id: 'ja', name: 'Japanese' },
];

// Locales
export const LOCALES = [
  { id: 'en-US', name: 'English (US)' },
  { id: 'en-IN', name: 'English (India)' },
  { id: 'en-GB', name: 'English (UK)' },
  { id: 'en-CA', name: 'English (Canada)' },
  { id: 'en-AU', name: 'English (Australia)' },
  { id: 'en-SG', name: 'English (Singapore)' },
  { id: 'en-AE', name: 'English (UAE)' },
  { id: 'hi-IN', name: 'Hindi (India)' },
  { id: 'es-ES', name: 'Spanish (Spain)' },
  { id: 'fr-FR', name: 'French (France)' },
];

// Currencies
export const CURRENCIES = [
  { id: 'USD', name: 'US Dollar ($)' },
  { id: 'INR', name: 'Indian Rupee (₹)' },
  { id: 'GBP', name: 'British Pound (£)' },
  { id: 'EUR', name: 'Euro (€)' },
  { id: 'CAD', name: 'Canadian Dollar (C$)' },
  { id: 'AUD', name: 'Australian Dollar (A$)' },
  { id: 'SGD', name: 'Singapore Dollar (S$)' },
  { id: 'AED', name: 'UAE Dirham (د.إ)' },
];

// Timezones (common ones)
export const TIMEZONES = [
  { id: 'America/New_York', name: 'Eastern Time (ET)' },
  { id: 'America/Chicago', name: 'Central Time (CT)' },
  { id: 'America/Denver', name: 'Mountain Time (MT)' },
  { id: 'America/Los_Angeles', name: 'Pacific Time (PT)' },
  { id: 'America/Toronto', name: 'Canada Eastern Time (ET)' },
  { id: 'America/Vancouver', name: 'Canada Pacific Time (PT)' },
  { id: 'Asia/Kolkata', name: 'India Standard Time (IST)' },
  { id: 'Asia/Dubai', name: 'Gulf Standard Time (GST)' },
  { id: 'Asia/Singapore', name: 'Singapore Time (SGT)' },
  { id: 'Europe/London', name: 'Greenwich Mean Time (GMT)' },
  { id: 'Europe/Paris', name: 'Central European Time (CET)' },
  { id: 'Australia/Sydney', name: 'Australian Eastern Time (AET)' },
  { id: 'Australia/Perth', name: 'Australian Western Time (AWT)' },
];

// Countries (Top markets)
export const COUNTRIES = [
  { id: 'IN', name: 'India', flag: '🇮🇳' },
  { id: 'US', name: 'United States', flag: '🇺🇸' },
  { id: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
  { id: 'CA', name: 'Canada', flag: '🇨🇦' },
  { id: 'AU', name: 'Australia', flag: '🇦🇺' },
  { id: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { id: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { id: 'OTHER', name: 'Other', flag: '🌐' },
];

// Indian States
export const STATES = [
  { id: 'AP', name: 'Andhra Pradesh' },
  { id: 'AR', name: 'Arunachal Pradesh' },
  { id: 'AS', name: 'Assam' },
  { id: 'BR', name: 'Bihar' },
  { id: 'CT', name: 'Chhattisgarh' },
  { id: 'GA', name: 'Goa' },
  { id: 'GJ', name: 'Gujarat' },
  { id: 'HR', name: 'Haryana' },
  { id: 'HP', name: 'Himachal Pradesh' },
  { id: 'JK', name: 'Jammu and Kashmir' },
  { id: 'JH', name: 'Jharkhand' },
  { id: 'KA', name: 'Karnataka' },
  { id: 'KL', name: 'Kerala' },
  { id: 'MP', name: 'Madhya Pradesh' },
  { id: 'MH', name: 'Maharashtra' },
  { id: 'MN', name: 'Manipur' },
  { id: 'ML', name: 'Meghalaya' },
  { id: 'MZ', name: 'Mizoram' },
  { id: 'NL', name: 'Nagaland' },
  { id: 'OR', name: 'Odisha' },
  { id: 'PB', name: 'Punjab' },
  { id: 'RJ', name: 'Rajasthan' },
  { id: 'SK', name: 'Sikkim' },
  { id: 'TN', name: 'Tamil Nadu' },
  { id: 'TG', name: 'Telangana' },
  { id: 'TR', name: 'Tripura' },
  { id: 'UP', name: 'Uttar Pradesh' },
  { id: 'UT', name: 'Uttarakhand' },
  { id: 'WB', name: 'West Bengal' },
  { id: 'AN', name: 'Andaman and Nicobar Islands' },
  { id: 'CH', name: 'Chandigarh' },
  { id: 'DN', name: 'Dadra and Nagar Haveli' },
  { id: 'DD', name: 'Daman and Diu' },
  { id: 'DL', name: 'Delhi' },
  { id: 'LD', name: 'Lakshadweep' },
  { id: 'PY', name: 'Puducherry' },
];

// Company Types
export const COMPANY_TYPES = [
  { id: 'private-limited', name: 'Private Limited Company' },
  { id: 'public-limited', name: 'Public Limited Company' },
  { id: 'llp', name: 'Limited Liability Partnership (LLP)' },
  { id: 'partnership', name: 'Partnership Firm' },
  { id: 'sole-proprietorship', name: 'Sole Proprietorship' },
  { id: 'one-person-company', name: 'One Person Company (OPC)' },
  { id: 'section-8', name: 'Section 8 Company (Non-Profit)' },
  { id: 'corporation', name: 'Corporation (Inc.)' },
  { id: 'llc', name: 'Limited Liability Company (LLC)' },
];

// Business Types
export const BUSINESS_TYPES = [
  { id: 'technology', name: 'Technology & Software' },
  { id: 'healthcare', name: 'Healthcare & Medical' },
  { id: 'finance', name: 'Finance & Banking' },
  { id: 'retail', name: 'Retail & E-commerce' },
  { id: 'manufacturing', name: 'Manufacturing & Industrial' },
  { id: 'consulting', name: 'Consulting & Professional Services' },
  { id: 'education', name: 'Education & Training' },
  { id: 'real-estate', name: 'Real Estate' },
  { id: 'hospitality', name: 'Hospitality & Tourism' },
  { id: 'non-profit', name: 'Non-Profit & NGO' },
  { id: 'other', name: 'Other' },
];

// Team Member interface
export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
}

// Business Details nested structure
export interface BusinessDetails {
  companyName?: string;
  businessType?: string;
  organizationSize?: string;
  country?: string;
  description?: string;
}

// Form data types
export interface newBusinessData {
  companyType?: string;
  state?: string;
  businessName?: string;
  businessType?: string;
  organizationSize?: string; // New
  country?: string; // New
  businessDetails?: BusinessDetails; // Nested structure for form
  
  // Tax & Compliance
  taxRegistered?: boolean; // New
  vatGstRegistered?: boolean; // New
  gstin?: string;
  panNumber?: string; // New
  cinNumber?: string; // New
  vatNumber?: string; // New
  einNumber?: string; // New
  incorporationState?: string;
  
  // Addresses
  billingAddress?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  
  mailingAddressSameAsRegistered?: boolean; // New
  mailingAddress?: string; // New
  mailingStreet?: string; // New
  mailingCity?: string; // New
  mailingState?: string; // New
  mailingZip?: string; // New
  mailingCountry?: string; // New
  
  // Admin / Contact
  teamMembers?: TeamMember[];
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  
  adminEmail?: string;
  adminMobile?: string;
  adminPhone?: string;
  billingEmail?: string; // New
  supportEmail?: string; // New
  
  contactJobTitle?: string; // New
  preferredContactMethod?: string; // New
  contactSalutation?: string; // New
  contactMiddleName?: string; // New
  contactDepartment?: string; // New
  contactAuthorityLevel?: string; // New
  contactDirectPhone?: string; // New
  contactMobilePhone?: string; // New
  
  website?: string;
  
  // Localization
  defaultLanguage?: string; // New
  defaultLocale?: string; // New
  defaultCurrency?: string; // New
  defaultTimeZone?: string; // New
  
  // Terms
  termsAccepted?: boolean; // New
  
  // New onboarding steps (optional)
  selectedCreditPackage?: string; // Package ID
  organizationHierarchyViewed?: boolean; // Track if user viewed hierarchy guide
  settingsOverviewViewed?: boolean; // Track if user viewed settings
}

export interface existingBusinessData {
  companyType?: string;
  state?: string;
  businessName?: string;
  businessType?: string;
  organizationSize?: string; // New
  country?: string; // New
  businessDetails?: BusinessDetails; // Nested structure for form
  
  // Tax & Compliance
  taxRegistered?: boolean; // New
  vatGstRegistered?: boolean; // New
  gstin?: string;
  panNumber?: string; // New
  cinNumber?: string; // New
  vatNumber?: string; // New
  einNumber?: string; // New
  incorporationState?: string;
  
  // Addresses
  billingAddress?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  
  mailingAddressSameAsRegistered?: boolean; // New
  mailingAddress?: string; // New
  mailingStreet?: string; // New
  mailingCity?: string; // New
  mailingState?: string; // New
  mailingZip?: string; // New
  mailingCountry?: string; // New
  
  // Admin / Contact
  teamMembers?: TeamMember[];
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  
  adminEmail?: string;
  adminMobile?: string;
  adminPhone?: string;
  billingEmail?: string; // New
  supportEmail?: string; // New
  
  contactJobTitle?: string; // New
  preferredContactMethod?: string; // New
  contactSalutation?: string; // New
  contactMiddleName?: string; // New
  contactDepartment?: string; // New
  contactAuthorityLevel?: string; // New
  contactDirectPhone?: string; // New
  contactMobilePhone?: string; // New
  
  website?: string;
  
  // Localization
  defaultLanguage?: string; // New
  defaultLocale?: string; // New
  defaultCurrency?: string; // New
  defaultTimeZone?: string; // New
  
  // Terms
  termsAccepted?: boolean; // New
  
  // New onboarding steps (optional)
  selectedCreditPackage?: string; // Package ID
  organizationHierarchyViewed?: boolean; // Track if user viewed hierarchy guide
  settingsOverviewViewed?: boolean; // Track if user viewed settings
}
