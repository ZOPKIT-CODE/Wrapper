import { Input } from '@/components/ui/input'
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
  FormDescription,
} from '@/components/ui/form'
import { UseFormReturn } from 'react-hook-form'
import {
  newBusinessData,
  existingBusinessData,
  COUNTRIES,
  STATES,
} from '../../schemas'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { UserClassification } from '../FlowSelector'
import {
  getStateFieldConfig,
  getCountryConfig,
} from '../../config/countryConfig'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  ChevronsUpDown,
  Check,
} from 'lucide-react'
import { useWatch } from 'react-hook-form'
import { memo, useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { onboardingAPI } from '@/lib/api'
import { useToast } from '../Toast'

interface TaxDetailsStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>
  userClassification?: UserClassification
}

// Subset of the GSTIN address object returned by the verify-gstin endpoint
// that this step reads when auto-filling the billing address.
interface GstinAddress {
  flno?: string
  bno?: string
  bnm?: string
  st?: string
  loc?: string
  dst?: string
  stcd?: string
  pncd?: string
  [key: string]: unknown
}

export const TaxDetailsStep = memo(
  ({ form, userClassification }: TaxDetailsStepProps) => {
    // Use useWatch hook to prevent unnecessary re-renders
    const vatGstRegistered = useWatch({
      control: form.control,
      name: 'vatGstRegistered',
    })
    const businessDetailsCountry = useWatch({
      control: form.control,
      name: 'businessDetails.country',
    })
    const rootCountry = useWatch({ control: form.control, name: 'country' })
    const mailingAddressSame = useWatch({
      control: form.control,
      name: 'mailingAddressSameAsRegistered',
    })
    const gstin = useWatch({ control: form.control, name: 'gstin' })
    const companyName = useWatch({
      control: form.control,
      name: 'businessDetails.companyName',
    })

    const country = businessDetailsCountry || rootCountry || 'IN'

    // Get country config and state field config
    const countryConfig = getCountryConfig(country)
    const stateFieldConfig = getStateFieldConfig(country)

    // Verification states
    const [gstinVerificationStatus, setGstinVerificationStatus] = useState<
      'idle' | 'verifying' | 'verified' | 'error'
    >('idle')
    const [gstinVerificationMessage, setGstinVerificationMessage] =
      useState<string>('')
    // State combobox open state
    const [stateComboOpen, setStateComboOpen] = useState(false)

    const { addToast } = useToast()

    // Helper function to map GSTIN constitution to company type
    const mapConstitutionToCompanyType = (
      constitution: string
    ): string | undefined => {
      const constitutionLower = constitution.toLowerCase()
      if (constitutionLower.includes('public limited')) return 'public-limited'
      if (constitutionLower.includes('private limited'))
        return 'private-limited'
      if (
        constitutionLower.includes('llp') ||
        constitutionLower.includes('limited liability partnership')
      )
        return 'llp'
      if (constitutionLower.includes('partnership')) return 'partnership'
      if (
        constitutionLower.includes('sole proprietorship') ||
        constitutionLower.includes('proprietorship')
      )
        return 'sole-proprietorship'
      if (
        constitutionLower.includes('one person') ||
        constitutionLower.includes('opc')
      )
        return 'one-person-company'
      if (
        constitutionLower.includes('section 8') ||
        constitutionLower.includes('non-profit')
      )
        return 'section-8'
      return undefined
    }

    // Helper function to build address string from GSTIN address object
    const buildAddressString = (
      address: GstinAddress | null | undefined
    ): string => {
      if (!address) return ''
      const parts: string[] = []
      if (address.flno) parts.push(address.flno)
      if (address.bno) parts.push(address.bno)
      if (address.st) parts.push(address.st)
      if (address.loc) parts.push(address.loc)
      if (address.bnm) parts.push(address.bnm)
      return parts.filter(Boolean).join(', ')
    }

    // GSTIN Verification Handler
    const handleVerifyGSTIN = async () => {
      if (!gstin || gstin.length !== 15) {
        addToast('Please enter a valid GSTIN (15 characters)', {
          type: 'error',
          duration: 3000,
        })
        return
      }

      setGstinVerificationStatus('verifying')
      setGstinVerificationMessage('')

      try {
        const response = await onboardingAPI.verifyGSTIN(
          gstin.toUpperCase(),
          companyName || undefined
        )

        if (response.data.verified && response.data.details) {
          const details = response.data.details

          // Auto-fill form fields with GSTIN verification data
          // Company Name (Legal Name)
          if (
            details.legalName &&
            !form.getValues('businessDetails.companyName')
          ) {
            form.setValue('businessDetails.companyName', details.legalName, {
              shouldValidate: false,
            })
          }

          // Company Type (from constitution)
          if (details.constitution) {
            const companyType = mapConstitutionToCompanyType(
              details.constitution
            )
            if (companyType && !form.getValues('companyType')) {
              form.setValue('companyType', companyType, {
                shouldValidate: false,
              })
            }
          }

          // Address fields
          if (details.address) {
            const addr = details.address

            // Build street address
            const streetAddress = buildAddressString(addr)
            if (streetAddress) {
              // Set both billingStreet and billingAddress for compatibility
              if (!form.getValues('billingStreet')) {
                form.setValue('billingStreet', streetAddress, {
                  shouldValidate: true,
                })
              }
              if (!form.getValues('billingAddress')) {
                form.setValue('billingAddress', streetAddress, {
                  shouldValidate: true,
                })
              }
            }

            // City
            if (addr.loc && !form.getValues('billingCity')) {
              form.setValue('billingCity', addr.loc, { shouldValidate: false })
            } else if (addr.dst && !form.getValues('billingCity')) {
              form.setValue('billingCity', addr.dst, { shouldValidate: false })
            }

            // State
            if (addr.stcd && !form.getValues('billingState')) {
              form.setValue('billingState', addr.stcd, {
                shouldValidate: false,
              })
            }

            // ZIP/Postal Code
            if (addr.pncd && !form.getValues('billingZip')) {
              form.setValue('billingZip', addr.pncd, { shouldValidate: false })
            }

            // Country (default to India if GSTIN is verified)
            if (
              !form.getValues('billingCountry') &&
              !form.getValues('country')
            ) {
              form.setValue('billingCountry', 'IN', { shouldValidate: false })
              form.setValue('country', 'IN', { shouldValidate: false })
            }
          }

          // Set VAT/GST registration flag
          if (!form.getValues('vatGstRegistered')) {
            form.setValue('vatGstRegistered', true, { shouldValidate: false })
          }

          setGstinVerificationStatus('verified')
          setGstinVerificationMessage(
            'GSTIN verified successfully - Form fields auto-filled'
          )
          addToast(
            'GSTIN verified successfully. Form fields have been auto-filled.',
            { type: 'success', duration: 5000 }
          )
          // Store verification status in form
          form.setValue('gstinVerified' as any, true, { shouldValidate: false })
        } else {
          setGstinVerificationStatus('error')
          setGstinVerificationMessage(
            response.data.message || 'GSTIN verification failed'
          )
          addToast(response.data.message || 'GSTIN verification failed', {
            type: 'error',
            duration: 5000,
          })
          form.setValue('gstinVerified' as any, false, {
            shouldValidate: false,
          })
        }
      } catch (error: unknown) {
        setGstinVerificationStatus('error')
        const errorMessage =
          (error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || 'Failed to verify GSTIN. Please try again.'
        setGstinVerificationMessage(errorMessage)
        addToast(errorMessage, { type: 'error', duration: 5000 })
        form.setValue('gstinVerified' as any, false, { shouldValidate: false })
      }
    }

    // Helper to determine tax labels based on country
    const labels = {
      taxId: countryConfig.taxSystem.idLabel,
      vatId: countryConfig.taxSystem.vatLabel,
      companyId: 'Company Registration Number',
    }

    return (
      <TooltipProvider delayDuration={200}>
        <div className="space-y-8">
          {/* Header */}
          <div className="relative">
            <div className="mb-3 flex items-center gap-2">
              {userClassification &&
                userClassification !== 'aspiringFounder' && (
                  <Badge
                    variant="outline"
                    className="border-border bg-card/50 text-muted-foreground rounded-full px-3 py-1 text-[10px] font-bold tracking-widest uppercase shadow-sm"
                  >
                    {userClassification.replace(/([A-Z])/g, ' $1').trim()}
                  </Badge>
                )}
              <Badge
                variant="outline"
                className="border-border bg-card/50 text-muted-foreground rounded-full px-3 py-1 text-[10px] font-bold tracking-widest uppercase shadow-sm"
              >
                {COUNTRIES.find((c) => c.id === country)?.name || country}
              </Badge>
            </div>
            <h1 className="text-primary mb-3 text-3xl font-extrabold tracking-tight drop-shadow-sm md:text-4xl">
              Tax & Compliance Details
            </h1>
            <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed font-light">
              Configure your tax registration status and address details for
              billing compliance.
            </p>
          </div>

          <div className="space-y-8">
            {/* Registration Status Switch */}
            <div className="bg-card space-y-6 rounded-lg border border-blue-100 p-8 shadow-sm ring-1 ring-blue-950/[0.04]">
              <FormField
                control={form.control}
                name="vatGstRegistered"
                render={({ field }) => (
                  <FormItem className="border-border bg-card/70 flex flex-row items-center justify-between rounded-lg border p-4 backdrop-blur-sm">
                    <div className="flex-1 space-y-0.5 pr-4">
                      <FormLabel className="text-primary flex items-center gap-2 text-base font-semibold">
                        VAT/GST Registered{' '}
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
                              Indicates if you have a VAT (Value Added Tax), GST
                              (Goods & Services Tax), or Sales Tax registration
                              number. When enabled, the corresponding tax ID
                              field becomes mandatory for compliance and
                              tax-compliant invoicing.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormDescription className="text-muted-foreground text-sm">
                        Do you have a VAT, GST, or Sales Tax registration?{' '}
                        {vatGstRegistered && (
                          <span className="font-medium text-amber-600">
                            Note: Tax ID will be required.
                          </span>
                        )}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={Boolean(field.value)}
                        onCheckedChange={(checked) => {
                          field.onChange(checked)
                          // Trigger validation when toggle changes to enforce GST requirements
                          if (checked) {
                            setTimeout(() => {
                              const country =
                                form.getValues('businessDetails.country') ||
                                form.getValues('country') ||
                                'IN'
                              if (country === 'IN') {
                                form.trigger('gstin')
                              } else {
                                form.trigger('vatNumber')
                              }
                            }, 100)
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Conditional GST/VAT Fields */}
            {vatGstRegistered && (
              <div className="bg-card space-y-6 rounded-lg border border-blue-100 p-8 shadow-sm ring-1 ring-blue-950/[0.04]">
                <h3 className="text-primary text-lg font-semibold">
                  Registration Numbers
                </h3>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {country === 'IN' && (
                    <FormField
                      control={form.control}
                      name="gstin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            {labels.vatId}{' '}
                            {vatGstRegistered ? (
                              <span className="text-red-500">*</span>
                            ) : (
                              <span className="text-muted-foreground font-normal">
                                (Optional)
                              </span>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                                <p className="mb-1 font-semibold">
                                  {vatGstRegistered
                                    ? 'Mandatory Field'
                                    : 'Optional Field'}
                                </p>
                                <p>
                                  GST Identification Number (GSTIN) is a
                                  15-character alphanumeric code for businesses
                                  registered under GST in India.{' '}
                                  {vatGstRegistered
                                    ? 'Required when VAT/GST Registered toggle is enabled. '
                                    : ''}
                                  Used for GST-compliant invoicing, tax filing,
                                  and inter-state transactions.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ''}
                                  placeholder={`Enter ${labels.vatId}`}
                                  className="font-mono uppercase"
                                  onChange={(e) => {
                                    field.onChange(e.target.value.toUpperCase())
                                    // Reset verification status when GSTIN changes
                                    if (gstinVerificationStatus !== 'idle') {
                                      setGstinVerificationStatus('idle')
                                      setGstinVerificationMessage('')
                                    }
                                  }}
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleVerifyGSTIN}
                                disabled={
                                  gstinVerificationStatus === 'verifying' ||
                                  !gstin ||
                                  gstin.length !== 15
                                }
                                className="shrink-0"
                              >
                                {gstinVerificationStatus === 'verifying' ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying...
                                  </>
                                ) : gstinVerificationStatus === 'verified' ? (
                                  <>
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                    Verified
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                    Verify
                                  </>
                                )}
                              </Button>
                            </div>
                            {gstinVerificationStatus === 'verified' && (
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>{gstinVerificationMessage}</span>
                              </div>
                            )}
                            {gstinVerificationStatus === 'error' && (
                              <div className="flex items-center gap-2 text-sm text-red-600">
                                <XCircle className="h-4 w-4" />
                                <span>{gstinVerificationMessage}</span>
                              </div>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {country !== 'IN' && (
                    <FormField
                      control={form.control}
                      name="vatNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            {labels.vatId}{' '}
                            <span className="text-muted-foreground font-normal">
                              (Optional)
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                                <p className="mb-1 font-semibold">
                                  Optional Field
                                </p>
                                <p>
                                  VAT registration number issued by your
                                  country's tax authority. Required for
                                  VAT-compliant invoicing and tax reporting in
                                  countries with VAT systems.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder={`Enter ${labels.vatId}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Address Section */}
            <div className="bg-card space-y-6 rounded-lg border border-blue-100 p-8 shadow-sm ring-1 ring-blue-950/[0.04]">
              <h3 className="text-primary text-lg font-semibold">
                Billing Address
              </h3>

              <FormField
                control={form.control}
                name="billingAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Street Address <span className="text-red-500">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                          <p className="mb-1 font-semibold">Mandatory Field</p>
                          <p>
                            The registered business address used for legal
                            documents, invoices, and tax compliance. Must match
                            your business registration address.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        key="billing-address-textarea"
                        className="resize-none"
                        placeholder="Registered business address"
                        rows={3}
                        value={field.value || ''}
                        onChange={(e) => {
                          field.onChange(e.target.value)
                          // Keep resolver source-of-truth field in sync and re-validate immediately.
                          // Without shouldValidate, stale billingStreet errors keep Next disabled.
                          form.setValue('billingStreet', e.target.value, {
                            shouldValidate: true,
                            shouldDirty: true,
                            shouldTouch: true,
                          })
                          form.clearErrors(['billingAddress', 'billingStreet'])
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="billingCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        City <span className="text-red-500">*</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                            <p className="mb-1 font-semibold">
                              Mandatory Field
                            </p>
                            <p>
                              The city where your business is registered.
                              Required for address validation, tax jurisdiction
                              determination, and compliance.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ''}
                          placeholder="City"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billingZip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Postal/ZIP Code <span className="text-red-500">*</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                            <p className="mb-1 font-semibold">
                              Mandatory Field
                            </p>
                            <p>
                              Postal or ZIP code for your registered business
                              address. Required for accurate address validation,
                              shipping, and tax calculations.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ''}
                          placeholder="ZIP/Postal Code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Conditional State Field - Only show for countries with states */}
              {stateFieldConfig.visible && (
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        {stateFieldConfig.label}{' '}
                        {stateFieldConfig.required && (
                          <span className="text-red-500">*</span>
                        )}
                        {!stateFieldConfig.required && (
                          <span className="text-muted-foreground font-normal">
                            (Optional)
                          </span>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="text-muted-foreground hover:text-muted-foreground h-4 w-4 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs border border-blue-800/50 bg-blue-950 text-white shadow-lg">
                            <p className="mb-1 font-semibold">
                              {stateFieldConfig.required
                                ? 'Mandatory'
                                : 'Optional'}{' '}
                              Field
                            </p>
                            <p>
                              State or province where your business is
                              registered. Required for tax jurisdiction,
                              compliance, and regional regulations in countries
                              with state-level taxation.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Popover
                        open={stateComboOpen}
                        onOpenChange={setStateComboOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={stateComboOpen}
                              className={cn(
                                'w-full justify-between font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value
                                ? (STATES.find((s) => s.id === field.value)
                                    ?.name ?? field.value)
                                : `Select ${stateFieldConfig.label.toLowerCase()}`}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0"
                          align="start"
                        >
                          <Command>
                            <CommandInput placeholder="Search state…" />
                            <CommandList>
                              <CommandEmpty>No state found.</CommandEmpty>
                              <CommandGroup>
                                {STATES.map((state) => (
                                  <CommandItem
                                    key={state.id}
                                    value={state.name}
                                    onSelect={() => {
                                      field.onChange(state.id)
                                      form.setValue(
                                        'incorporationState',
                                        state.id,
                                        { shouldValidate: false }
                                      )
                                      form.setValue('billingState', state.id, {
                                        shouldValidate: false,
                                      })
                                      setStateComboOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        field.value === state.id
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    {state.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Mailing Address Toggle */}
              <FormField
                control={form.control}
                name="mailingAddressSameAsRegistered"
                render={({ field }) => (
                  <FormItem className="border-border bg-card/70 flex flex-row items-center justify-between rounded-lg border p-4 backdrop-blur-sm">
                    <div className="flex-1 space-y-0.5 pr-4">
                      <FormLabel className="text-primary flex items-center gap-2 text-base font-semibold">
                        Mailing Address{' '}
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
                              If your mailing address differs from your
                              registered business address, enable this to enter
                              a separate mailing address for correspondence and
                              document delivery.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormDescription className="text-muted-foreground text-sm">
                        Same as billing/registered address?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value !== false}
                        onCheckedChange={(checked) =>
                          field.onChange(Boolean(checked))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Mailing Address Fields (Conditional) */}
              {mailingAddressSame === false && (
                <div className="border-border bg-muted space-y-4 rounded-lg border p-4">
                  <h4 className="text-foreground text-sm font-medium">
                    Mailing Address Details
                  </h4>
                  <FormField
                    control={form.control}
                    name="mailingAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="mailingCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mailingZip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal/ZIP</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="mailingState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mailingCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px] overflow-y-auto">
                              {COUNTRIES.map((country) => (
                                <SelectItem key={country.id} value={country.id}>
                                  {country.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
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
    // Only re-render if form control changes or userClassification changes
    return (
      prevProps.userClassification === nextProps.userClassification &&
      prevProps.form.control === nextProps.form.control
    )
  }
)
