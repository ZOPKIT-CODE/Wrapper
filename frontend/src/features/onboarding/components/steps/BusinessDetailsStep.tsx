import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { newBusinessData, existingBusinessData, BUSINESS_TYPES, ORGANIZATION_SIZES, COUNTRIES, COMPANY_TYPES, LANGUAGES, LOCALES, CURRENCIES, TIMEZONES } from '../../schemas';
import { Badge } from '@/components/ui/badge';
import { UserClassification } from '../FlowSelector';
import { Building2, Globe, Users2, FileText, CheckCircle2, Briefcase, Settings2, ChevronDown, ChevronUp, DollarSign, Clock, Calendar, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { autoPopulateLocalization } from '../../config/countryConfig';
import React, { useEffect, useState, memo, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface BusinessDetailsStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  userClassification?: UserClassification;
}

export const BusinessDetailsStep: React.FC<BusinessDetailsStepProps> = memo(({ form, userClassification }) => {
  const getPersonalizedContent = () => {
    switch (userClassification) {
      case 'aspiringFounder':
        return {
          title: 'Company Details',
          description: 'Define your company\'s identity and core operations. Provide accurate information for compliance and account setup.',
          placeholder: 'E.g. Building an AI-first CRM for small businesses...'
        };
      case 'enterprise':
        return {
          title: 'Company Details',
          description: 'Configure your organization\'s operational details. Ensure all mandatory fields are completed for enterprise-level compliance.',
          placeholder: 'E.g. Multinational logistics and supply chain management...'
        };
      default:
        return {
          title: 'Company Details',
          description: 'Tell us about your organization to setup your workspace. Complete all mandatory fields marked with an asterisk (*).',
          placeholder: 'Describe your primary business activities...'
        };
    }
  };
  const content = getPersonalizedContent();
  const showGSTField = userClassification === 'withGST';
  const [isRegionalSettingsOpen, setIsRegionalSettingsOpen] = useState(true);
  
  // Use useWatch to reactively get country without causing re-renders on other field changes
  const businessDetailsCountry = useWatch({ control: form.control, name: 'businessDetails.country' as any });
  const rootCountry = useWatch({ control: form.control, name: 'country' });
  const selectedCountry = businessDetailsCountry || rootCountry || 'IN';
  
  // Auto-populate localization when country changes - use useMemo to prevent re-renders
  const localizationConfig = useMemo(() => {
    const countryCode = selectedCountry?.toUpperCase();
    if (countryCode && countryCode !== 'OTHER' && countryCode !== '') {
      try {
        return autoPopulateLocalization(countryCode);
      } catch (error) {
        console.warn('Error populating localization for country:', countryCode, error);
        return null;
      }
    }
    return null;
  }, [selectedCountry]);

  // Ensure India is selected by default when Business Details step loads with no country set
  useEffect(() => {
    const current = form.getValues('businessDetails.country' as any) || form.getValues('country');
    if (!current || current === '') {
      form.setValue('businessDetails.country' as any, 'IN', { shouldValidate: false, shouldDirty: false });
      form.setValue('country' as any, 'IN', { shouldValidate: false, shouldDirty: false });
    }
  }, [form]);

  // Apply regional settings when Registration Country is selected (or when step loads with a country set)
  const previousCountryRef = React.useRef<string | null>(null);

  const applyRegionalSettingsFromCountry = React.useCallback(() => {
    if (!localizationConfig) return;
    const countryCode = selectedCountry?.toUpperCase();
    if (!countryCode || countryCode === 'OTHER' || countryCode === '') return;

    const updates: Array<{ field: any; value: any }> = [];
    if (localizationConfig.currency) {
      updates.push({ field: 'defaultCurrency', value: localizationConfig.currency });
    }
    if (localizationConfig.language) {
      updates.push({ field: 'defaultLanguage', value: localizationConfig.language });
    }
    if (localizationConfig.locale) {
      updates.push({ field: 'defaultLocale', value: localizationConfig.locale });
    }
    if (localizationConfig.timezone) {
      updates.push({ field: 'defaultTimeZone', value: localizationConfig.timezone });
    }
    updates.forEach(({ field, value }) => {
      form.setValue(field as any, value, {
        shouldValidate: false,
        shouldDirty: false,
        shouldTouch: false,
      });
    });
  }, [localizationConfig, selectedCountry, form]);

  // When Registration Country is selected or changes (including initial load with default), apply regional settings
  useEffect(() => {
    if (!localizationConfig) return;
    const countryCode = selectedCountry?.toUpperCase();
    if (!countryCode || countryCode === 'OTHER' || countryCode === '') return;

    if (countryCode !== previousCountryRef.current) {
      previousCountryRef.current = countryCode;
      const rafId = requestAnimationFrame(applyRegionalSettingsFromCountry);
      setIsRegionalSettingsOpen(true);
      return () => cancelAnimationFrame(rafId);
    }
  }, [localizationConfig, selectedCountry, applyRegionalSettingsFromCountry]);

  // Enhanced "Stripe-like" Enterprise Theme Styles
  const cardClasses = "glass-card p-10 rounded-xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/5";
  const labelClasses = "block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2";
  const inputContainerClasses = "relative group";
  const inputClasses = "w-full h-11 pl-4 pr-4 bg-white/50 border border-slate-200 rounded-lg text-[#1B2E5A] placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none hover:border-slate-300 shadow-sm";
  const iconClasses = "absolute left-4 top-3 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-8">
        {/* Header */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            {userClassification && (
              <Badge variant="outline" className="bg-white/50 text-slate-600 border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm">
                {userClassification.replace(/([A-Z])/g, ' $1').trim()}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#1B2E5A] mb-3 drop-shadow-sm">
            {content.title}
          </h1>
          <p className="text-lg text-slate-500 leading-relaxed max-w-2xl font-light">
            {content.description}
          </p>
        </div>

        <div className={cardClasses}>

          
          <div className="space-y-8 relative z-10">
            
            {/* Country Field - MOVED TO TOP */}
            <FormField
              control={form.control}
              name={"businessDetails.country" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                    Registration Country <span className="text-red-500">*</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-slate-900 text-white">
                        <p className="font-semibold mb-1">Mandatory Field</p>
                        <p>The country where your business is legally registered. This determines tax rules, compliance requirements, currency defaults, regional settings, and available tax ID fields. Selecting a country automatically configures regional settings.</p>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <Select onValueChange={(value) => {
                    const countryCode = value?.toUpperCase();
                    field.onChange(countryCode);
                    // Also set root country field for easier access
                    form.setValue('country' as any, countryCode, { shouldValidate: false });
                    // Auto-populate regional settings immediately
                    if (countryCode && countryCode !== 'OTHER' && countryCode !== '') {
                      try {
                        const localization = autoPopulateLocalization(countryCode);
                        if (localization.currency) {
                      form.setValue('defaultCurrency', localization.currency, { shouldValidate: false });
                        }
                        if (localization.language) {
                      form.setValue('defaultLanguage', localization.language, { shouldValidate: false });
                        }
                        if (localization.locale) {
                      form.setValue('defaultLocale', localization.locale, { shouldValidate: false });
                        }
                        if (localization.timezone) {
                      form.setValue('defaultTimeZone', localization.timezone, { shouldValidate: false });
                        }
                        // Open regional settings to show auto-populated values
                        setIsRegionalSettingsOpen(true);
                      } catch (error) {
                        console.warn('Error populating localization for country:', countryCode, error);
                      }
                    }
                  }} value={field.value || 'IN'}>
                    <FormControl>
                      <SelectTrigger className={`${inputClasses} hover:border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500/10`}>
                         <div className="flex items-center gap-2">
                             <Globe className="w-4 h-4 text-slate-400" />
                             <SelectValue placeholder="Select country" />
                          </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-lg border-slate-200 shadow-xl bg-white/95 backdrop-blur-xl">
                      {COUNTRIES.map((country) => (
                        <SelectItem 
                          key={country.id} 
                          value={country.id} 
                          className={`py-2.5 cursor-pointer focus:bg-slate-50 hover:bg-slate-50  ${
                            country.id === 'IN' ? 'font-medium bg-slate-50/50' : ''
                          }`}
                        >
                          {country.name} {country.id === 'IN' && '🇮🇳'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  {selectedCountry && selectedCountry !== 'OTHER' && (
                    <div className="mt-2 p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100/50">
                      <p className="text-xs text-indigo-700 flex items-center gap-2 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        <span>Regional settings configured for {COUNTRIES.find(c => c.id === selectedCountry)?.name}</span>
                      </p>
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* Company Name */}
            <FormField
              control={form.control}
              name={"businessDetails.companyName" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                    Company Name <span className="text-red-500">*</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-slate-900 text-white">
                        <p className="font-semibold mb-1">Mandatory Field</p>
                        <p>The legal or trading name of your business as registered with the authorities. This name appears on official documents, invoices, tax filings, and legal contracts. Must exactly match your business registration certificate or incorporation documents.</p>
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
                  <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                    Company Website
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-slate-900 text-white">
                        <p>Your company website URL helps establish credibility and provides a reference for your business.</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Type - Merged from separate step */}
            <FormField
              control={form.control}
              name="companyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                    Company Type <span className="text-red-500">*</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-slate-900 text-white">
                        <p className="font-semibold mb-1">Mandatory Field</p>
                        <p>The legal structure of your business (e.g., Private Limited, LLP, Sole Proprietorship). This determines tax obligations, liability, and compliance requirements.</p>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className={`${inputClasses} hover:border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500/10`}>
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-slate-400" />
                          <SelectValue placeholder="Select company type" />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-lg border-slate-200 shadow-xl max-h-[300px] bg-white/95 backdrop-blur-xl">
                      {COMPANY_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id} className="py-2.5 cursor-pointer focus:bg-slate-50 hover:bg-slate-50 ">
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
              name={"businessDetails.businessType" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                    Business Type <span className="text-red-500">*</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-slate-900 text-white">
                        <p className="font-semibold mb-1">Mandatory Field</p>
                        <p>The primary industry or sector your business operates in (e.g., Technology, Healthcare, Retail). Used for compliance, reporting, and feature recommendations.</p>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className={`${inputClasses} pl-4`}>
                        <div className="flex items-center gap-2">
                           <FileText className="w-4 h-4 text-slate-400" />
                           <SelectValue placeholder="Select type" />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-[300px] bg-white/95 backdrop-blur-xl">
                      {BUSINESS_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id} className="py-3 cursor-pointer focus:bg-slate-50">{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={"businessDetails.organizationSize" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                    Team Size <span className="text-slate-400 font-normal">(Optional)</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-slate-900 text-white">
                        <p className="font-semibold mb-1">Optional Field</p>
                        <p>Number of employees helps us customize features, pricing tiers, and provide relevant recommendations for your organization size.</p>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className={inputClasses}>
                        <div className="flex items-center gap-2">
                           <Users2 className="w-4 h-4 text-slate-400" />
                           <SelectValue placeholder="Select size" />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white/95 backdrop-blur-xl">
                      {ORGANIZATION_SIZES.map((size) => (
                        <SelectItem key={size.id} value={size.id} className="py-3 cursor-pointer focus:bg-slate-50">{size.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name={"businessDetails.description" as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                  Brief Description <span className="text-slate-400 font-normal">(Optional)</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-slate-900 text-white">
                      <p className="font-semibold mb-1">Optional Field</p>
                      <p>A brief overview of your business activities, products, or services. Helps with account setup, support, and understanding your business needs.</p>
                    </TooltipContent>
                  </Tooltip>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value || ''}
                    rows={4}
                    className={`${inputClasses} h-auto min-h-[120px] pt-3 resize-none bg-white`}
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
            className="border border-slate-200/80 rounded-lg bg-slate-50/30 overflow-hidden"
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIsRegionalSettingsOpen(!isRegionalSettingsOpen);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 h-auto group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm group-hover:border-slate-300">
                    <Settings2 className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-[#1B2E5A] text-sm flex items-center gap-2">
                      Regional Settings
                      {selectedCountry && selectedCountry !== 'OTHER' && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                          Auto
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-500 font-normal">
                      Currency, Language, Timezone
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isRegionalSettingsOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 pt-0 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="h-px bg-slate-100 w-full mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="defaultCurrency"
                  render={({ field }) => (
                    <FormItem onClick={(e) => e.stopPropagation()}>
                      <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        Currency <span className="text-slate-400 font-normal">(Auto)</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-900 text-white">
                            <p className="font-semibold mb-1">Auto-configured</p>
                            <p>Default currency for invoices, payments, and financial reports. Automatically set based on your country selection but can be customized.</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                      }} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className={`${inputClasses} bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500/10`} onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[200px] rounded-lg border-slate-200 shadow-xl bg-white/95 backdrop-blur-xl">
                          {CURRENCIES.map((c) => (
                            <SelectItem 
                              key={c.id} 
                              value={c.id}
                              className="py-2.5 cursor-pointer focus:bg-slate-50 hover:bg-slate-50 "
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
                      <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                        <Globe className="w-4 h-4 text-slate-500" />
                        Language <span className="text-slate-400 font-normal">(Auto)</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-900 text-white">
                            <p className="font-semibold mb-1">Auto-configured</p>
                            <p>Default language for the interface, reports, and communications. Automatically set based on your country selection.</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                      }} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className={`${inputClasses} bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500/10`} onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[200px] rounded-lg border-slate-200 shadow-xl bg-white/95 backdrop-blur-xl">
                          {LANGUAGES.map((l) => (
                            <SelectItem 
                              key={l.id} 
                              value={l.id}
                              className="py-2.5 cursor-pointer focus:bg-slate-50 hover:bg-slate-50 "
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
                      <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                        <Clock className="w-4 h-4 text-slate-500" />
                        Timezone <span className="text-slate-400 font-normal">(Auto)</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-900 text-white">
                            <p className="font-semibold mb-1">Auto-configured</p>
                            <p>Default timezone for scheduling, reports, and timestamps. Automatically set based on your country selection.</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                      }} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className={`${inputClasses} bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500/10`} onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[200px] rounded-lg border-slate-200 shadow-xl bg-white/95 backdrop-blur-xl">
                          {TIMEZONES.map((t) => (
                            <SelectItem 
                              key={t.id} 
                              value={t.id}
                              className="py-2.5 cursor-pointer focus:bg-slate-50 hover:bg-slate-50 "
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
                      <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                        <Calendar className="w-4 h-4 text-slate-500" />
                        Locale Format <span className="text-slate-400 font-normal">(Auto)</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-900 text-white">
                            <p className="font-semibold mb-1">Auto-configured</p>
                            <p>Regional format for dates, numbers, and addresses (e.g., en-US, en-IN). Automatically set based on your country selection.</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                      }} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className={`${inputClasses} bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500/10`} onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="Select locale" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[200px] rounded-lg border-slate-200 shadow-xl bg-white/95 backdrop-blur-xl">
                          {LOCALES.map((l) => (
                            <SelectItem 
                              key={l.id} 
                              value={l.id}
                              className="py-2.5 cursor-pointer focus:bg-slate-50 hover:bg-slate-50 "
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
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <CheckCircle2 className="w-24 h-24 text-[#1B2E5A]" />
                </div>
                <FormField
                  control={form.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem className="w-full relative z-10">
                      <FormLabel className={labelClasses}>GSTIN / Tax ID</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ''}
                          className={`${inputClasses} bg-white font-mono uppercase tracking-wide border-slate-300 focus:border-slate-500`}
                          placeholder="22AAAAA0000A1Z5"
                        />
                      </FormControl>
                      <FormMessage />
                      <div className="flex items-center gap-2 mt-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                         <p className="text-xs font-medium text-slate-600">Automated compliance verification active</p>
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
  );
}, (prevProps, nextProps) => {
  // Only re-render if userClassification changes or form control changes
  return prevProps.userClassification === nextProps.userClassification &&
         prevProps.form.control === nextProps.form.control;
});