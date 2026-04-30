import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { Phone } from 'lucide-react';
import {
  CONTACT_SALUTATIONS,
  CONTACT_AUTHORITY_LEVELS,
  CONTACT_METHODS,
} from '@/features/onboarding/schemas';
import type { AccountSettingsData } from '../types';

interface ContactTabProps {
  form: UseFormReturn<AccountSettingsData>;
}

export const ContactTab: React.FC<ContactTabProps> = ({ form }) => {
  return (
    <TabsContent value="contact" className="space-y-6">
      <Card style={{ border: '1px solid var(--zk-line)' }}>
        <CardHeader>
          <CardTitle
            style={{
              fontFamily: 'var(--zk-display)',
              letterSpacing: '-0.025em',
              color: 'var(--zk-ink)',
            }}
          >
            Contact Information
          </CardTitle>
          <CardDescription
            style={{
              fontFamily: 'var(--zk-font)',
              color: 'var(--zk-muted)',
              fontSize: 13,
            }}
          >
            Manage additional contact details and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="billingEmail"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--zk-muted)',
                  fontFamily: 'var(--zk-font)',
                }}
              >
                Billing Email
              </Label>
              <Input
                id="billingEmail"
                type="email"
                {...form.register('billingEmail')}
                placeholder="billing@company.com"
                style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
              />
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--zk-muted-2)',
                  fontFamily: 'var(--zk-font)',
                }}
              >
                Separate email for invoices and billing
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="supportEmail"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--zk-muted)',
                  fontFamily: 'var(--zk-font)',
                }}
              >
                Support Email
              </Label>
              <Input
                id="supportEmail"
                type="email"
                {...form.register('supportEmail')}
                placeholder="support@company.com"
                style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
              />
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--zk-muted-2)',
                  fontFamily: 'var(--zk-font)',
                }}
              >
                Email address for customer support
              </p>
            </div>
          </div>

          <Separator style={{ borderColor: 'var(--zk-line)' }} />

          <div className="space-y-4">
            <h3
              style={{
                fontSize: 14,
                fontFamily: 'var(--zk-display)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--zk-ink)',
              }}
            >
              Primary Contact Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label
                  htmlFor="contactSalutation"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Salutation
                </Label>
                <Select
                  value={form.watch('contactSalutation') || ''}
                  onValueChange={(value) => form.setValue('contactSalutation', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_SALUTATIONS.map((salutation) => (
                      <SelectItem key={salutation.id} value={salutation.id}>
                        {salutation.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="contactMiddleName"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Middle Name
                </Label>
                <Input
                  id="contactMiddleName"
                  {...form.register('contactMiddleName')}
                  placeholder="Middle name"
                  style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="contactDepartment"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Department
                </Label>
                <Input
                  id="contactDepartment"
                  {...form.register('contactDepartment')}
                  placeholder="Department name"
                  style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label
                  htmlFor="contactJobTitle"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Job Title
                </Label>
                <Input
                  id="contactJobTitle"
                  {...form.register('contactJobTitle')}
                  placeholder="e.g., CEO, Manager"
                  style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="contactAuthorityLevel"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Authority Level
                </Label>
                <Select
                  value={form.watch('contactAuthorityLevel') || ''}
                  onValueChange={(value) => form.setValue('contactAuthorityLevel', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select authority level" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_AUTHORITY_LEVELS.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator style={{ borderColor: 'var(--zk-line)' }} />

          <div className="space-y-4">
            <h3
              style={{
                fontSize: 14,
                fontFamily: 'var(--zk-display)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--zk-ink)',
              }}
            >
              Phone Numbers
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label
                  htmlFor="contactDirectPhone"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  <Phone className="h-4 w-4 inline mr-1" />
                  Direct Phone
                </Label>
                <Input
                  id="contactDirectPhone"
                  type="tel"
                  {...form.register('contactDirectPhone')}
                  placeholder="+1 555-123-4567"
                  style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="contactMobilePhone"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  <Phone className="h-4 w-4 inline mr-1" />
                  Mobile Phone
                </Label>
                <Input
                  id="contactMobilePhone"
                  type="tel"
                  {...form.register('contactMobilePhone')}
                  placeholder="+1 555-987-6543"
                  style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
                />
              </div>
            </div>
          </div>

          <Separator style={{ borderColor: 'var(--zk-line)' }} />

          <div className="space-y-4">
            <h3
              style={{
                fontSize: 14,
                fontFamily: 'var(--zk-display)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--zk-ink)',
              }}
            >
              Contact Preferences
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label
                  htmlFor="preferredContactMethod"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Preferred Contact Method
                </Label>
                <Select
                  value={form.watch('preferredContactMethod') || ''}
                  onValueChange={(value) => form.setValue('preferredContactMethod', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select preferred method" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_METHODS.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="contactPreferredContactMethod"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Contact's Preferred Method
                </Label>
                <Select
                  value={form.watch('contactPreferredContactMethod') || ''}
                  onValueChange={(value) => form.setValue('contactPreferredContactMethod', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select preferred method" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_METHODS.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};
