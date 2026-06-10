import React from 'react';
import { Link } from '@tanstack/react-router';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { motion, Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Building2,
  User,
  FileText,
  CheckCircle,
  Edit2,
  Globe,
  Briefcase,
  MapPin,
  Mail,
  Phone,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { newBusinessData, existingBusinessData, COUNTRIES, ORGANIZATION_SIZES, COMPANY_TYPES, STATES } from '../../schemas';
import { UserClassification } from '../FlowSelector';

interface ReviewStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  onEditStep?: (stepNumber: number) => void;
  userClassification?: UserClassification;
}

const fadeIn: Variants = {
  hidden: { y: 20 },
  visible: (i: number) => ({
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: "easeOut"
    }
  })
};

const DetailRow = ({ label, value, icon: Icon }: { label: string; value: string | React.ReactNode; icon?: React.ComponentType<any> }) => (
  <div className="flex items-start gap-3 group/row p-2 rounded-lg hover:bg-blue-50/60 transition-colors">
    {Icon && (
      <div className="rounded-md bg-blue-50 p-1.5 text-blue-950 transition-colors group-hover/row:bg-blue-100 group-hover/row:text-blue-950">
        <Icon className="h-3.5 w-3.5" />
      </div>
    )}
    <div className="flex-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <div className="text-sm font-semibold text-slate-800 break-words">{value}</div>
    </div>
  </div>
);

interface SectionCardProps {
  title: string;
  icon: any;
  children: React.ReactNode;
  stepNumber?: number;
  index: number;
  onEditStep?: (stepNumber: number) => void;
}

const SectionCard = ({ title, icon: Icon, children, stepNumber, index, onEditStep }: SectionCardProps) => (
  <motion.div
    custom={index}
    initial="hidden"
    animate="visible"
    variants={fadeIn}
    className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_rgba(30,58,138,0.12)]"
  >
    <div className="flex items-center justify-between border-b border-blue-100/60 bg-white/80 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-950 transition-colors duration-300 group-hover:bg-blue-100 group-hover:text-blue-950">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
      </div>
      {!!stepNumber && !!onEditStep && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEditStep(stepNumber)}
          className="translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 hover:bg-blue-50 hover:text-blue-950 text-slate-400"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          <span className="text-xs font-semibold">Edit</span>
        </Button>
      )}
    </div>
    <div className="p-6">
      {children}
    </div>
  </motion.div>
);

// Floating particle component removed since unused
// const FloatingParticle = ...

export const ReviewStep: React.FC<ReviewStepProps> = ({ form, onEditStep }) => {
  // FIXED: Use useWatch to reactively get form values so data updates when restored
  const values = useWatch({ control: form.control }) || form.getValues();

  // Helper functions
  const getCountryName = (code?: string) => COUNTRIES.find(c => c.id === code)?.name || code || 'N/A';
  const getSizeName = (id?: string) => ORGANIZATION_SIZES.find(s => s.id === id)?.name || id || 'N/A';
  const getCompanyTypeName = (id?: string) => COMPANY_TYPES.find(t => t.id === id)?.name || id || 'N/A';
  const getStateName = (code?: string) => STATES.find(s => s.id === code)?.name || code || 'N/A';

  return (
    <div className="pb-20 relative">
      {/* Main Grid Content - Review summary only; welcome/credits screen shows after submit */}
      <div className="relative z-20 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Step 1: Business Details */}
          <SectionCard 
            title="Business Details" 
            icon={Building2} 
            stepNumber={1} 
            index={1} 
            onEditStep={onEditStep}
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                <DetailRow label="Company Name" value={values.businessDetails?.companyName || values.businessName} icon={Briefcase} />
                <DetailRow label="Company Type" value={getCompanyTypeName(values.companyType)} icon={FileText} />
                <DetailRow label="Organization Size" value={getSizeName(values.businessDetails?.organizationSize || values.organizationSize)} icon={User} />
                <DetailRow label="Country" value={getCountryName(values.businessDetails?.country || values.country)} icon={Globe} />
              </div>
              
              {values.businessDetails?.description && (
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Business Description</p>
                  <p className="text-sm text-slate-600 italic leading-relaxed">"{values.businessDetails.description}"</p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Step 2: Tax & Compliance */}
          <SectionCard 
            title="Tax & Location" 
            icon={ShieldCheck} 
            stepNumber={2} 
            index={2}
            onEditStep={onEditStep}
          >
             <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                 <DetailRow 
                  label="Tax Status" 
                  value={
                    <span className={`inline-flex items-center gap-1.5 ${values.taxRegistered ? 'text-blue-800' : 'text-slate-500'}`}>
                       {values.taxRegistered ? <CheckCircle className="w-3.5 h-3.5" /> : null}
                       {values.taxRegistered ? 'Registered' : 'Not Registered'}
                    </span>
                  } 
                  icon={FileText} 
                />
                {values.vatGstRegistered && values.gstin && <DetailRow label="GSTIN" value={values.gstin} icon={CreditCard} />}
                {values.taxRegistered && values.panNumber && <DetailRow label="PAN Number" value={values.panNumber} icon={CreditCard} />}
                {values.vatGstRegistered && !values.gstin && (
                  <DetailRow label="GST Status" value="GST Registered (GSTIN pending)" icon={ShieldCheck} />
                )}
                
                <div className="sm:col-span-2 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-blue-950" />
                    <span className="text-sm font-semibold text-primary">Billing Address</span>
                  </div>
                  <p className="text-sm text-slate-600 pl-6 leading-relaxed">
                    {values.billingStreet || values.billingAddress || 'N/A'}
                    <br />
                    {[values.billingCity, getStateName(values.billingState || values.state), values.billingZip].filter(v => v && v !== 'N/A').join(', ')}
                    <br />
                    {getCountryName(values.billingCountry || values.businessDetails?.country || values.country)}
                  </p>
                </div>
              </div>
             </div>
          </SectionCard>

          {/* Step 3: Administrator */}
          <SectionCard 
            title="Administrator" 
            icon={User} 
            stepNumber={3} 
            index={3}
            onEditStep={onEditStep}
          >
             <div className="space-y-6">
               <div className="mb-6 flex items-center gap-4 rounded-2xl border border-blue-100/80 bg-gradient-to-r from-blue-50/80 to-white p-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-blue-100 bg-white text-xl font-bold text-blue-950 shadow-sm">
                    {(values.firstName?.[0] || 'A')}{(values.lastName?.[0] || '')}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-primary">{values.firstName} {values.lastName}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                       <Briefcase className="w-3.5 h-3.5" />
                       {values.contactJobTitle || 'Administrator'}
                    </div>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                  <DetailRow label="Email" value={values.adminEmail} icon={Mail} />
                  <DetailRow label="Mobile" value={values.adminMobile || values.phone} icon={Phone} />
                  {values.website && <div className="sm:col-span-2"><DetailRow label="Website" value={values.website} icon={Globe} /></div>}
               </div>
             </div>
          </SectionCard>

          {/* Localization (Auto) */}
          <SectionCard 
            title="Settings" 
            icon={Globe} 
            index={4} 
            stepNumber={0}
            onEditStep={onEditStep}
          >
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center hover:bg-slate-100 transition-colors">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Currency</span>
                  <span className="font-bold text-slate-700">{values.defaultCurrency || 'USD'}</span>
               </div>
               <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center hover:bg-slate-100 transition-colors">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Language</span>
                  <span className="font-bold text-slate-700">{values.defaultLanguage || 'English'}</span>
               </div>
               <div className="col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center hover:bg-slate-100 transition-colors">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Timezone</span>
                  <span className="font-bold text-slate-700">{values.defaultTimeZone || 'UTC'}</span>
               </div>
            </div>
          </SectionCard>

        </div>

        {/* Footer / Terms */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-10 mt-12"
        >
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-xl shadow-blue-950/[0.06] backdrop-blur-xl">
            <FormField
              control={form.control}
              name={"termsAccepted" as any}
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-4 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      className="mt-1 h-6 w-6 rounded-lg border-2 border-blue-200 transition-all duration-200 data-[state=checked]:border-blue-950 data-[state=checked]:bg-blue-950"
                    />
                  </FormControl>
                  <div className="space-y-2 leading-none flex-1">
                    <FormLabel className="cursor-pointer text-base font-bold text-primary transition-colors hover:text-blue-950">
                      I accept the Terms and Conditions
                    </FormLabel>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      By checking this box, you confirm that all provided information is accurate and you agree to our{' '}
                      <Link
                        to="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-blue-900 underline-offset-2 decoration-2 transition-all hover:text-blue-950 hover:underline"
                      >
                        Terms and Conditions
                      </Link>
                      {' '}and{' '}
                      <Link
                        to="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-blue-900 underline-offset-2 decoration-2 transition-all hover:text-blue-950 hover:underline"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      <Link
                        to="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-blue-900 underline-offset-2 decoration-2 transition-all hover:text-blue-950 hover:underline"
                      >
                        Read our full Terms and Conditions
                      </Link>
                    </p>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 px-3 py-1.5 rounded-full">
                <ShieldCheck className="h-4 w-4 text-blue-800" />
                Secure 256-bit SSL Encrypted
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};