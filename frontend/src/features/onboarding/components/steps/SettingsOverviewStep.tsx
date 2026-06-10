import React, { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  Building2,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Languages,
  Palette,
  Settings2,
  ArrowRight,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { newBusinessData, existingBusinessData } from '../../schemas';
import { UserClassification } from '../FlowSelector';

interface SettingsOverviewStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  userClassification?: UserClassification;
}

const settingsSections = [
  {
    id: 'company',
    name: 'Company Information',
    icon: Building2,
    description: 'Update company details, legal name, and branding',
    color: 'bg-blue-500',
    features: ['Company name and type', 'Legal registration details', 'Company logo and branding']
  },
  {
    id: 'contact',
    name: 'Contact Details',
    icon: Mail,
    description: 'Manage contact information and communication preferences',
    color: 'bg-indigo-500',
    features: ['Billing and support emails', 'Phone numbers', 'Contact preferences']
  },
  {
    id: 'mailing',
    name: 'Mailing Address',
    icon: MapPin,
    description: 'Configure mailing and shipping addresses',
    color: 'bg-purple-500',
    features: ['Mailing address', 'Shipping preferences', 'Address validation']
  },
  {
    id: 'banking',
    name: 'Banking & Financial',
    icon: CreditCard,
    description: 'Set up payment methods and banking information',
    color: 'bg-green-500',
    features: ['Bank account details', 'Payment methods', 'Credit limits']
  },
  {
    id: 'tax',
    name: 'Tax & Compliance',
    icon: FileText,
    description: 'Manage tax registration and compliance settings',
    color: 'bg-orange-500',
    features: ['Tax IDs (PAN, EIN, VAT)', 'Tax exemption status', 'Compliance certificates']
  },
  {
    id: 'localization',
    name: 'Localization',
    icon: Languages,
    description: 'Configure language, currency, and regional settings',
    color: 'bg-pink-500',
    features: ['Language and locale', 'Currency preferences', 'Timezone settings']
  },
  {
    id: 'branding',
    name: 'Branding',
    icon: Palette,
    description: 'Customize your workspace appearance',
    color: 'bg-rose-500',
    features: ['Theme preferences', 'Logo customization', 'Color schemes']
  }
];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -2, transition: { duration: 0.2 } }
};

export const SettingsOverviewStep: React.FC<SettingsOverviewStepProps> = ({ form }) => {
  useEffect(() => {
    form.setValue('settingsOverviewViewed', true, { shouldValidate: false });
  }, [form]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg">
            <Settings2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-primary">Settings Overview</h2>
            <p className="text-slate-600 text-sm">Explore what you can configure after onboarding</p>
          </div>
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div variants={fadeInUp}>
        <Card className="border-slate-200 bg-slate-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">
                  Configure After Onboarding
                </p>
                <p className="text-sm text-slate-700">
                  These settings are available in your dashboard after onboarding. You can update company details, payment methods, tax information, and more at any time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Settings Sections Grid */}
      <motion.div variants={fadeInUp} className="space-y-4">
        <h3 className="text-lg font-semibold text-primary">Available Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settingsSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                variants={cardHover}
                initial="rest"
                whileHover="hover"
                animate="rest"
                custom={index}
              >
                <Card className="hover:shadow-md transition-all duration-300 border-l-4 border-l-slate-300 group">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg ${section.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-primary mb-1">{section.name}</h4>
                        <p className="text-sm text-slate-600 mb-3">{section.description}</p>
                        <ul className="space-y-1.5">
                          {section.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                              <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <ArrowRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Quick Access Info */}
      <motion.div variants={fadeInUp} className="mt-6">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Settings2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">
                  Easy Access After Onboarding
                </p>
                <p className="text-sm text-blue-700">
                  All these settings are accessible from the <strong>Settings</strong> page in your dashboard. You can update them anytime to reflect changes in your business.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Note */}
      <motion.div variants={fadeInUp} className="text-center pt-2">
        <p className="text-xs text-slate-500">
          Settings are pre-configured with the information you provide during onboarding. You can modify them anytime.
        </p>
      </motion.div>
    </motion.div>
  );
};
