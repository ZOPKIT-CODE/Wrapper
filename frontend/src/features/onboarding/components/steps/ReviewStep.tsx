import React, { useEffect, useState } from 'react';
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
import { newBusinessData, existingBusinessData, COUNTRIES, ORGANIZATION_SIZES, COMPANY_TYPES } from '../../schemas';
import { UserClassification } from '../FlowSelector';
// Note: Make sure canvas-confetti is installed: npm install canvas-confetti
import confetti from 'canvas-confetti';

interface ReviewStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  onEditStep?: (stepNumber: number) => void;
  userClassification?: UserClassification;
}

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut"
    }
  })
};

const DetailRow = ({ label, value, icon: Icon }: { label: string; value: string | React.ReactNode; icon?: React.ComponentType<any> }) => (
  <div className="flex items-start gap-3 group/row p-2 rounded-lg hover:bg-pink-50/50 transition-colors">
    {Icon && <div className="p-1.5 bg-pink-50 text-pink-500 rounded-md group-hover/row:bg-pink-100 group-hover/row:text-pink-600 transition-colors"><Icon className="w-3.5 h-3.5" /></div>}
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
    className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden hover:shadow-[0_8px_30px_rgb(236,72,153,0.1)] hover:-translate-y-1 transition-all duration-300 group"
  >
    <div className="px-6 py-4 border-b border-pink-50/50 flex items-center justify-between bg-white/50">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-500 group-hover:bg-pink-100 group-hover:text-pink-600 transition-colors duration-300`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
      </div>
      {stepNumber && onEditStep && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEditStep(stepNumber)}
          className="text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
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

export const ReviewStep: React.FC<ReviewStepProps> = ({ form, onEditStep, userClassification }) => {
  // FIXED: Use useWatch to reactively get form values so data updates when restored
  const values = useWatch({ control: form.control }) || form.getValues();
  const [hasBlastedConfetti, setHasBlastedConfetti] = useState(false);

  // Fire confetti 3 times with different colors when entering the last step
  useEffect(() => {
    const fireConfetti = (colors: string[], delay: number) => {
      setTimeout(() => {
        const count = 200;
        const defaults = {
          origin: { y: 0.7 },
          zIndex: 9999,
          colors: colors
        };

        function fire(particleRatio: number, opts: any) {
          if (confetti && typeof confetti === 'function') {
            confetti(Object.assign({}, defaults, opts, {
              particleCount: Math.floor(count * particleRatio)
            }));
          }
        }

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
      }, delay);
    };

    // Blast 1: Pink/Purple theme
    fireConfetti(['#ec4899', '#d946ef', '#a855f7', '#fb7185'], 500);
    
    // Blast 2: Yellow/Gold theme
    fireConfetti(['#FFD700', '#FFA500', '#FFC107', '#FFEB3B'], 1500);
    
    // Blast 3: Blue/Cyan theme
    fireConfetti(['#3b82f6', '#06b6d4', '#8b5cf6', '#6366f1'], 2500);
  }, []);

  // Fire confetti when terms are accepted (only once - single blast)
  useEffect(() => {
    if (values.termsAccepted && !hasBlastedConfetti) {
      const fireConfetti = () => {
        const count = 200;
        const defaults = {
          origin: { y: 0.7 },
          zIndex: 9999,
          colors: ['#ec4899', '#d946ef', '#a855f7', '#fb7185'] // Pink/Purple theme colors
        };

        function fire(particleRatio: number, opts: any) {
          if (confetti && typeof confetti === 'function') {
            confetti(Object.assign({}, defaults, opts, {
              particleCount: Math.floor(count * particleRatio)
            }));
          }
        }

        // Single blast for terms acceptance
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      };

      fireConfetti();
      setHasBlastedConfetti(true);
    }
  }, [values.termsAccepted, hasBlastedConfetti]);

  // Helper functions
  const getCountryName = (code?: string) => COUNTRIES.find(c => c.id === code)?.name || code || 'N/A';
  const getSizeName = (id?: string) => ORGANIZATION_SIZES.find(s => s.id === id)?.name || id || 'N/A';
  const getCompanyTypeName = (id?: string) => COMPANY_TYPES.find(t => t.id === id)?.name || id || 'N/A';

  return (
    <div className="min-h-screen pb-20 relative">
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
                    <span className={`inline-flex items-center gap-1.5 ${values.taxRegistered ? 'text-emerald-600' : 'text-slate-500'}`}>
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
                    <MapPin className="w-4 h-4 text-pink-500" />
                    <span className="text-sm font-semibold text-[#1B2E5A]">Billing Address</span>
                  </div>
                  <p className="text-sm text-slate-600 pl-6 leading-relaxed">
                    {values.billingStreet || values.billingAddress || 'N/A'}
                    <br />
                    {[values.billingCity, values.billingState || values.state, values.billingZip].filter(Boolean).join(', ')}
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
               <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-pink-50 to-white rounded-2xl border border-pink-50 mb-6">
                  <div className="w-14 h-14 rounded-full bg-white border-4 border-pink-50 flex items-center justify-center text-pink-600 text-xl font-bold shadow-sm">
                    {(values.firstName?.[0] || 'A')}{(values.lastName?.[0] || '')}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#1B2E5A]">{values.firstName} {values.lastName}</p>
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-12 mb-10"
        >
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-pink-100/50 p-8 border border-white max-w-3xl mx-auto">
            <FormField
              control={form.control}
              name={"termsAccepted" as any}
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-4 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      className="mt-1 w-6 h-6 border-2 border-pink-200 data-[state=checked]:bg-pink-600 data-[state=checked]:border-pink-600 rounded-lg transition-all duration-200"
                    />
                  </FormControl>
                  <div className="space-y-2 leading-none flex-1">
                    <FormLabel className="text-base font-bold text-[#1B2E5A] cursor-pointer hover:text-pink-700 transition-colors">
                      I accept the Terms and Conditions
                    </FormLabel>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      By checking this box, you confirm that all provided information is accurate and you agree to our{' '}
                      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-pink-600 font-semibold hover:underline decoration-2 underline-offset-2 transition-all">
                        Terms and Conditions
                      </Link>
                      {' '}and{' '}
                      <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-pink-600 font-semibold hover:underline decoration-2 underline-offset-2 transition-all">
                        Privacy Policy
                      </Link>.
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-pink-600 font-medium hover:underline decoration-2 underline-offset-2 inline-flex items-center gap-1">
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
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Secure 256-bit SSL Encrypted
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};