import React, { useState, useEffect, useCallback } from 'react'
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Building2,
  Mail,
  MapPin,
  FileText,
  Palette,
  CreditCard,
  Languages,
  Save,
} from 'lucide-react'
import { api } from '@/lib/api'
import axios from 'axios'
import { useToast } from '@/features/onboarding/components/Toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/useSharedQueries'
import type { AccountSettingsData } from '../types'
import { CompanyInfoTab } from '../components/CompanyInfoTab'
import { ContactTab } from '../components/ContactTab'
import { MailingTab } from '../components/MailingTab'
import { BankingTab } from '../components/BankingTab'
import { TaxComplianceTab } from '../components/TaxComplianceTab'
import { LocalizationTab } from '../components/LocalizationTab'
import { BrandingTab } from '../components/BrandingTab'

const ACCOUNT_SETTINGS_TABS = [
  'company',
  'contact',
  'mailing',
  'banking',
  'tax',
  'localization',
  'branding',
] as const

export const AccountSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useDashboardTabParam({
    allowed: ACCOUNT_SETTINGS_TABS,
    defaultTab: 'company',
  })
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const form = useForm<AccountSettingsData>({
    defaultValues: {
      mailingAddressSameAsRegistered: true,
      taxRegistrationDetails: {},
      brandingConfig: {},
    },
  })

  const mailingAddressSameAsRegistered = form.watch(
    'mailingAddressSameAsRegistered'
  )
  const billingCountry = form.watch('billingCountry')
  const taxRegistered = form.watch('taxRegistered')
  const taxExemptStatus = form.watch('taxExemptStatus')
  const withholdingTaxApplicable = form.watch('withholdingTaxApplicable')
  const vatGstRegistered = form.watch('vatGstRegistered')
  const professionalIndemnityInsurance = form.watch(
    'professionalIndemnityInsurance'
  )
  const fiscalYearStartMonth = form.watch('fiscalYearStartMonth')
  const fiscalYearEndMonth = form.watch('fiscalYearEndMonth')
  const fiscalYearStartDay = form.watch('fiscalYearStartDay')
  const fiscalYearEndDay = form.watch('fiscalYearEndDay')

  useEffect(() => {
    let isMounted = true

    const loadTenantData = async () => {
      try {
        setIsLoading(true)
        const response = await api.get('/tenants/current')
        const tenantData = response.data?.data || response.data

        if (!isMounted) return

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
          contactPreferredContactMethod:
            tenantData.contactPreferredContactMethod || '',
          contactAuthorityLevel: tenantData.contactAuthorityLevel || '',
          preferredContactMethod: tenantData.preferredContactMethod || '',
          mailingAddressSameAsRegistered:
            tenantData.mailingAddressSameAsRegistered ?? true,
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
          taxExemptionCertificateNumber:
            tenantData.taxExemptionCertificateNumber || '',
          taxExemptionExpiryDate: tenantData.taxExemptionExpiryDate || '',
          withholdingTaxApplicable:
            tenantData.withholdingTaxApplicable || false,
          withholdingTaxRate: tenantData.withholdingTaxRate || undefined,
          taxTreatyCountry: tenantData.taxTreatyCountry || '',
          w9StatusUs: tenantData.w9StatusUs || '',
          w8FormTypeUs: tenantData.w8FormTypeUs || '',
          reverseChargeMechanism: tenantData.reverseChargeMechanism || false,
          vatGstRateApplicable: tenantData.vatGstRateApplicable || '',
          regulatoryComplianceStatus:
            tenantData.regulatoryComplianceStatus || 'Pending',
          industrySpecificLicenses: tenantData.industrySpecificLicenses || '',
          dataProtectionRegistration:
            tenantData.dataProtectionRegistration || '',
          professionalIndemnityInsurance:
            tenantData.professionalIndemnityInsurance || false,
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
        })

        if (tenantData.logoUrl && isMounted) {
          setLogoPreview(tenantData.logoUrl)
        }
      } catch (error: unknown) {
        if (!isMounted) return
        console.error('Failed to load tenant data:', error)
        addToast('Failed to load account settings. Please try again.', {
          type: 'error',
        })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadTenantData()

    return () => {
      isMounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('Logo must be less than 5MB', { type: 'error' })
        return
      }
      if (!file.type.startsWith('image/')) {
        addToast('Please upload an image file', { type: 'error' })
        return
      }
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = useCallback(
    async (data: AccountSettingsData) => {
      try {
        setIsSaving(true)

        // If a new logo file was selected, upload it to S3 first
        if (logoFile) {
          const formData = new FormData()
          formData.append('logo', logoFile)
          const uploadResponse = await api.post('/tenants/logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          const newLogoUrl: string = uploadResponse.data?.data?.logoUrl
          if (newLogoUrl) {
            setLogoPreview(newLogoUrl)
            form.setValue('logoUrl', newLogoUrl)
          }
          setLogoFile(null)
        }

        const updateData: Partial<AccountSettingsData> = {
          mailingAddressSameAsRegistered:
            data.mailingAddressSameAsRegistered ?? true,
        }

        // Generic copy keeps the key/value types correlated so the assignment is sound.
        const assign = <K extends keyof AccountSettingsData>(
          key: K,
          value: AccountSettingsData[K]
        ) => {
          updateData[key] = value
        }

        ;(Object.keys(data) as Array<keyof AccountSettingsData>).forEach(
          (key) => {
            const value = data[key]
            if (value !== undefined && value !== null && value !== '') {
              if (typeof value === 'object' && !Array.isArray(value)) {
                if (Object.keys(value).length > 0) {
                  assign(key, value)
                }
              } else {
                assign(key, value)
              }
            }
          }
        )

        await api.patch('/tenants/current', updateData)
        // Refresh tenant cache so logo/name updates appear in sidebar immediately
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant })
        addToast('Account settings updated successfully', { type: 'success' })
      } catch (error: unknown) {
        console.error('Failed to save account settings:', error)
        const serverError = axios.isAxiosError(error)
          ? (error.response?.data as { error?: string } | undefined)?.error
          : undefined
        addToast(
          serverError || 'Failed to save account settings. Please try again.',
          { type: 'error' }
        )
      } finally {
        setIsSaving(false)
      }
    },
    [logoFile, addToast, form]
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Loading account settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList
            className="grid w-full grid-cols-7"
            style={{
              background: 'var(--zk-paper)',
              border: '1px solid var(--zk-line)',
              display: 'flex',
            }}
          >
            <TabsTrigger
              value="company"
              style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Company
            </TabsTrigger>
            <TabsTrigger
              value="contact"
              style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}
            >
              <Mail className="mr-2 h-4 w-4" />
              Contact
            </TabsTrigger>
            <TabsTrigger
              value="mailing"
              style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Mailing
            </TabsTrigger>
            <TabsTrigger
              value="banking"
              style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Banking
            </TabsTrigger>
            <TabsTrigger
              value="tax"
              style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Tax & Compliance
            </TabsTrigger>
            <TabsTrigger
              value="localization"
              style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}
            >
              <Languages className="mr-2 h-4 w-4" />
              Localization
            </TabsTrigger>
            <TabsTrigger
              value="branding"
              style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}
            >
              <Palette className="mr-2 h-4 w-4" />
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

          <div
            className="flex justify-end gap-4 pt-6"
            style={{ borderTop: '1px solid var(--zk-line)' }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              style={{ fontFamily: 'var(--zk-font)', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              style={{
                background: 'var(--zk-navy)',
                fontFamily: 'var(--zk-font)',
                fontWeight: 600,
              }}
            >
              {isSaving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </Tabs>
      </form>
    </div>
  )
}

export default AccountSettings
