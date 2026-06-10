import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PearlButton } from '@/components/ui/pearl-button'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { Building, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  ORGANIZATION_CREATE_STEPS,
  OrganizationCreateStepper,
} from '@/features/organizations/components/OrganizationCreateStepper'

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  US: 'USD', GB: 'GBP', IN: 'INR', CA: 'CAD', AU: 'AUD',
  JP: 'JPY', CN: 'CNY', DE: 'EUR', FR: 'EUR', SG: 'SGD', CH: 'CHF',
}

export interface CreateForm {
  entityType: 'organization' | 'location' | 'department' | 'team'
  subType: string
  name: string
  code: string
  legalName: string
  description: string
  status: string
  responsiblePersonId: string
  country: string
  currency: string
  fiscalYearEnd: string
  taxId: string
  registrationNumber: string
  email: string
  phone: string
  website: string
  notes: string
}

interface ManagerUser {
  userId: string
  name: string
  email: string
}

interface SelectedOrg {
  entityId: string
  entityName: string
}

export interface OrganizationCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  createForm: CreateForm
  setCreateForm: (form: CreateForm) => void
  createFormStep: number
  setCreateFormStep: (step: number | ((s: number) => number)) => void
  managerUserList: ManagerUser[]
  selectedOrg: SelectedOrg | null
  isCreatingEntity: boolean
  onCreateNext: () => void
  onCreateEntity: () => void
}

export function OrganizationCreateDialog({
  open,
  onOpenChange,
  createForm,
  setCreateForm,
  createFormStep,
  setCreateFormStep,
  managerUserList,
  selectedOrg,
  isCreatingEntity,
  onCreateNext,
  onCreateEntity,
}: OrganizationCreateDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) setCreateFormStep(0)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Entity</DialogTitle>
          <DialogDescription>
            {selectedOrg ? (
              <>
                Adding under: <span className="font-semibold text-primary">{selectedOrg.entityName}</span>
              </>
            ) : (
              'Create a top-level entity'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-2" style={{ fontFamily: 'var(--zk-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--zk-ink)' }}>
            <Building className="h-5 w-5 shrink-0" style={{ color: 'var(--zk-navy)' }} aria-hidden />
            {ORGANIZATION_CREATE_STEPS[createFormStep].title}
          </div>
          <p className="text-sm text-muted-foreground">
            {ORGANIZATION_CREATE_STEPS[createFormStep].description}
          </p>
          <OrganizationCreateStepper currentStep={createFormStep} />
        </div>

        <div className="grid gap-4 py-2 min-h-[240px]">
          {createFormStep === 0 && (
            <>
              <div className="grid gap-2">
                <Label>Entity Type</Label>
                <Select
                  value={createForm.entityType}
                  onValueChange={(v: any) =>
                    setCreateForm({
                      ...createForm,
                      entityType: v,
                      subType:
                        v === 'location'
                          ? 'office'
                          : v === 'department'
                            ? 'department'
                            : v === 'team'
                              ? 'team'
                              : 'subsidiary',
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organization">Organization</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Name <span className="text-red-500">*</span></Label>
                  <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Entity Code</Label>
                  <Input value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Legal Name <span className="text-red-500">*</span></Label>
                <Input value={createForm.legalName} onChange={(e) => setCreateForm({ ...createForm, legalName: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Subtype</Label>
                  <Select value={createForm.subType} onValueChange={(v) => setCreateForm({ ...createForm, subType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {createForm.entityType === 'organization' && (
                        <>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="subsidiary">Subsidiary</SelectItem>
                          <SelectItem value="branch">Branch</SelectItem>
                          <SelectItem value="division">Division</SelectItem>
                        </>
                      )}
                      {createForm.entityType === 'location' && (
                        <>
                          <SelectItem value="office">Office</SelectItem>
                          <SelectItem value="warehouse">Warehouse</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="branch">Branch</SelectItem>
                        </>
                      )}
                      {createForm.entityType === 'department' && <SelectItem value="department">Department</SelectItem>}
                      {createForm.entityType === 'team' && <SelectItem value="team">Team</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={createForm.status} onValueChange={(v) => setCreateForm({ ...createForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Manager (Optional)</Label>
                <Select value={createForm.responsiblePersonId} onValueChange={(v) => setCreateForm({ ...createForm, responsiblePersonId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select User" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {managerUserList.map((u) => (
                      <SelectItem key={u.userId} value={u.userId}>{u.name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {createFormStep === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Country <span className="text-red-500">*</span></Label>
                  <Select
                    value={createForm.country}
                    onValueChange={(v) =>
                      setCreateForm({ ...createForm, country: v, currency: COUNTRY_CURRENCY_MAP[v] || createForm.currency })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>
                      {[
                        { code: 'US', name: 'United States' },
                        { code: 'GB', name: 'United Kingdom' },
                        { code: 'IN', name: 'India' },
                        { code: 'CA', name: 'Canada' },
                        { code: 'AU', name: 'Australia' },
                        { code: 'JP', name: 'Japan' },
                        { code: 'CN', name: 'China' },
                        { code: 'DE', name: 'Germany' },
                        { code: 'FR', name: 'France' },
                        { code: 'SG', name: 'Singapore' },
                        { code: 'CH', name: 'Switzerland' },
                      ].map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Currency <span className="text-red-500">*</span></Label>
                  <Select value={createForm.currency} onValueChange={(v) => setCreateForm({ ...createForm, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'SGD'].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Fiscal Year End</Label>
                <Select value={createForm.fiscalYearEnd} onValueChange={(v) => setCreateForm({ ...createForm, fiscalYearEnd: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { v: '12-31', l: 'December 31 (12-31)' },
                      { v: '03-31', l: 'March 31 (03-31)' },
                      { v: '06-30', l: 'June 30 (06-30)' },
                      { v: '09-30', l: 'September 30 (09-30)' },
                    ].map((o) => (
                      <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {createFormStep === 2 && (
            <>
              <div className="grid gap-2">
                <Label>Tax ID</Label>
                <Input value={createForm.taxId} onChange={(e) => setCreateForm({ ...createForm, taxId: e.target.value })} placeholder="Enter tax ID (optional)" />
              </div>
              <div className="grid gap-2">
                <Label>Registration Number</Label>
                <Input value={createForm.registrationNumber} onChange={(e) => setCreateForm({ ...createForm, registrationNumber: e.target.value })} placeholder="Enter registration number (optional)" />
              </div>
            </>
          )}

          {createFormStep === 3 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="contact@example.com" type="email" />
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+1 555 000 0000" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Website</Label>
                <Input value={createForm.website} onChange={(e) => setCreateForm({ ...createForm, website: e.target.value })} placeholder="https://example.com" />
              </div>
              <div className="grid gap-2">
                <Label>Description / Notes</Label>
                <Textarea
                  value={createForm.description || createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <PearlButton
            variant="outline"
            onClick={() => { onOpenChange(false); setCreateFormStep(0) }}
            disabled={isCreatingEntity}
          >
            Cancel
          </PearlButton>
          {createFormStep > 0 && (
            <PearlButton
              variant="outline"
              onClick={() => setCreateFormStep((s) => s - 1)}
              disabled={isCreatingEntity}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </PearlButton>
          )}
          {createFormStep < ORGANIZATION_CREATE_STEPS.length - 1 ? (
            <PearlButton onClick={onCreateNext} color="blue" className="gap-1">
              Next
              <ChevronRight className="h-4 w-4" />
            </PearlButton>
          ) : (
            <PearlButton onClick={onCreateEntity} disabled={isCreatingEntity} color="blue">
              {isCreatingEntity ? (
                <><ZopkitRoundLoader size="xs" className="mr-2" />Creating...</>
              ) : (
                'Create Entity'
              )}
            </PearlButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
