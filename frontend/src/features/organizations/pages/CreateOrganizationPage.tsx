import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building, Check, ChevronLeft, ChevronRight, Loader2, Save } from 'lucide-react'

import { useDashboardData } from '@/hooks/useDashboardData'
import { useOrganizationAuth } from '@/hooks/useOrganizationAuth'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import toast from 'react-hot-toast'

type CreateSearch = {
  parentId?: string
  parentName?: string
}

const steps = [
  { title: 'Basic Information', description: 'Name and type' },
  { title: 'Location & Currency', description: 'Country, currency, and fiscal year' },
  { title: 'Legal & Compliance', description: 'Tax ID and registration details' },
  { title: 'Contact & Additional', description: 'Contact details and notes' },
]

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  IN: 'INR',
  CA: 'CAD',
  AU: 'AUD',
  JP: 'JPY',
  CN: 'CNY',
  DE: 'EUR',
  FR: 'EUR',
  SG: 'SGD',
  CH: 'CHF',
}

const EMPTY_FORM = {
  name: '',
  legalName: '',
  description: '',
  responsiblePersonId: '',
  organizationType: 'subsidiary',
  status: 'active',
  country: '',
  currency: 'USD',
  fiscalYearEnd: '12-31',
  taxId: '',
  registrationNumber: '',
  email: '',
  phone: '',
  website: '',
  notes: '',
}

export function CreateOrganizationPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as CreateSearch
  const { tenantId } = useOrganizationAuth()
  const { users: employees } = useDashboardData()
  const queryClient = useQueryClient()

  const [currentStep, setCurrentStep] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [users, setUsers] = useState<any[]>([])
  const submitIdempotencyKeyRef = useRef<string | null>(null)

  const parentName = search.parentName
  const parentId = search.parentId

  const managerUserList = useMemo(() => {
    const fromApi = (users || []).map((u: any) => ({
      userId: u.userId || u.id,
      name: u.name ?? u.email ?? '',
      email: u.email ?? '',
    }))
    if (fromApi.length > 0) return fromApi
    return (employees || []).map((e: any) => ({
      userId: e.userId || e.id,
      name: e.name ?? e.email ?? '',
      email: e.email ?? '',
    }))
  }, [users, employees])

  const loadUsersIfNeeded = async () => {
    if (users.length > 0) return
    try {
      const res = await api('/tenants/current/users', {
        method: 'GET',
        headers: { 'X-Application': 'crm' },
        withCredentials: true,
      })
      if (res?.data?.success) {
        const raw = res.data.data ?? res.data.users ?? []
        const list = Array.isArray(raw) ? raw : []
        setUsers(
          list
            .filter((u: any) => u && (u.userId || u.id))
            .map((u: any) => ({
              userId: u.userId || u.id,
              name: u.name ?? u.email ?? '',
              email: u.email ?? '',
            })),
        )
      }
    } catch {
      // Non-blocking: dropdown still falls back to employees
    }
  }

  const validateStep = (step: number): string | null => {
    if (step === 0) {
      if (!formData.name.trim() || formData.name.trim().length < 2) return 'Name must be at least 2 characters'
      if (!formData.legalName.trim()) return 'Legal name is required'
    }
    if (step === 1) {
      if (!formData.country) return 'Country is required'
      if (!formData.currency) return 'Currency is required'
    }
    return null
  }

  const handleNext = async () => {
    const stepError = validateStep(currentStep)
    if (stepError) {
      setError(stepError)
      return
    }
    setError('')
    if (currentStep === 0) await loadUsersIfNeeded()
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
  }

  const handlePrevious = () => {
    setError('')
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }

  const handleCancel = () => {
    navigate({ to: '/dashboard/organization' })
  }

  const createIdempotencyKey = () =>
    `create-organization:${parentId ?? 'root'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`

  const handleSubmit = async () => {
    if (isCreating) return

    for (let step = 0; step < steps.length - 1; step += 1) {
      const stepError = validateStep(step)
      if (stepError) {
        setCurrentStep(step)
        setError(stepError)
        return
      }
    }

    setIsCreating(true)
    setError('')
    const loadingToastId = toast.loading('Creating organization...')
    submitIdempotencyKeyRef.current = createIdempotencyKey()

    try {
      const response = await api('/entities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Application': 'crm',
          'X-Idempotency-Key': submitIdempotencyKeyRef.current,
        },
        withCredentials: true,
        data: {
          entityName: formData.name.trim(),
          legalName: formData.legalName.trim(),
          description: formData.description,
          parentEntityId: parentId || null,
          parentTenantId: tenantId || '',
          responsiblePersonId: formData.responsiblePersonId === 'none' ? null : formData.responsiblePersonId || null,
          entityType: 'organization',
          subType: formData.organizationType || 'subsidiary',
          status: formData.status,
          country: formData.country,
          currency: formData.currency,
          fiscalYearEnd: formData.fiscalYearEnd,
          taxId: formData.taxId || undefined,
          registrationNumber: formData.registrationNumber || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          notes: formData.notes || undefined,
        },
      })

      if (!response?.data?.success) {
        throw new Error(response?.data?.message || 'Failed to create organization')
      }

      queryClient.invalidateQueries({ queryKey: ['organizations', 'hierarchy', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['organizations', 'available'] })
      queryClient.invalidateQueries({ queryKey: ['entities', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['entityScope'] })
      toast.success('Organization created')
      navigate({ to: '/dashboard/organization' })
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Failed to create organization'
      setError(message)
      toast.error(message)
    } finally {
      toast.dismiss(loadingToastId)
      setIsCreating(false)
      submitIdempotencyKeyRef.current = null
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1B2E5A] dark:text-slate-100">
            Create Organization
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {parentName ? (
              <>
                Adding under: <span className="font-medium text-blue-600">{parentName}</span>
              </>
            ) : (
              'Create a new top-level organization for this tenant.'
            )}
          </p>
        </div>
        <Button variant="outline" onClick={handleCancel} className="h-10 gap-2 self-start font-medium">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
        <CardHeader className="space-y-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#1B2E5A] dark:text-slate-100">
            <Building className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {steps[currentStep].title}
          </CardTitle>
          <CardDescription className="text-sm">{steps[currentStep].description}</CardDescription>
          <div className="grid grid-cols-4 items-center gap-2 pt-1">
            {steps.map((step, index) => (
              <div key={step.title} className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    index === currentStep
                      ? 'bg-[#1B2E5A] text-white shadow-sm'
                      : index < currentStep
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {index < currentStep ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <span className={`hidden text-xs sm:block ${index === currentStep ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-400'}`}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-5 min-h-[280px]">
            {currentStep === 0 && (
              <>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Acme Subsidiary"
                    className="h-11 bg-slate-50/70 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Legal Name *</Label>
                  <Input
                    value={formData.legalName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, legalName: e.target.value }))}
                    placeholder="Acme Subsidiary Inc."
                    className="h-11 bg-slate-50/70 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Type</Label>
                    <Select
                      value={formData.organizationType}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, organizationType: value }))}
                    >
                      <SelectTrigger className="h-11 bg-slate-50/70 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parent">Parent Company</SelectItem>
                        <SelectItem value="subsidiary">Subsidiary</SelectItem>
                        <SelectItem value="branch">Branch</SelectItem>
                        <SelectItem value="division">Division</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="h-11 bg-slate-50/70 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Manager (Optional)</Label>
                  <Select
                    value={formData.responsiblePersonId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, responsiblePersonId: value }))}
                  >
                    <SelectTrigger className="h-11 bg-slate-50/70 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700">
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {managerUserList.map((u) => (
                        <SelectItem key={u.userId} value={u.userId}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {currentStep === 1 && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Country *</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          country: value,
                          currency: COUNTRY_CURRENCY_MAP[value] || prev.currency,
                        }))
                      }
                    >
                      <SelectTrigger className="h-11 bg-slate-50/70 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States (US)</SelectItem>
                        <SelectItem value="GB">United Kingdom (GB)</SelectItem>
                        <SelectItem value="IN">India (IN)</SelectItem>
                        <SelectItem value="CA">Canada (CA)</SelectItem>
                        <SelectItem value="AU">Australia (AU)</SelectItem>
                        <SelectItem value="JP">Japan (JP)</SelectItem>
                        <SelectItem value="CN">China (CN)</SelectItem>
                        <SelectItem value="DE">Germany (DE)</SelectItem>
                        <SelectItem value="FR">France (FR)</SelectItem>
                        <SelectItem value="SG">Singapore (SG)</SelectItem>
                        <SelectItem value="CH">Switzerland (CH)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Currency *</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger className="h-11 bg-slate-50/70 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'SGD'].map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Fiscal Year End</Label>
                  <Select
                    value={formData.fiscalYearEnd}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, fiscalYearEnd: value }))}
                  >
                    <SelectTrigger className="h-11 bg-slate-50/70 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12-31">December 31 (12-31)</SelectItem>
                      <SelectItem value="03-31">March 31 (03-31)</SelectItem>
                      <SelectItem value="06-30">June 30 (06-30)</SelectItem>
                      <SelectItem value="09-30">September 30 (09-30)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Tax ID</Label>
                  <Input
                    value={formData.taxId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, taxId: e.target.value }))}
                    placeholder="Enter tax ID (optional)"
                    className="h-11 bg-slate-50/70 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Registration Number</Label>
                  <Input
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, registrationNumber: e.target.value }))}
                    placeholder="Enter registration number (optional)"
                    className="h-11 bg-slate-50/70 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700"
                  />
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Email</Label>
                    <Input
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="contact@example.com"
                      type="email"
                      className="h-11 bg-slate-50/70 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 555 000 0000"
                      className="h-11 bg-slate-50/70 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Website</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                    placeholder="https://example.com"
                    className="h-11 bg-slate-50/70 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Description / Notes</Label>
                  <Textarea
                    value={formData.description || formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                        notes: e.target.value,
                      }))
                    }
                    rows={3}
                    className="bg-slate-50/70 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:bg-slate-900/40 dark:border-slate-700"
                  />
                </div>
              </>
            )}
          </div>

          <div className="sticky bottom-0 z-10 -mx-6 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
            <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isCreating}
              className="h-10 min-w-[96px] rounded-md font-medium"
            >
              Cancel
            </Button>
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isCreating}
                className="h-10 min-w-[96px] gap-1 rounded-md font-medium"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={isCreating}
                className="h-10 min-w-[112px] gap-1 rounded-md bg-[#1B2E5A] font-medium text-white shadow-sm hover:bg-[#152449]"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isCreating}
                className="h-10 min-w-[164px] gap-1 rounded-md bg-[#1B2E5A] font-medium text-white shadow-sm hover:bg-[#152449]"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Create Organization
                  </>
                )}
              </Button>
            )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CreateOrganizationPage
