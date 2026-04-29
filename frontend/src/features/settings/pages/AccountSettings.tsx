import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2,
  Mail,
  MapPin,
  FileText,
  Palette,
  CreditCard,
  Languages,
  Save,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/features/onboarding/components/Toast';
import type { AccountSettingsData } from '../types';
import { CompanyInfoTab } from '../components/CompanyInfoTab';
import { ContactTab } from '../components/ContactTab';
import { MailingTab } from '../components/MailingTab';
import { BankingTab } from '../components/BankingTab';
import { TaxComplianceTab } from '../components/TaxComplianceTab';
import { LocalizationTab } from '../components/LocalizationTab';
import { BrandingTab } from '../components/BrandingTab';

const ACCOUNT_SETTINGS_TABS = [
  'company',
  'contact',
  'mailing',
  'banking',
  'tax',
  'localization',
  'branding',
] as const;

export const AccountSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useDashboardTabParam({
    allowed: ACCOUNT_SETTINGS_TABS,
    defaultTab: 'company',
  });
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const form = useForm<AccountSettingsData>({
    defaultValues: {
      mailingAddressSameAsRegistered: true,
      taxRegistrationDetails: {},
      brandingConfig: {},
    },
  });

  const mailingAddressSameAsRegistered = form.watch('mailingAddressSameAsRegistered');
  const billingCountry = form.watch('billingCountry');
  const taxRegistered = form.watch('taxRegistered');
  const taxExemptStatus = form.watch('taxExemptStatus');
  const withholdingTaxApplicable = form.watch('withholdingTaxApplicable');
  const vatGstRegistered = form.watch('vatGstRegistered');
  const professionalIndemnityInsurance = form.watch('professionalIndemnityInsurance');
  const fiscalYearStartMonth = form.watch('fiscalYearStartMonth');
  const fiscalYearEndMonth = form.watch('fiscalYearEndMonth');
  const fiscalYearStartDay = form.watch('fiscalYearStartDay');
  const fiscalYearEndDay = form.watch('fiscalYearEndDay');

  useEffect(() => {
    let isMounted = true;

    const loadTenantData = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/tenants/current');
        const tenantData = response.data?.data || response.data;

        if (!isMounted) return;

        form.reset({
          legalCompanyName: tenantData.legalCompanyName || '',
          logoUrl: tenantData.logoUrl || '',
          billingEmail: tenantData.billingEmail || '',
          supportEmail: tenantData.supportEmail || '',
          contactSalutation: tenantData.contactSalutation || '',
          contactMiddleName: tenantData.contactMiddleName || '',
          contactDepartment: tenantData.contactDepartment || '',
          contactJobTitle: tenantData.contactJobTitle || '',
          contactDirectPhone: tenantData.contactDirectPhone || '',
          contactMobilePhone: tenantData.contactMobilePhone || '',
          contactPreferredContactMethod: tenantData.contactPreferredContactMethod || '',
          contactAuthorityLevel: tenantData.contactAuthorityLevel || '',
          preferredContactMethod: tenantData.preferredContactMethod || '',
          mailingAddressSameAsRegistered: tenantData.mailingAddressSameAsRegistered ?? true,
          mailingStreet: tenantData.mailingStreet || '',
          mailingCity: tenantData.mailingCity || '',
          mailingState: tenantData.mailingState || '',
          mailingZip: tenantData.mailingZip || '',
          mailingCountry: tenantData.mailingCountry || '',
          bankName: tenantData.bankName || '',
          bankBranch: tenantData.bankBranch || '',
          accountHolderName: tenantData.accountHolderName || '',
          accountNumber: tenantData.accountNumber || '',
          accountType: tenantData.accountType || '',
          bankAccountCurrency: tenantData.bankAccountCurrency || '',
          swiftBicCode: tenantData.swiftBicCode || '',
          iban: tenantData.iban || '',
          routingNumberUs: tenantData.routingNumberUs || '',
          sortCodeUk: tenantData.sortCodeUk || '',
          ifscCodeIndia: tenantData.ifscCodeIndia || '',
          bsbNumberAustralia: tenantData.bsbNumberAustralia || '',
          paymentTerms: tenantData.paymentTerms || '',
          creditLimit: tenantData.creditLimit || undefined,
          preferredPaymentMethod: tenantData.preferredPaymentMethod || '',
          taxResidenceCountry: tenantData.taxResidenceCountry || '',
          taxExemptStatus: tenantData.taxExemptStatus || false,
          taxExemptionCertificateNumber: tenantData.taxExemptionCertificateNumber || '',
          taxExemptionExpiryDate: tenantData.taxExemptionExpiryDate || '',
          withholdingTaxApplicable: tenantData.withholdingTaxApplicable || false,
          withholdingTaxRate: tenantData.withholdingTaxRate || undefined,
          taxTreatyCountry: tenantData.taxTreatyCountry || '',
          w9StatusUs: tenantData.w9StatusUs || '',
          w8FormTypeUs: tenantData.w8FormTypeUs || '',
          reverseChargeMechanism: tenantData.reverseChargeMechanism || false,
          vatGstRateApplicable: tenantData.vatGstRateApplicable || '',
          regulatoryComplianceStatus: tenantData.regulatoryComplianceStatus || 'Pending',
          industrySpecificLicenses: tenantData.industrySpecificLicenses || '',
          dataProtectionRegistration: tenantData.dataProtectionRegistration || '',
          professionalIndemnityInsurance: tenantData.professionalIndemnityInsurance || false,
          insurancePolicyNumber: tenantData.insurancePolicyNumber || '',
          insuranceExpiryDate: tenantData.insuranceExpiryDate || '',
          taxRegistrationDetails: tenantData.taxRegistrationDetails || {},
          defaultLanguage: tenantData.defaultLanguage || 'en',
          defaultLocale: tenantData.defaultLocale || 'en-US',
          defaultCurrency: tenantData.defaultCurrency || 'USD',
          defaultTimeZone: tenantData.defaultTimeZone || 'UTC',
          fiscalYearStartMonth: tenantData.fiscalYearStartMonth || 1,
          fiscalYearEndMonth: tenantData.fiscalYearEndMonth || 12,
          fiscalYearStartDay: tenantData.fiscalYearStartDay || 1,
          fiscalYearEndDay: tenantData.fiscalYearEndDay || 31,
          primaryColor: tenantData.primaryColor || '#2563eb',
          customDomain: tenantData.customDomain || '',
          brandingConfig: tenantData.brandingConfig || {},
          billingCountry: tenantData.billingCountry || '',
          vatGstRegistered: tenantData.vatGstRegistered || false,
          taxRegistered: tenantData.taxRegistered || false,
        });

        if (tenantData.logoUrl && isMounted) {
          setLogoPreview(tenantData.logoUrl);
        }
      } catch (error: any) {
        if (!isMounted) return;
        console.error('Failed to load tenant data:', error);
        addToast('Failed to load account settings. Please try again.', { type: 'error' });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTenantData();

    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('Logo must be less than 5MB', { type: 'error' });
        return;
      }
      if (!file.type.startsWith('image/')) {
        addToast('Please upload an image file', { type: 'error' });
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = useCallback(async (data: AccountSettingsData) => {
    try {
      setIsSaving(true);

      // If a new logo file was selected, upload it to S3 first
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        const uploadResponse = await api.post('/tenants/logo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const newLogoUrl: string = uploadResponse.data?.data?.logoUrl;
        if (newLogoUrl) {
          setLogoPreview(newLogoUrl);
          form.setValue('logoUrl', newLogoUrl);
        }
        setLogoFile(null);
      }

      const updateData: Partial<AccountSettingsData> = {
        mailingAddressSameAsRegistered: data.mailingAddressSameAsRegistered ?? true,
      };

      Object.keys(data).forEach((key) => {
        const value = data[key as keyof AccountSettingsData];
        if (value !== undefined && value !== null && value !== '') {
          if (typeof value === 'object' && !Array.isArray(value)) {
            if (Object.keys(value).length > 0) {
              updateData[key as keyof AccountSettingsData] = value;
            }
          } else {
            updateData[key as keyof AccountSettingsData] = value;
          }
        }
      });

      await api.patch('/tenants/current', updateData);
      addToast('Account settings updated successfully', { type: 'success' });
    } catch (error: any) {
      console.error('Failed to save account settings:', error);
      addToast(error.response?.data?.error || 'Failed to save account settings. Please try again.', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [logoFile, addToast, form]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading account settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="company">
              <Building2 className="h-4 w-4 mr-2" />
              Company
            </TabsTrigger>
            <TabsTrigger value="contact">
              <Mail className="h-4 w-4 mr-2" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="mailing">
              <MapPin className="h-4 w-4 mr-2" />
              Mailing
            </TabsTrigger>
            <TabsTrigger value="banking">
              <CreditCard className="h-4 w-4 mr-2" />
              Banking
            </TabsTrigger>
            <TabsTrigger value="tax">
              <FileText className="h-4 w-4 mr-2" />
              Tax & Compliance
            </TabsTrigger>
            <TabsTrigger value="localization">
              <Languages className="h-4 w-4 mr-2" />
              Localization
            </TabsTrigger>
            <TabsTrigger value="branding">
              <Palette className="h-4 w-4 mr-2" />
              Branding
            </TabsTrigger>
          </TabsList>

          <CompanyInfoTab
            form={form}
            logoPreview={logoPreview}
            logoFile={logoFile}
            handleLogoUpload={handleLogoUpload}
          />
          <ContactTab form={form} />
          <MailingTab
            form={form}
            mailingAddressSameAsRegistered={mailingAddressSameAsRegistered}
          />
          <BankingTab form={form} billingCountry={billingCountry} />
          <TaxComplianceTab
            form={form}
            billingCountry={billingCountry}
            taxRegistered={taxRegistered}
            taxExemptStatus={taxExemptStatus}
            withholdingTaxApplicable={withholdingTaxApplicable}
            vatGstRegistered={vatGstRegistered}
            professionalIndemnityInsurance={professionalIndemnityInsurance}
          />
          <LocalizationTab
            form={form}
            fiscalYearStartMonth={fiscalYearStartMonth}
            fiscalYearEndMonth={fiscalYearEndMonth}
            fiscalYearStartDay={fiscalYearStartDay}
            fiscalYearEndDay={fiscalYearEndDay}
          />
          <BrandingTab form={form} />

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </Tabs>
      </form>
    </div>
  );
};

export default AccountSettings;
