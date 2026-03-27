import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { COUNTRIES } from '@/features/onboarding/schemas';
import type { AccountSettingsData } from '../types';

interface TaxComplianceTabProps {
  form: UseFormReturn<AccountSettingsData>;
  billingCountry: string | undefined;
  taxRegistered: boolean | undefined;
  taxExemptStatus: boolean | undefined;
  withholdingTaxApplicable: boolean | undefined;
  vatGstRegistered: boolean | undefined;
  professionalIndemnityInsurance: boolean | undefined;
}

export const TaxComplianceTab: React.FC<TaxComplianceTabProps> = ({
  form,
  billingCountry,
  taxRegistered,
  taxExemptStatus,
  withholdingTaxApplicable,
  vatGstRegistered,
  professionalIndemnityInsurance,
}) => {
  return (
    <TabsContent value="tax" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tax & Compliance Information</CardTitle>
          <CardDescription>
            Comprehensive tax and regulatory compliance details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Tax Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="taxResidenceCountry">Tax Residence Country <span className="text-red-500">*</span></Label>
                <Select
                  value={form.watch('taxResidenceCountry') || ''}
                  onValueChange={(value) => form.setValue('taxResidenceCountry', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.id} value={country.id}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="regulatoryComplianceStatus">Regulatory Compliance Status <span className="text-red-500">*</span></Label>
                <Select
                  value={form.watch('regulatoryComplianceStatus') || 'Pending'}
                  onValueChange={(value) => form.setValue('regulatoryComplianceStatus', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Compliant">Compliant</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Non-Compliant">Non-Compliant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="panNumber">PAN Number (India)</Label>
                <Input
                  id="panNumber"
                  {...form.register('taxRegistrationDetails.pan')}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="einNumber">EIN Number (USA)</Label>
                <Input
                  id="einNumber"
                  {...form.register('taxRegistrationDetails.ein')}
                  placeholder="12-3456789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT Number</Label>
                <Input
                  id="vatNumber"
                  {...form.register('taxRegistrationDetails.vat')}
                  placeholder="VAT123456789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cinNumber">CIN Number (India)</Label>
                <Input
                  id="cinNumber"
                  {...form.register('taxRegistrationDetails.cin')}
                  placeholder="U12345AB2023PTC123456"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Tax Exempt Status */}
          {taxRegistered && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Tax Exempt Status</h3>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="taxExemptStatus" className="text-base font-medium">
                    Tax Exempt Organization
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Is your organization tax exempt?
                  </p>
                </div>
                <Switch
                  id="taxExemptStatus"
                  checked={form.watch('taxExemptStatus') || false}
                  onCheckedChange={(checked) => form.setValue('taxExemptStatus', checked)}
                />
              </div>

              {taxExemptStatus && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="taxExemptionCertificateNumber">
                      Tax Exemption Certificate Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="taxExemptionCertificateNumber"
                      {...form.register('taxExemptionCertificateNumber')}
                      placeholder="Certificate number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taxExemptionExpiryDate">
                      Tax Exemption Expiry Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="taxExemptionExpiryDate"
                      type="date"
                      {...form.register('taxExemptionExpiryDate')}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Withholding Tax */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Withholding Tax</h3>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="withholdingTaxApplicable" className="text-base font-medium">
                  Withholding Tax Applicable
                </Label>
                <p className="text-sm text-muted-foreground">
                  Is your organization subject to withholding tax?
                </p>
              </div>
              <Switch
                id="withholdingTaxApplicable"
                checked={form.watch('withholdingTaxApplicable') || false}
                onCheckedChange={(checked) => form.setValue('withholdingTaxApplicable', checked)}
              />
            </div>

            {withholdingTaxApplicable && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="withholdingTaxRate">
                    Withholding Tax Rate (%) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="withholdingTaxRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    {...form.register('withholdingTaxRate', { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxTreatyCountry">Tax Treaty Country</Label>
                  <Select
                    value={form.watch('taxTreatyCountry') || ''}
                    onValueChange={(value) => form.setValue('taxTreatyCountry', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* US-Specific Tax Forms */}
          {form.watch('billingCountry') === 'US' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">US Tax Forms</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="w9StatusUs">W-9 Status</Label>
                  <Select
                    value={form.watch('w9StatusUs') || ''}
                    onValueChange={(value) => form.setValue('w9StatusUs', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="not-required">Not Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Non-US Entities Doing US Business */}
          {billingCountry && billingCountry !== 'US' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">US Business Forms</h3>

              <div className="space-y-2">
                <Label htmlFor="w8FormTypeUs">W-8 Form Type</Label>
                <Select
                  value={form.watch('w8FormTypeUs') || ''}
                  onValueChange={(value) => form.setValue('w8FormTypeUs', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select form type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="w8ben">W-8BEN</SelectItem>
                    <SelectItem value="w8bene">W-8BEN-E</SelectItem>
                    <SelectItem value="w8eci">W-8ECI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Separator />

          {/* VAT/GST Specific Fields */}
          {vatGstRegistered && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">VAT/GST Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="reverseChargeMechanism" className="text-base font-medium">
                      Reverse Charge Mechanism
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Applicable for B2B transactions
                    </p>
                  </div>
                  <Switch
                    id="reverseChargeMechanism"
                    checked={form.watch('reverseChargeMechanism') || false}
                    onCheckedChange={(checked) => form.setValue('reverseChargeMechanism', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vatGstRateApplicable">VAT/GST Rate Applicable</Label>
                  <Select
                    value={form.watch('vatGstRateApplicable') || ''}
                    onValueChange={(value) => form.setValue('vatGstRateApplicable', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="reduced">Reduced</SelectItem>
                      <SelectItem value="zero-rated">Zero-rated</SelectItem>
                      <SelectItem value="exempt">Exempt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Compliance & Insurance */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Compliance & Insurance</h3>

            <div className="space-y-2">
              <Label htmlFor="industrySpecificLicenses">Industry-Specific Licenses</Label>
              <Textarea
                id="industrySpecificLicenses"
                {...form.register('industrySpecificLicenses')}
                placeholder="List any special licenses or certifications..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataProtectionRegistration">Data Protection Registration</Label>
              <Input
                id="dataProtectionRegistration"
                {...form.register('dataProtectionRegistration')}
                placeholder="GDPR/DPA registration number"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="professionalIndemnityInsurance" className="text-base font-medium">
                  Professional Indemnity Insurance
                </Label>
                <p className="text-sm text-muted-foreground">
                  Do you have professional indemnity insurance?
                </p>
              </div>
              <Switch
                id="professionalIndemnityInsurance"
                checked={form.watch('professionalIndemnityInsurance') || false}
                onCheckedChange={(checked) => form.setValue('professionalIndemnityInsurance', checked)}
              />
            </div>

            {professionalIndemnityInsurance && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="insurancePolicyNumber">
                    Insurance Policy Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="insurancePolicyNumber"
                    {...form.register('insurancePolicyNumber')}
                    placeholder="Policy number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="insuranceExpiryDate">
                    Insurance Expiry Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="insuranceExpiryDate"
                    type="date"
                    {...form.register('insuranceExpiryDate')}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};
