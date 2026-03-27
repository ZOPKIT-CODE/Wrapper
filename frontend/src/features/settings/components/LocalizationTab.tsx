import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { Calendar } from 'lucide-react';
import {
  CURRENCIES,
  LANGUAGES,
  LOCALES,
  TIMEZONES,
} from '@/features/onboarding/schemas';
import type { AccountSettingsData } from '../types';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

interface LocalizationTabProps {
  form: UseFormReturn<AccountSettingsData>;
  fiscalYearStartMonth: number | undefined;
  fiscalYearEndMonth: number | undefined;
  fiscalYearStartDay: number | undefined;
  fiscalYearEndDay: number | undefined;
}

export const LocalizationTab: React.FC<LocalizationTabProps> = ({
  form,
  fiscalYearStartMonth,
  fiscalYearEndMonth,
  fiscalYearStartDay,
  fiscalYearEndDay,
}) => {
  return (
    <TabsContent value="localization" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Localization & Regional Settings</CardTitle>
          <CardDescription>
            Configure language, currency, timezone, and fiscal year settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="defaultLanguage">Default Language</Label>
              <Select
                value={form.watch('defaultLanguage') || 'en'}
                onValueChange={(value) => form.setValue('defaultLanguage', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.id} value={lang.id}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultLocale">Default Locale</Label>
              <Select
                value={form.watch('defaultLocale') || 'en-US'}
                onValueChange={(value) => form.setValue('defaultLocale', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select locale" />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((locale) => (
                    <SelectItem key={locale.id} value={locale.id}>
                      {locale.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Default Currency</Label>
              <Select
                value={form.watch('defaultCurrency') || 'USD'}
                onValueChange={(value) => form.setValue('defaultCurrency', value)}
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

            <div className="space-y-2">
              <Label htmlFor="defaultTimeZone">Default Timezone</Label>
              <Select
                value={form.watch('defaultTimeZone') || 'UTC'}
                onValueChange={(value) => form.setValue('defaultTimeZone', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.id} value={tz.id}>
                      {tz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Fiscal Year Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="fiscalYearStartMonth">Fiscal Year Start Month</Label>
                <Select
                  value={form.watch('fiscalYearStartMonth')?.toString() || '1'}
                  onValueChange={(value) => form.setValue('fiscalYearStartMonth', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fiscalYearStartDay">Fiscal Year Start Day</Label>
                <Input
                  id="fiscalYearStartDay"
                  type="number"
                  min="1"
                  max="31"
                  {...form.register('fiscalYearStartDay', { valueAsNumber: true })}
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fiscalYearEndMonth">Fiscal Year End Month</Label>
                <Select
                  value={form.watch('fiscalYearEndMonth')?.toString() || '12'}
                  onValueChange={(value) => form.setValue('fiscalYearEndMonth', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fiscalYearEndDay">Fiscal Year End Day</Label>
                <Input
                  id="fiscalYearEndDay"
                  type="number"
                  min="1"
                  max="31"
                  {...form.register('fiscalYearEndDay', { valueAsNumber: true })}
                  placeholder="31"
                />
              </div>
            </div>

            {fiscalYearStartMonth && fiscalYearEndMonth && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">
                  Fiscal Year: {new Date(2024, (fiscalYearStartMonth || 1) - 1, fiscalYearStartDay || 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {new Date(2024, (fiscalYearEndMonth || 12) - 1, fiscalYearEndDay || 31).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};
