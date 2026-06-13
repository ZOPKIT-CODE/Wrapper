import { Input } from '@/components/ui/input'
import { logger } from '@/lib/logger'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { UseFormReturn, type FieldPath } from 'react-hook-form'
import {
  newBusinessData,
  existingBusinessData,
  BUSINESS_TYPES,
  ORGANIZATION_SIZES,
  COUNTRIES,
  COMPANY_TYPES,
  LANGUAGES,
  LOCALES,
  CURRENCIES,
  TIMEZONES,
} from '../../schemas'
import { Badge } from '@/components/ui/badge'
import { UserClassification } from '../FlowSelector'
import {
  Building2,
  Globe,
  Users2,
  FileText,
  CheckCircle2,
  Briefcase,
  Settings2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
  Calendar,
  Info,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  autoPopulateLocalization,
  resolveCountryCode,
} from '../../config/countryConfig'
import React, { useEffect, useState, memo, useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface BusinessDetailsStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>
  userClassification?: UserClassification
}

// react-hook-form field path for this step's form value union
type FormPath = FieldPath<newBusinessData | existingBusinessData>

export const BusinessDetailsStep: React.FC<BusinessDetailsStepProps> = memo(
  ({ form, userClassification }) => {
    const getPersonalizedContent = () => {
      switch (userClassification) {
        case 'aspiringFounder':
          return {
            title: 'Company details',
            description:
              'Legal name, country, and basics—used for compliance and your workspace.',
            placeholder: 'Short description of what your company does…',
          }
        case 'enterprise':
          return {
            title: 'Company details',
            description:
              'Organization profile for billing, tax, and access. Required fields are marked *.',
            placeholder: 'Short description of what your company does…',
          }
        default:
          return {
            title: 'Company details',
            description:
              'Complete the fields below. Required items are marked *.',
            placeholder: 'Short description of what your company does…',
          }
      }
    }
    const content = getPersonalizedContent()
    const showGSTField = userClassification === 'withGST'
    const [isRegionalSettingsOpen, setIsRegionalSettingsOpen] = useState(true)
    const [regionalFlash, setRegionalFlash] = useState(false)

    // Use useWatch to reactively get country without causing re-renders on other field changes
    const businessDetailsCountry = useWatch({
      control: form.control,
      name: 'businessDetails.country' as FormPath,
    })
    const rootCountry = useWatch({ control: form.control, name: 'country' })
    // country is always a string at runtime; coerce so the union-typed watch value is usable
    const selectedCountry = String(
      businessDetailsCountry || rootCountry || 'IN'
    )

    // Auto-populate localization when country changes - use useMemo to prevent re-renders
    const localizationConfig = useMemo(() => {
      const countryCode = selectedCountry?.toUpperCase()
      if (countryCode && countryCode !== 'OTHER' && countryCode !== '') {
        try {
          return autoPopulateLocalization(countryCode)
        } catch (error) {
          logger.warn(
            'Error populating localization for country:',
            countryCode,
            error
          )
          return null
        }
      }
      return null
    }, [selectedCountry])

    // Default registration country to India and keep root `country` in sync (incl. blank restored drafts)
    useEffect(() => {
      const bd = form.getValues('businessDetails.country' as FormPath)
      const root = form.getValues('country')
      const merged = resolveCountryCode(bd ?? root)
      if ((bd ?? '') !== merged || (root ?? '') !== merged) {
        form.setValue('businessDetails.country' as FormPath, merged, {
          shouldValidate: false,
          shouldDirty: false,
        })
        form.setValue('country' as FormPath, merged, {
          shouldValidate: false,
          shouldDirty: false,
        })
      }
    }, [form])

    // Apply regional settings when Registration Country is selected (or when step loads with a country set)
    const previousCountryRef = React.useRef<string | null>(null)

    const applyRegionalSettingsFromCountry = React.useCallback(() => {
      if (!localizationConfig) return
      const countryCode = selectedCountry?.toUpperCase()
      if (!countryCode || countryCode === 'OTHER' || countryCode === '') return

      const updates: Array<{ field: FormPath; value: string }> = []
      if (localizationConfig.currency) {
        updates.push({
          field: 'defaultCurrency' as FormPath,
          value: localizationConfig.currency,
        })
      }
      if (localizationConfig.language) {
        updates.push({
          field: 'defaultLanguage' as FormPath,
          value: localizationConfig.language,
        })
      }
      if (localizationConfig.locale) {
        updates.push({
          field: 'defaultLocale' as FormPath,
          value: localizationConfig.locale,
        })
      }
      if (localizationConfig.timezone) {
        updates.push({
          field: 'defaultTimeZone' as FormPath,
          value: localizationConfig.timezone,
        })
      }
      updates.forEach(({ field, value }) => {
        form.setValue(field, value as never, {
          shouldValidate: false,
          shouldDirty: false,
          shouldTouch: false,
        })
      })
    }, [localizationConfig, selectedCountry, form])

    // When Registration Country is selected or changes (including initial load with default), apply regional settings
    useEffect(() => {
      if (!localizationConfig) return
      const countryCode = selectedCountry?.toUpperCase()
      if (!countryCode || countryCode === 'OTHER' || countryCode === '') return

      if (countryCode !== previousCountryRef.current) {
        previousCountryRef.current = countryCode
        const rafId = requestAnimationFrame(() => {
          applyRegionalSettingsFromCountry()
          // Brief highlight so users notice the fields updated
          setRegionalFlash(true)
          setTimeout(() => setRegionalFlash(false), 1200)
        })
        setIsRegionalSettingsOpen(true)
        return () => cancelAnimationFrame(rafId)
      }
    }, [localizationConfig, selectedCountry, applyRegionalSettingsFromCountry])

    const cardClasses =
      'rounded-xl border border-border/70 bg-card p-6 shadow-[0_4px_32px_-8px_rgba(15,23,42,0.08)] ring-1 ring-foreground/[0.04] sm:p-8 md:p-10'
    const labelClasses =
      'mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground'
    const inputContainerClasses = 'relative group'
    const inputClasses =
      'h-10 w-full rounded-md border border-border bg-card pl-4 pr-4 text-sm text-foreground placeholder:text-muted-foreground shadow-sm outline-none transition-colors hover:border-blue-200 focus:border-blue-700 focus:ring-2 focus:ring-blue-600/20'
    const iconClasses =
      'absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-blue-700'

    return (
      <TooltipProvider delayDuration={200}>
        <div className="space-y-6">
          <div className="relative border-b border-blue-100 pb-6">
            <div className="mb-2 flex items-center gap-2">
              {userClassification &&
                userClassification !== 'aspiringFounder' && (
                  <Badge
                    variant="outline"
                    className="rounded border border-blue-200/90 bg-blue-50 px-2 py-0.5 text-[10px] font-medium tracking-wider text-blue-900 uppercase"
                  >
                    {userClassification.replace(/([A-Z])/g, ' $1').trim()}
                  </Badge>
                )}
            </div>
            <h1 className="mb-1.5 text-2xl font-semibold tracking-tight text-blue-950 md:text-[1.65rem]">
              {content.title}
            </h1>
            <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
              {content.description}
            </p>
          </div>

          <div className={cardClasses}>
            <div className="relative z-10 space-y-6">
              {/* Country Field - MOVED TO TOP */}
              <FormField
                control={form.control}
                name={'businessDetails.country' as any}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className={`${labelClasses} flex items-center gap-2`}
                    >
                      Registration Country{' '}
                      <span className="text-red-500">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                          <p className="mb-1 font-semibold">Mandatory Field</p>
                          <p>
                            The country where your business is legally
                            registered. This determines tax rules, compliance
                            requirements, currency defaults, regional settings,
                            and available tax ID fields. Selecting a country
                            automatically configures regional settings.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <Select
                      onValueChange={(value) => {
                        const countryCode = value?.toUpperCase()
                        field.onChange(countryCode)
                        form.setValue('country' as any, countryCode, {
                          shouldValidate: false,
                        })
                      }}
                      value={field.value || 'IN'}
                    >
                      <FormControl>
                        <SelectTrigger className={`${inputClasses}`}>
                          <div className="flex items-center gap-2">
                            <Globe className="text-muted-foreground h-4 w-4" />
                            <SelectValue placeholder="Select country" />
                          </div>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="border-border bg-card/95 rounded-lg shadow-xl backdrop-blur-xl">
                        {COUNTRIES.map((country) => (
                          <SelectItem
                            key={country.id}
                            value={country.id}
                            className="hover:bg-muted focus:bg-muted cursor-pointer py-2.5"
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-base leading-none">
                                {country.flag}
                              </span>
                              {country.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {selectedCountry &&
                      selectedCountry !== 'OTHER' &&
                      (() => {
                        const c = COUNTRIES.find(
                          (c) => c.id === selectedCountry
                        )
                        return (
                          <div className="mt-2 rounded-md border border-blue-100 bg-blue-50/60 p-2.5">
                            <p className="text-foreground flex items-center gap-2 text-xs font-medium">
                              <span className="text-base leading-none">
                                {c?.flag}
                              </span>
                              <span>
                                Currency, timezone &amp; locale auto-configured
                                for {c?.name}
                              </span>
                            </p>
                          </div>
                        )
                      })()}
                  </FormItem>
                )}
              />

              {/* Company Name */}
              <FormField
                control={form.control}
                name={'businessDetails.companyName' as any}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className={`${labelClasses} flex items-center gap-2`}
                    >
                      Company Name <span className="text-red-500">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                          <p className="mb-1 font-semibold">Mandatory Field</p>
                          <p>
                            The legal or trading name of your business as
                            registered with the authorities. This name appears
                            on official documents, invoices, tax filings, and
                            legal contracts. Must exactly match your business
                            registration certificate or incorporation documents.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <div className={inputContainerClasses}>
                      <Building2 className={iconClasses} />
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          className={`${inputClasses} pl-11`}
                          placeholder="e.g. Acme Innovations Private Limited"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company Website */}
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className={`${labelClasses} flex items-center gap-2`}
                    >
                      Company Website
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                          <p>
                            Your company website URL helps establish credibility
                            and provides a reference for your business.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <div className={inputContainerClasses}>
                      <Globe className={iconClasses} />
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          type="url"
                          className={`${inputClasses} pl-11`}
                          placeholder="https://www.yourcompany.com"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Company Type - Merged from separate step */}
                <FormField
                  control={form.control}
                  name="companyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        className={`${labelClasses} flex items-center gap-2`}
                      >
                        Company Type <span className="text-red-500">*</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                            <p className="mb-1 font-semibold">
                              Mandatory Field
                            </p>
                            <p>
                              The legal structure of your business (e.g.,
                              Private Limited, LLP, Sole Proprietorship). This
                              determines tax obligations, liability, and
                              compliance requirements.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger className={`${inputClasses}`}>
                            <div className="flex items-center gap-2">
                              <Briefcase className="text-muted-foreground h-4 w-4" />
                              <SelectValue placeholder="Select company type" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent
                          position="popper"
                          className="border-border bg-card/95 max-h-[300px] rounded-lg shadow-xl backdrop-blur-xl"
                        >
                          {COMPANY_TYPES.map((type) => (
                            <SelectItem
                              key={type.id}
                              value={type.id}
                              className="hover:bg-muted focus:bg-muted cursor-pointer py-2.5"
                            >
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={'businessDetails.businessType' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        className={`${labelClasses} flex items-center gap-2`}
                      >
                        Business Type <span className="text-red-500">*</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                            <p className="mb-1 font-semibold">
                              Mandatory Field
                            </p>
                            <p>
                              The primary industry or sector your business
                              operates in (e.g., Technology, Healthcare,
                              Retail). Used for compliance, reporting, and
                              feature recommendations.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger className={`${inputClasses} pl-4`}>
                            <div className="flex items-center gap-2">
                              <FileText className="text-muted-foreground h-4 w-4" />
                              <SelectValue placeholder="Select type" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="border-border bg-card/95 max-h-[300px] rounded-xl shadow-xl backdrop-blur-xl">
                          {BUSINESS_TYPES.map((type) => (
                            <SelectItem
                              key={type.id}
                              value={type.id}
                              className="focus:bg-muted cursor-pointer py-3"
                            >
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={'businessDetails.organizationSize' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        className={`${labelClasses} flex items-center gap-2`}
                      >
                        Team Size{' '}
                        <span className="text-muted-foreground font-normal">
                          (Optional)
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                            <p className="mb-1 font-semibold">Optional Field</p>
                            <p>
                              Number of employees helps us customize features,
                              pricing tiers, and provide relevant
                              recommendations for your organization size.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger className={inputClasses}>
                            <div className="flex items-center gap-2">
                              <Users2 className="text-muted-foreground h-4 w-4" />
                              <SelectValue placeholder="Select size" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="border-border bg-card/95 rounded-xl shadow-xl backdrop-blur-xl">
                          {ORGANIZATION_SIZES.map((size) => (
                            <SelectItem
                              key={size.id}
                              value={size.id}
                              className="focus:bg-muted cursor-pointer py-3"
                            >
                              {size.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={'businessDetails.primaryUseCase' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        className={`${labelClasses} flex items-center gap-2`}
                      >
                        Primary CRM Use Case{' '}
                        <span className="text-muted-foreground font-normal">
                          (Optional)
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                            <p className="mb-1 font-semibold">Optional Field</p>
                            <p>
                              Tell us how you plan to use the CRM. We'll
                              configure layouts, pipelines, and defaults to
                              match your primary workflow.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger className={inputClasses}>
                            <div className="flex items-center gap-2">
                              <Settings2 className="text-muted-foreground h-4 w-4" />
                              <SelectValue placeholder="Select primary use case" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="border-border bg-card/95 rounded-xl shadow-xl backdrop-blur-xl">
                          <SelectItem
                            value="sales"
                            className="focus:bg-muted cursor-pointer py-3"
                          >
                            Sales Pipeline & Revenue
                          </SelectItem>
                          <SelectItem
                            value="support"
                            className="focus:bg-muted cursor-pointer py-3"
                          >
                            Customer Support & Ticketing
                          </SelectItem>
                          <SelectItem
                            value="marketing"
                            className="focus:bg-muted cursor-pointer py-3"
                          >
                            Marketing & Lead Generation
                          </SelectItem>
                          <SelectItem
                            value="full"
                            className="focus:bg-muted cursor-pointer py-3"
                          >
                            Full CRM (Sales + Support + Marketing)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name={'businessDetails.description' as any}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className={`${labelClasses} flex items-center gap-2`}
                    >
                      Brief Description{' '}
                      <span className="text-muted-foreground font-normal">
                        (Optional)
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                          <p className="mb-1 font-semibold">Optional Field</p>
                          <p>
                            A brief overview of your business activities,
                            products, or services. Helps with account setup,
                            support, and understanding your business needs.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ''}
                        rows={4}
                        className={`${inputClasses} bg-card h-auto min-h-[120px] resize-none pt-3`}
                        placeholder={content.placeholder}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Regional Settings - Clean Enterprise Collapsible */}
              <Collapsible
                open={isRegionalSettingsOpen}
                onOpenChange={setIsRegionalSettingsOpen}
                className={`overflow-hidden rounded-lg border transition-colors duration-700 ${
                  regionalFlash
                    ? 'border-blue-300 bg-blue-50/90'
                    : 'bg-muted/60 border-blue-100'
                }`}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setIsRegionalSettingsOpen(!isRegionalSettingsOpen)
                    }}
                    className="group hover:bg-muted/50 flex h-auto w-full items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="border-border bg-card text-muted-foreground group-hover:border-border flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm">
                        <Settings2 className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <h4 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-blue-950">
                          Regional Settings
                          {selectedCountry && selectedCountry !== 'OTHER' && (
                            <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-medium">
                              Auto
                            </span>
                          )}
                        </h4>
                        <p className="text-muted-foreground text-xs font-normal">
                          Currency, Language, Timezone
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isRegionalSettingsOpen ? (
                        <ChevronUp className="text-muted-foreground h-4 w-4" />
                      ) : (
                        <ChevronDown className="text-muted-foreground group-hover:text-muted-foreground h-4 w-4" />
                      )}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent
                  className="space-y-4 p-4 pt-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-muted mb-4 h-px w-full"></div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="defaultCurrency"
                      render={({ field }) => (
                        <FormItem onClick={(e) => e.stopPropagation()}>
                          <FormLabel
                            className={`${labelClasses} flex items-center gap-2`}
                          >
                            <DollarSign className="text-muted-foreground h-4 w-4" />
                            Currency{' '}
                            <span className="text-muted-foreground font-normal">
                              (Auto)
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                                <p className="mb-1 font-semibold">
                                  Auto-configured
                                </p>
                                <p>
                                  Default currency for invoices, payments, and
                                  financial reports. Automatically set based on
                                  your country selection but can be customized.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value)
                            }}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger
                                className={`${inputClasses} bg-card`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="border-border bg-card/95 max-h-[200px] rounded-lg shadow-xl backdrop-blur-xl">
                              {CURRENCIES.map((c) => (
                                <SelectItem
                                  key={c.id}
                                  value={c.id}
                                  className="hover:bg-muted focus:bg-muted cursor-pointer py-2.5"
                                >
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="defaultLanguage"
                      render={({ field }) => (
                        <FormItem onClick={(e) => e.stopPropagation()}>
                          <FormLabel
                            className={`${labelClasses} flex items-center gap-2`}
                          >
                            <Globe className="text-muted-foreground h-4 w-4" />
                            Language{' '}
                            <span className="text-muted-foreground font-normal">
                              (Auto)
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                                <p className="mb-1 font-semibold">
                                  Auto-configured
                                </p>
                                <p>
                                  Default language for the interface, reports,
                                  and communications. Automatically set based on
                                  your country selection.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value)
                            }}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger
                                className={`${inputClasses} bg-card`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="border-border bg-card/95 max-h-[200px] rounded-lg shadow-xl backdrop-blur-xl">
                              {LANGUAGES.map((l) => (
                                <SelectItem
                                  key={l.id}
                                  value={l.id}
                                  className="hover:bg-muted focus:bg-muted cursor-pointer py-2.5"
                                >
                                  {l.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="defaultTimeZone"
                      render={({ field }) => (
                        <FormItem onClick={(e) => e.stopPropagation()}>
                          <FormLabel
                            className={`${labelClasses} flex items-center gap-2`}
                          >
                            <Clock className="text-muted-foreground h-4 w-4" />
                            Timezone{' '}
                            <span className="text-muted-foreground font-normal">
                              (Auto)
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                                <p className="mb-1 font-semibold">
                                  Auto-configured
                                </p>
                                <p>
                                  Default timezone for scheduling, reports, and
                                  timestamps. Automatically set based on your
                                  country selection.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value)
                            }}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger
                                className={`${inputClasses} bg-card`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="border-border bg-card/95 max-h-[200px] rounded-lg shadow-xl backdrop-blur-xl">
                              {TIMEZONES.map((t) => (
                                <SelectItem
                                  key={t.id}
                                  value={t.id}
                                  className="hover:bg-muted focus:bg-muted cursor-pointer py-2.5"
                                >
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="defaultLocale"
                      render={({ field }) => (
                        <FormItem onClick={(e) => e.stopPropagation()}>
                          <FormLabel
                            className={`${labelClasses} flex items-center gap-2`}
                          >
                            <Calendar className="text-muted-foreground h-4 w-4" />
                            Locale Format{' '}
                            <span className="text-muted-foreground font-normal">
                              (Auto)
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                                <p className="mb-1 font-semibold">
                                  Auto-configured
                                </p>
                                <p>
                                  Regional format for dates, numbers, and
                                  addresses (e.g., en-US, en-IN). Automatically
                                  set based on your country selection.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value)
                            }}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger
                                className={`${inputClasses} bg-card`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <SelectValue placeholder="Select locale" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="border-border bg-card/95 max-h-[200px] rounded-lg shadow-xl backdrop-blur-xl">
                              {LOCALES.map((l) => (
                                <SelectItem
                                  key={l.id}
                                  value={l.id}
                                  className="hover:bg-muted focus:bg-muted cursor-pointer py-2.5"
                                >
                                  {l.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {showGSTField && (
                <div>
                  <div className="border-border bg-muted relative flex flex-col gap-4 overflow-hidden rounded-xl border p-6">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <CheckCircle2 className="h-24 w-24 text-blue-900/10" />
                    </div>
                    <FormField
                      control={form.control}
                      name="gstin"
                      render={({ field }) => (
                        <FormItem className="relative z-10 w-full">
                          <FormLabel className={labelClasses}>
                            GSTIN / Tax ID
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ''}
                              className={`${inputClasses} border-border bg-card font-mono tracking-wide uppercase focus:border-slate-500`}
                              placeholder="22AAAAA0000A1Z5"
                            />
                          </FormControl>
                          <FormMessage />
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                            <p className="text-muted-foreground text-xs font-medium">
                              Automated compliance verification active
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </TooltipProvider>
    )
  },
  (prevProps, nextProps) => {
    // Only re-render if userClassification changes or form control changes
    return (
      prevProps.userClassification === nextProps.userClassification &&
      prevProps.form.control === nextProps.form.control
    )
  }
)
