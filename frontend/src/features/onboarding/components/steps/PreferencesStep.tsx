import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UseFormReturn } from 'react-hook-form';
import { newBusinessData, existingBusinessData, LANGUAGES, LOCALES, CURRENCIES, TIMEZONES } from '../../schemas';
import { Badge } from '@/components/ui/badge';
import { UserClassification } from '../FlowSelector';
import { Globe, Clock, DollarSign, Languages } from 'lucide-react';

interface PreferencesStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  userClassification?: UserClassification;
}

export const PreferencesStep = ({ form, userClassification }: PreferencesStepProps) => {
  const getPersonalizedContent = () => {
    switch (userClassification) {
      case 'aspiringFounder':
        return {
          title: 'Localization Preferences',
          description: 'Configure your language, currency, and timezone preferences.',
        };
      case 'enterprise':
        return {
          title: 'Enterprise Localization',
          description: 'Set up system-wide localization settings for your organization.',
        };
      default:
        return {
          title: 'Preferences',
          description: 'Configure your language, currency, and timezone preferences.',
        };
    }
  };

  const personalizedContent = getPersonalizedContent();
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

      <div className="space-y-6 max-w-2xl glass-card p-6 sm:p-8 rounded-2xl shadow-soft">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name={"defaultLanguage" as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClasses}>
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-slate-400" />
                    Language <span className="text-red-500">*</span>
                  </div>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className={inputClasses}>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg bg-white">
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.id} value={lang.id} className="py-3 cursor-pointer focus:bg-blue-50">
                        {lang.name}
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
            name={"defaultLocale" as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClasses}>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    Locale <span className="text-red-500">*</span>
                  </div>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className={inputClasses}>
                      <SelectValue placeholder="Select locale" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg bg-white">
                    {LOCALES.map((locale) => (
                      <SelectItem key={locale.id} value={locale.id} className="py-3 cursor-pointer focus:bg-blue-50">
                        {locale.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name={"defaultCurrency" as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClasses}>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    Currency <span className="text-red-500">*</span>
                  </div>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className={inputClasses}>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg bg-white">
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr.id} value={curr.id} className="py-3 cursor-pointer focus:bg-blue-50">
                        {curr.name}
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
            name={"defaultTimeZone" as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClasses}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Timezone <span className="text-red-500">*</span>
                  </div>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className={inputClasses}>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg bg-white max-h-[300px]">
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.id} value={tz.id} className="py-3 cursor-pointer focus:bg-blue-50">
                        {tz.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h4 className="font-semibold text-blue-900 mb-2 text-sm">Why These Settings Matter</h4>
          <div className="space-y-1.5">
            {['Accurate date/time displays', 'Correct currency formatting', 'Localized content', 'Timezone-aware scheduling'].map((benefit, i) => (
              <div key={i} className="flex items-center text-sm text-blue-700">
                <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center mr-2">
                  <div className="w-1.5 h-1.5 bg-[#1B2E5A] rounded-full"></div>
                </div>
                {benefit}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

