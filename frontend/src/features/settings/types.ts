export interface AccountSettingsData {
  // Company Information
  legalCompanyName?: string;
  logoUrl?: string;

  // Contact Details
  billingEmail?: string;
  supportEmail?: string;
  contactSalutation?: string;
  contactMiddleName?: string;
  contactDepartment?: string;
  contactJobTitle?: string;
  contactDirectPhone?: string;
  contactMobilePhone?: string;
  contactPreferredContactMethod?: string;
  contactAuthorityLevel?: string;
  preferredContactMethod?: string;

  // Mailing Address
  mailingAddressSameAsRegistered: boolean;
  mailingStreet?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  mailingCountry?: string;

  // Banking & Financial Information
  bankName?: string;
  bankBranch?: string;
  accountHolderName?: string;
  accountNumber?: string;
  accountType?: string;
  bankAccountCurrency?: string;
  swiftBicCode?: string;
  iban?: string;
  routingNumberUs?: string;
  sortCodeUk?: string;
  ifscCodeIndia?: string;
  bsbNumberAustralia?: string;
  paymentTerms?: string;
  creditLimit?: number;
  preferredPaymentMethod?: string;

  // Tax & Compliance
  taxResidenceCountry?: string;
  taxExemptStatus?: boolean;
  taxExemptionCertificateNumber?: string;
  taxExemptionExpiryDate?: string;
  withholdingTaxApplicable?: boolean;
  withholdingTaxRate?: number;
  taxTreatyCountry?: string;
  w9StatusUs?: string;
  w8FormTypeUs?: string;
  reverseChargeMechanism?: boolean;
  vatGstRateApplicable?: string;
  regulatoryComplianceStatus?: string;
  industrySpecificLicenses?: string;
  dataProtectionRegistration?: string;
  professionalIndemnityInsurance?: boolean;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: string;
  taxRegistrationDetails?: {
    pan?: string;
    ein?: string;
    vat?: string;
    cin?: string;
  };

  // Localization
  defaultLanguage?: string;
  defaultLocale?: string;
  defaultCurrency?: string;
  defaultTimeZone?: string;
  fiscalYearStartMonth?: number;
  fiscalYearEndMonth?: number;
  fiscalYearStartDay?: number;
  fiscalYearEndDay?: number;

  // Branding
  primaryColor?: string;
  customDomain?: string;
  brandingConfig?: Record<string, any>;

  // For conditional logic
  billingCountry?: string;
  vatGstRegistered?: boolean;
  taxRegistered?: boolean;
}
