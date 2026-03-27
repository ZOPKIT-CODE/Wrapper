import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UseFormReturn } from 'react-hook-form';
import { newBusinessData, existingBusinessData, CONTACT_METHODS, CONTACT_SALUTATIONS, CONTACT_AUTHORITY_LEVELS, COUNTRIES } from '../../schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { UserClassification } from '../FlowSelector';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import React, { memo, useEffect, useState } from 'react';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { useWatch } from 'react-hook-form';
import { getCountryConfig } from '../../config/countryConfig';
import { onboardingAPI } from '@/lib/api';
import { useToast } from '../Toast';

interface AdminDetailsStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  userClassification?: UserClassification;
}

export const AdminDetailsStep = memo(({ form, userClassification }: AdminDetailsStepProps) => {
  const { user } = useKindeAuth();
  const { addToast } = useToast();
  
  // Watch tax registration and PAN fields
  const taxRegistered = useWatch({ control: form.control, name: 'taxRegistered' });
  const panNumber = useWatch({ control: form.control, name: 'panNumber' });
  const businessDetailsCountry = useWatch({ control: form.control, name: 'businessDetails.country' as any });
  const rootCountry = useWatch({ control: form.control, name: 'country' });
  const companyName = useWatch({ control: form.control, name: 'businessDetails.companyName' as any });
  
  const country = businessDetailsCountry || rootCountry || 'IN';
  const countryConfig = getCountryConfig(country);
  const labels = {
    taxId: countryConfig.taxSystem.idLabel,
  };
  
  // PAN Verification states
  const [panVerificationStatus, setPanVerificationStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [panVerificationMessage, setPanVerificationMessage] = useState<string>('');
  
  // PAN Verification Handler
  const handleVerifyPAN = async () => {
    if (!panNumber || panNumber.length !== 10) {
      addToast('Please enter a valid PAN number (10 characters)', { type: 'error', duration: 3000 });
      return;
    }

    setPanVerificationStatus('verifying');
    setPanVerificationMessage('');

    try {
      const response = await onboardingAPI.verifyPAN(panNumber.toUpperCase(), companyName || undefined);
      
      if (response.data.verified) {
        setPanVerificationStatus('verified');
        setPanVerificationMessage('PAN verified successfully');
        addToast('PAN verified successfully', { type: 'success', duration: 3000 });
        form.setValue('panVerified' as any, true, { shouldValidate: false });
      } else {
        setPanVerificationStatus('error');
        setPanVerificationMessage(response.data.message || 'PAN verification failed');
        addToast(response.data.message || 'PAN verification failed', { type: 'error', duration: 5000 });
        form.setValue('panVerified' as any, false, { shouldValidate: false });
      }
    } catch (error: any) {
      setPanVerificationStatus('error');
      const errorMessage = error.response?.data?.message || 'Failed to verify PAN. Please try again.';
      setPanVerificationMessage(errorMessage);
      addToast(errorMessage, { type: 'error', duration: 5000 });
      form.setValue('panVerified' as any, false, { shouldValidate: false });
    }
  };
  
  // Sync Admin Email (and name) from Kinde only once on mount so form state matches display.
  // Run only once when user is available to avoid overwriting user-typed/cleared values (fixes state issues when typing and backspacing).
  const hasSyncedFromKindeRef = React.useRef(false);
  React.useLayoutEffect(() => {
    if (!user?.email || hasSyncedFromKindeRef.current) return;
    hasSyncedFromKindeRef.current = true;
    const updates: Array<{ field: any; value: any }> = [];
    const currentAdminEmail = form.getValues('adminEmail');
    if (!currentAdminEmail || (typeof currentAdminEmail === 'string' && !currentAdminEmail.trim())) {
      updates.push({ field: 'adminEmail', value: user.email });
    }
    if (user.given_name) {
      const currentFirst = form.getValues('firstName');
      if (!currentFirst || (typeof currentFirst === 'string' && !currentFirst.trim())) {
        updates.push({ field: 'firstName', value: user.given_name });
      }
    }
    if (user.family_name) {
      const currentLast = form.getValues('lastName');
      if (!currentLast || (typeof currentLast === 'string' && !currentLast.trim())) {
        updates.push({ field: 'lastName', value: user.family_name });
      }
    }
    updates.forEach(({ field, value }) => {
      form.setValue(field as any, value, { shouldValidate: false, shouldDirty: false });
    });
  }, [user?.email, user?.given_name, user?.family_name, form]);

  // Get personalized content based on user classification
  const getPersonalizedContent = () => {
    switch (userClassification) {
      case 'aspiringFounder':
        return {
          title: 'Admin Account Setup',
          description: 'Set up your administrator account as the company founder.',
          emailPlaceholder: 'founder@yourcompany.com',
          mobilePlaceholder: '+1 (555) 123-4567',
          showDomainIntegration: false
        };
      case 'corporateEmployee':
        return {
          title: 'Corporate Admin Setup',
          description: 'Configure your administrator access for the corporate environment.',
          emailPlaceholder: 'admin@company.com',
          mobilePlaceholder: '+1 (555) 123-4567',
          showDomainIntegration: true
        };
      case 'withDomainMail':
        return {
          title: 'Professional Admin Setup',
          description: 'Complete your professional administrator account configuration.',
          emailPlaceholder: 'admin@yourdomain.com',
          mobilePlaceholder: '+1 (555) 123-4567',
          showDomainIntegration: true
        };
      case 'enterprise':
        return {
          title: 'Enterprise Administrator',
          description: 'Set up your enterprise administrator account with advanced features.',
          emailPlaceholder: 'admin@enterprise.com',
          mobilePlaceholder: '+1 (555) 123-4567',
          showDomainIntegration: true
        };
      default:
        return {
          title: 'Admin Details',
          description: 'Provide administrator contact and account details.',
          emailPlaceholder: 'admin@company.com',
          mobilePlaceholder: '+1 (555) 123-4567',
          showDomainIntegration: false
        };
    }
  };
  const personalizedContent = getPersonalizedContent();
  const requiresMobileVerification = userClassification === 'withGST' || userClassification === 'enterprise';

  // Shared Styles
  const inputClasses = "w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-[#1B2E5A] placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 hover:border-slate-300 shadow-sm";
  const labelClasses = "block text-sm font-semibold text-slate-700 mb-1.5 ml-1";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-4">
          {userClassification && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide">
              {userClassification.replace(/([A-Z])/g, ' $1').trim()}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1B2E5A]">
          {personalizedContent.title}
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed max-w-2xl">
          {personalizedContent.description}
        </p>
      </div>

      <TooltipProvider delayDuration={200}>
        <div className="space-y-8 max-w-5xl glass-card p-8 sm:p-10 rounded-2xl shadow-soft">
          {/* MANDATORY FIELDS SECTION */}
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-[#1B2E5A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Required Information
              </h2>
              <p className="text-sm text-slate-500 mt-1">These fields are mandatory to complete your account setup</p>
            </div>

            {/* Personal Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name={"firstName" as any}
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                  First Name <span className="text-red-500">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p className="font-semibold mb-1">Mandatory Field</p>
                          <p>Your first name as the primary administrator. Used for account identification, official communications, and user profile setup.</p>
                        </TooltipContent>
                      </Tooltip>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    className={inputClasses}
                    placeholder="Enter your first name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={"lastName" as any}
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                  Last Name <span className="text-red-500">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p className="font-semibold mb-1">Mandatory Field</p>
                          <p>Your last name as the primary administrator. Required for complete identification and official account documentation.</p>
                        </TooltipContent>
                      </Tooltip>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    className={inputClasses}
                    placeholder="Enter your last name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

            {/* Email and Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="adminEmail"
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                  Admin Email <span className="text-red-500">*</span>
                  {userClassification === 'withDomainMail' && (
                    <span className="text-xs text-green-600 ml-2 font-normal bg-green-50 px-2 py-0.5 rounded-full">Professional domain</span>
                  )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p className="font-semibold mb-1">Mandatory Field</p>
                          <p>Primary email address for the administrator account. Automatically filled from your Kinde authentication. Used for login, account recovery, important notifications, and official communications.</p>
                        </TooltipContent>
                      </Tooltip>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || user?.email || ''}
                    type="email"
                    readOnly
                    disabled
                    onChange={(e) => {
                      // Prevent manual changes - always use Kinde email
                      if (user?.email) {
                        field.onChange(user.email);
                      }
                    }}
                    className={`${inputClasses} bg-slate-50 cursor-not-allowed opacity-75`}
                    placeholder={personalizedContent.emailPlaceholder}
                  />
                </FormControl>
                {/* Don't show validation error when field is read-only and auto-filled from Kinde */}
                {!user?.email && <FormMessage />}
                {personalizedContent.showDomainIntegration && (
                  <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    Domain integration available
                  </p>
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="adminMobile"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClasses}>
                  Admin Mobile {requiresMobileVerification ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    type="tel"
                    className={inputClasses}
                    placeholder={personalizedContent.mobilePlaceholder}
                  />
                </FormControl>
                <FormMessage />
                {requiresMobileVerification && (
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    Verification required
                  </p>
                )}
              </FormItem>
            )}
          />
        </div>
          </div>

          {/* OPTIONAL FIELDS SECTION */}
          <div className="space-y-6 pt-6 border-t-2 border-slate-200">
            <div className="pb-4">
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                Additional Information (Optional)
              </h2>
              <p className="text-sm text-slate-500 mt-1">Enhance your profile with these optional details for better communication and organization</p>
            </div>

            {/* Salutation and Job Title */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="contactSalutation"
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                      Salutation
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p>Formal title (Mr., Mrs., Dr., etc.) used in professional communications and official documents.</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className={inputClasses}>
                      <SelectValue placeholder="Select salutation" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg bg-white">
                    {CONTACT_SALUTATIONS.map((sal) => (
                      <SelectItem key={sal.id} value={sal.id} className="py-3 cursor-pointer focus:bg-blue-50">
                        {sal.name}
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
            name="contactJobTitle"
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                      Job Title
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p>Your professional position helps us personalize communications and understand your role in decision-making processes.</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    className={inputClasses}
                    placeholder="e.g. CEO, Founder, CTO"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

            {/* Middle Name and Department */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="contactMiddleName"
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                      Middle Name
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p>Complete your full legal name for official documents and compliance requirements.</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    className={inputClasses}
                    placeholder="Middle name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactDepartment"
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                      Department
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p>Your department helps route communications appropriately and ensures you receive relevant updates.</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    className={inputClasses}
                    placeholder="e.g. Operations, Finance"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

            {/* Authority Level and Preferred Contact Method */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="contactAuthorityLevel"
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                      Authority Level
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p>Indicates your decision-making authority level, helping us prioritize communications and route important matters appropriately.</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className={inputClasses}>
                      <SelectValue placeholder="Select authority level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg bg-white">
                    {CONTACT_AUTHORITY_LEVELS.map((level) => (
                      <SelectItem key={level.id} value={level.id} className="py-3 cursor-pointer focus:bg-blue-50">
                        {level.name}
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
            name="preferredContactMethod"
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                      Preferred Contact Method
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p>Your preferred method helps us contact you efficiently for important updates, support, and account-related matters.</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className={inputClasses}>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg bg-white">
                    {CONTACT_METHODS.map((method) => (
                      <SelectItem key={method.id} value={method.id} className="py-3 cursor-pointer focus:bg-blue-50">
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

            {/* Direct Phone and Mobile Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="contactDirectPhone"
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                      Direct Phone
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p>Your direct office line for urgent business matters and account verification purposes.</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    type="tel"
                    className={inputClasses}
                    placeholder="+1 (555) 123-4567"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactMobilePhone"
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                      Mobile Phone
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p>Alternative mobile number for backup contact and SMS notifications for security alerts.</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    type="tel"
                    className={inputClasses}
                    placeholder="+1 (555) 987-6543"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

            {/* Billing Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="billingEmail"
            render={({ field }) => (
              <FormItem>
                    <FormLabel className={`${labelClasses} flex items-center gap-2`}>
                      Billing Email
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p>Separate email for billing invoices and payment-related communications. If not provided, admin email will be used.</p>
                        </TooltipContent>
                      </Tooltip>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    type="email"
                    className={inputClasses}
                    placeholder="billing@company.com"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
            </div>
        </div>

          {/* PAN / Tax Registration Section - commented out as of now */}
          {/* <div className="space-y-6 pt-6 border-t-2 border-slate-200">
            <div className="pb-4">
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                Tax Registration (Optional)
              </h2>
              <p className="text-sm text-slate-500 mt-1">Provide tax registration details for compliance and invoicing</p>
            </div>

            <FormField
              control={form.control}
              name="taxRegistered"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-4 bg-white/70 backdrop-blur-sm">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <FormLabel className="text-base font-semibold text-[#1B2E5A] flex items-center gap-2">
                      Tax Registered <span className="text-slate-400 font-normal">(Optional)</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white">
                          <p className="font-semibold mb-1">Optional Field</p>
                          <p>Indicates if your organization is registered for tax purposes in your country. When enabled, the corresponding tax identification number (PAN for India, EIN for US) becomes mandatory for tax-compliant invoicing, regulatory reporting, and compliance with local tax authorities.</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <FormDescription className="text-sm text-slate-500">
                      Is your organization registered for tax in {COUNTRIES.find(c => c.id === country)?.name}?
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={Boolean(field.value)}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) {
                          setTimeout(() => {
                            if (country === 'IN') {
                              form.trigger('panNumber' as any);
                            } else if (country === 'US') {
                              form.trigger('einNumber' as any);
                            }
                          }, 100);
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {taxRegistered && (
              <div className="space-y-6">
                {country === 'IN' && (
                  <FormField
                    control={form.control}
                    name="panNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          {labels.taxId} {taxRegistered ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-slate-900 text-white">
                              <p className="font-semibold mb-1">{taxRegistered ? 'Mandatory Field' : 'Optional Field'}</p>
                              <p>Permanent Account Number (PAN) is a 10-character alphanumeric identifier issued by the Income Tax Department of India. {taxRegistered ? 'Required when Tax Registered toggle is enabled. ' : ''}Used for tax compliance, financial transactions, and regulatory reporting.</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <FormControl>
                              <Input 
                                {...field}
                                value={field.value || ''}
                                placeholder={`Enter ${labels.taxId}`}
                                className={`${inputClasses} uppercase`}
                                onChange={(e) => {
                                  field.onChange(e.target.value.toUpperCase());
                                  if (panVerificationStatus !== 'idle') {
                                    setPanVerificationStatus('idle');
                                    setPanVerificationMessage('');
                                  }
                                }}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleVerifyPAN}
                              disabled={panVerificationStatus === 'verifying' || !panNumber || panNumber.length !== 10}
                              className="shrink-0"
                            >
                              {panVerificationStatus === 'verifying' ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Verifying...
                                </>
                              ) : panVerificationStatus === 'verified' ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                                  Verified
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-4 h-4 mr-2" />
                                  Verify
                                </>
                              )}
                            </Button>
                          </div>
                          {panVerificationStatus === 'verified' && (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{panVerificationMessage}</span>
                            </div>
                          )}
                          {panVerificationStatus === 'error' && (
                            <div className="flex items-center gap-2 text-sm text-red-600">
                              <XCircle className="w-4 h-4" />
                              <span>{panVerificationMessage}</span>
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {(country === 'US' || country === 'OTHER') && (
                  <FormField
                    control={form.control}
                    name="einNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          {labels.taxId} <span className="text-slate-400 font-normal">(Optional)</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-slate-900 text-white">
                              <p className="font-semibold mb-1">Optional Field</p>
                              <p>Employer Identification Number (EIN) is a 9-digit number issued by the IRS for tax purposes. Required for businesses operating in the US.</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ''}
                            placeholder={`Enter ${labels.taxId}`}
                            className={inputClasses}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}
          </div> */}
        </div>

        {/* Feature Highlights based on Classification */}
        {personalizedContent.showDomainIntegration && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-5">
            <h4 className="font-semibold text-green-900 mb-2 text-sm">Professional Domain Benefits</h4>
            <div className="space-y-1.5">
              {['Custom email domain', 'Enhanced credibility', 'Unified communications'].map((benefit, i) => (
                <div key={i} className="flex items-center text-sm text-green-700">
                  <div className="w-4 h-4 rounded-full bg-green-200 flex items-center justify-center mr-2">
                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                  </div>
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        )}

        {userClassification === 'enterprise' && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
            <h4 className="font-semibold text-purple-900 mb-2 text-sm">Enterprise Security Included</h4>
            <div className="space-y-1.5">
              {['MFA Setup', 'SSO Configuration', 'Audit Logs'].map((benefit, i) => (
                 <div key={i} className="flex items-center text-sm text-purple-700">
                  <div className="w-4 h-4 rounded-full bg-purple-200 flex items-center justify-center mr-2">
                    <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                  </div>
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        )}
      </TooltipProvider>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if form control changes or userClassification changes
  return prevProps.userClassification === nextProps.userClassification && 
         prevProps.form.control === nextProps.form.control;
});