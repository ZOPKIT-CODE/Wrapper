import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { newBusinessData, existingBusinessData } from '../../schemas';
import { Badge } from '@/components/ui/badge';
import { UserClassification } from '../FlowSelector';

interface PersonalDetailsStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  userClassification?: UserClassification;
}

export const PersonalDetailsStep = ({ form, userClassification }: PersonalDetailsStepProps) => {
  // Get personalized content based on user classification
  const getPersonalizedContent = () => {
    switch (userClassification) {
      case 'aspiringFounder':
        return {
          title: 'Founder Profile',
          description: 'Share your personal information as the company founder.',
          placeholder: 'Tell us about yourself and your entrepreneurial background'
        };
      case 'corporateEmployee':
        return {
          title: 'Professional Profile',
          description: 'Provide your professional information and contact details.',
          placeholder: 'Describe your role and professional experience'
        };
      case 'withDomainMail':
        return {
          title: 'Professional Contact',
          description: 'Enter your business contact details.',
          placeholder: 'Your professional background and contact information'
        };
      case 'freemium':
        return {
          title: 'Personal Information',
          description: 'Basic personal details to get started.',
          placeholder: 'Brief information about yourself'
        };
      case 'enterprise':
        return {
          title: 'Executive Profile',
          description: 'Complete your executive profile for enterprise access.',
          placeholder: 'Your executive background and leadership experience'
        };
      default:
        return {
          title: 'Personal details',
          description: 'Provide your personal information.',
          placeholder: 'Tell us about yourself'
        };
    }
  };

  const personalizedContent = getPersonalizedContent();

  // Determine if phone number is required based on classification
  const isPhoneRequired = userClassification === 'withGST' || userClassification === 'enterprise';

  // Shared Styles
  const inputClasses = "w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-primary placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 hover:border-slate-300 shadow-sm";
  const labelClasses = "block text-sm font-semibold text-slate-700 mb-1.5 ml-1";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-4">
          {userClassification && userClassification !== 'aspiringFounder' && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide">
              {userClassification.replace(/([A-Z])/g, ' $1').trim()}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">
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
            name={"firstName" as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClasses}>
                  First Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className={inputClasses}
                    placeholder="Enter your first name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={"lastName" as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClasses}>
                  Last Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className={inputClasses}
                    placeholder="Enter your last name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name={"email" as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClasses}>
                Email Address <span className="text-red-500">*</span>
                {userClassification === 'withDomainMail' && (
                  <span className="text-xs text-green-600 ml-2 bg-green-50 px-2 py-0.5 rounded-full font-normal">Professional email</span>
                )}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  className={inputClasses}
                  placeholder="Enter your email address"
                />
              </FormControl>
              <FormMessage />
              {userClassification === 'withDomainMail' && (
                <p className="text-xs text-green-600 mt-1.5 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                  Professional domain detected
                </p>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={"phone" as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClasses}>
                Phone Number {isPhoneRequired ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="tel"
                  className={inputClasses}
                  placeholder="Enter your phone number"
                />
              </FormControl>
              <FormMessage />
              {isPhoneRequired && (
                <p className="text-xs text-blue-600 mt-1.5 font-medium">
                  Verification required for your selected plan
                </p>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={"address" as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClasses}>
                Address {userClassification === 'withGST' ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  className={`${inputClasses} min-h-[100px] resize-none`}
                  placeholder={userClassification === 'withGST' ? 'Enter your registered business address' : 'Enter your full address'}
                />
              </FormControl>
              <FormMessage />
              {userClassification === 'withGST' && (
                <p className="text-xs text-blue-600 mt-1.5 font-medium">
                  Business address required for GST registration compliance
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Show professional background for enterprise users */}
        {userClassification === 'enterprise' && (
          <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
            <FormField
              control={form.control}
              name={"background" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClasses}>
                    Professional Background
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      className={`${inputClasses} bg-white`}
                      placeholder="Describe your professional experience and leadership background"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-purple-600 mt-1.5">
                    This helps us customize your enterprise experience
                  </p>
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
};