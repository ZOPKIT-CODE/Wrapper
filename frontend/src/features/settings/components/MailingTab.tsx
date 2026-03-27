import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { COUNTRIES } from '@/features/onboarding/schemas';
import type { AccountSettingsData } from '../types';

interface MailingTabProps {
  form: UseFormReturn<AccountSettingsData>;
  mailingAddressSameAsRegistered: boolean;
}

export const MailingTab: React.FC<MailingTabProps> = ({
  form,
  mailingAddressSameAsRegistered,
}) => {
  return (
    <TabsContent value="mailing" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mailing Address</CardTitle>
          <CardDescription>
            Configure mailing address if different from registered address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="mailingAddressSameAsRegistered" className="text-base font-medium">
                Mailing address same as registered address
              </Label>
              <p className="text-sm text-muted-foreground">
                If enabled, your mailing address will match your registered business address
              </p>
            </div>
            <Switch
              id="mailingAddressSameAsRegistered"
              checked={mailingAddressSameAsRegistered}
              onCheckedChange={(checked) => form.setValue('mailingAddressSameAsRegistered', checked)}
            />
          </div>

          {!mailingAddressSameAsRegistered && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mailingStreet">Street Address</Label>
                  <Input
                    id="mailingStreet"
                    {...form.register('mailingStreet')}
                    placeholder="123 Main Street, Suite 100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="mailingCity">City</Label>
                    <Input
                      id="mailingCity"
                      {...form.register('mailingCity')}
                      placeholder="City name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mailingState">State/Province</Label>
                    <Input
                      id="mailingState"
                      {...form.register('mailingState')}
                      placeholder="State or province"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="mailingZip">ZIP/Postal Code</Label>
                    <Input
                      id="mailingZip"
                      {...form.register('mailingZip')}
                      placeholder="12345"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mailingCountry">Country</Label>
                    <Select
                      value={form.watch('mailingCountry') || ''}
                      onValueChange={(value) => form.setValue('mailingCountry', value)}
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
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
};
