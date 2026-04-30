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
      <Card style={{ border: '1px solid var(--zk-line)' }}>
        <CardHeader>
          <CardTitle
            style={{
              fontFamily: 'var(--zk-display)',
              letterSpacing: '-0.025em',
              color: 'var(--zk-ink)',
            }}
          >
            Localization & Regional Settings
          </CardTitle>
          <CardDescription
            style={{
              fontFamily: 'var(--zk-font)',
              color: 'var(--zk-muted)',
              fontSize: 13,
            }}
          >
            Configure language, currency, timezone, and fiscal year settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="defaultLanguage"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--zk-muted)',
                  fontFamily: 'var(--zk-font)',
                }}
              >
                Default Language
              </Label>
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
              <Label
                htmlFor="defaultLocale"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--zk-muted)',
                  fontFamily: 'var(--zk-font)',
                }}
              >
                Default Locale
              </Label>
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
              <Label
                htmlFor="defaultCurrency"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--zk-muted)',
                  fontFamily: 'var(--zk-font)',
                }}
              >
                Default Currency
              </Label>
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
              <Label
                htmlFor="defaultTimeZone"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--zk-muted)',
                  fontFamily: 'var(--zk-font)',
                }}
              >
                Default Timezone
              </Label>
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

          <Separator style={{ borderColor: 'var(--zk-line)' }} />

          <div className="space-y-4">
            <h3
              className="flex items-center gap-2"
              style={{
                fontSize: 14,
                fontFamily: 'var(--zk-display)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--zk-ink)',
              }}
            >
              <Calendar className="h-5 w-5" />
              Fiscal Year Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label
                  htmlFor="fiscalYearStartMonth"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Fiscal Year Start Month
                </Label>
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
                <Label
                  htmlFor="fiscalYearStartDay"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Fiscal Year Start Day
                </Label>
                <Input
                  id="fiscalYearStartDay"
                  type="number"
                  min="1"
                  max="31"
                  {...form.register('fiscalYearStartDay', { valueAsNumber: true })}
                  placeholder="1"
                  style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="fiscalYearEndMonth"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Fiscal Year End Month
                </Label>
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
                <Label
                  htmlFor="fiscalYearEndDay"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--zk-muted)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  Fiscal Year End Day
                </Label>
                <Input
                  id="fiscalYearEndDay"
                  type="number"
                  min="1"
                  max="31"
                  {...form.register('fiscalYearEndDay', { valueAsNumber: true })}
                  placeholder="31"
                  style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
                />
              </div>
            </div>

            {fiscalYearStartMonth && fiscalYearEndMonth && (
              <div
                className="p-4 rounded-lg"
                style={{ background: 'var(--zk-bg-2)' }}
              >
                <p
                  style={{
                    fontSize: 13,
                    fontFamily: 'var(--zk-font)',
                    fontWeight: 500,
                    color: 'var(--zk-ink)',
                  }}
                >
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
