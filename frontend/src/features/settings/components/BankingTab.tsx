import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { CURRENCIES } from '@/features/onboarding/schemas';
import type { AccountSettingsData } from '../types';

interface BankingTabProps {
  form: UseFormReturn<AccountSettingsData>;
  billingCountry: string | undefined;
}

export const BankingTab: React.FC<BankingTabProps> = ({ form, billingCountry }) => {
  return (
    <TabsContent value="banking" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Banking & Financial Information</CardTitle>
          <CardDescription>
            Configure your bank account details and payment preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name <span className="text-red-500">*</span></Label>
              <Input
                id="bankName"
                {...form.register('bankName')}
                placeholder="Enter bank name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankBranch">Bank Branch</Label>
              <Input
                id="bankBranch"
                {...form.register('bankBranch')}
                placeholder="Branch name/location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountHolderName">Account Holder Name <span className="text-red-500">*</span></Label>
              <Input
                id="accountHolderName"
                {...form.register('accountHolderName')}
                placeholder="Name on bank account"
              />
              <p className="text-sm text-muted-foreground">
                Must match your organization name
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number <span className="text-red-500">*</span></Label>
              <Input
                id="accountNumber"
                type="password"
                {...form.register('accountNumber')}
                placeholder="Enter account number"
              />
              <p className="text-sm text-muted-foreground">
                Account number will be encrypted
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type <span className="text-red-500">*</span></Label>
              <Select
                value={form.watch('accountType') || ''}
                onValueChange={(value) => form.setValue('accountType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankAccountCurrency">Currency <span className="text-red-500">*</span></Label>
              <Select
                value={form.watch('bankAccountCurrency') || ''}
                onValueChange={(value) => form.setValue('bankAccountCurrency', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">International Banking Codes</h3>
            <p className="text-sm text-muted-foreground">
              Required based on your country and payment needs
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="swiftBicCode">SWIFT/BIC Code</Label>
                <Input
                  id="swiftBicCode"
                  {...form.register('swiftBicCode')}
                  placeholder="8 or 11 characters"
                  maxLength={11}
                />
                <p className="text-sm text-muted-foreground">
                  Required for international payments
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  {...form.register('iban')}
                  placeholder="Up to 34 characters"
                  maxLength={34}
                />
                <p className="text-sm text-muted-foreground">
                  Required for EU/UK payments
                </p>
              </div>

              {billingCountry === 'US' && (
                <div className="space-y-2">
                  <Label htmlFor="routingNumberUs">Routing Number (US) <span className="text-red-500">*</span></Label>
                  <Input
                    id="routingNumberUs"
                    {...form.register('routingNumberUs')}
                    placeholder="9 digits"
                    maxLength={9}
                  />
                </div>
              )}

              {billingCountry === 'UK' && (
                <div className="space-y-2">
                  <Label htmlFor="sortCodeUk">Sort Code (UK) <span className="text-red-500">*</span></Label>
                  <Input
                    id="sortCodeUk"
                    {...form.register('sortCodeUk')}
                    placeholder="XX-XX-XX"
                    maxLength={6}
                  />
                </div>
              )}

              {billingCountry === 'IN' && (
                <div className="space-y-2">
                  <Label htmlFor="ifscCodeIndia">IFSC Code (India) <span className="text-red-500">*</span></Label>
                  <Input
                    id="ifscCodeIndia"
                    {...form.register('ifscCodeIndia')}
                    placeholder="AAAA0BBBBBB"
                    maxLength={11}
                  />
                </div>
              )}

              {billingCountry === 'AU' && (
                <div className="space-y-2">
                  <Label htmlFor="bsbNumberAustralia">BSB Number (Australia) <span className="text-red-500">*</span></Label>
                  <Input
                    id="bsbNumberAustralia"
                    {...form.register('bsbNumberAustralia')}
                    placeholder="XXX-XXX"
                    maxLength={6}
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Payment Terms <span className="text-red-500">*</span></Label>
              <Select
                value={form.watch('paymentTerms') || ''}
                onValueChange={(value) => form.setValue('paymentTerms', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="net-15">Net 15</SelectItem>
                  <SelectItem value="net-30">Net 30</SelectItem>
                  <SelectItem value="net-45">Net 45</SelectItem>
                  <SelectItem value="net-60">Net 60</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredPaymentMethod">Preferred Payment Method <span className="text-red-500">*</span></Label>
              <Select
                value={form.watch('preferredPaymentMethod') || ''}
                onValueChange={(value) => form.setValue('preferredPaymentMethod', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wire-transfer">Wire Transfer</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="creditLimit">Credit Limit</Label>
              <Input
                id="creditLimit"
                type="number"
                step="0.01"
                {...form.register('creditLimit', { valueAsNumber: true })}
                placeholder="0.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};
