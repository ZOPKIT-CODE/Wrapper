import React, { useEffect } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { motion } from 'framer-motion'
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
  Info,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { newBusinessData, existingBusinessData } from '../../schemas'
import { UserClassification } from '../FlowSelector'

interface SettingsOverviewStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>
  userClassification?: UserClassification
}

const settingsSections = [
  {
    id: 'company',
    name: 'Company Information',
    icon: Building2,
    description: 'Update company details, legal name, and branding',
    color: 'bg-blue-500',
    features: [
      'Company name and type',
      'Legal registration details',
      'Company logo and branding',
    ],
  },
  {
    id: 'contact',
    name: 'Contact Details',
    icon: Mail,
    description: 'Manage contact information and communication preferences',
    color: 'bg-indigo-500',
    features: [
      'Billing and support emails',
      'Phone numbers',
      'Contact preferences',
    ],
  },
  {
    id: 'mailing',
    name: 'Mailing Address',
    icon: MapPin,
    description: 'Configure mailing and shipping addresses',
    color: 'bg-purple-500',
    features: ['Mailing address', 'Shipping preferences', 'Address validation'],
  },
  {
    id: 'banking',
    name: 'Banking & Financial',
    icon: CreditCard,
    description: 'Set up payment methods and banking information',
    color: 'bg-green-500',
    features: ['Bank account details', 'Payment methods', 'Credit limits'],
  },
  {
    id: 'tax',
    name: 'Tax & Compliance',
    icon: FileText,
    description: 'Manage tax registration and compliance settings',
    color: 'bg-orange-500',
    features: [
      'Tax IDs (PAN, EIN, VAT)',
      'Tax exemption status',
      'Compliance certificates',
    ],
  },
  {
    id: 'localization',
    name: 'Localization',
    icon: Languages,
    description: 'Configure language, currency, and regional settings',
    color: 'bg-pink-500',
    features: [
      'Language and locale',
      'Currency preferences',
      'Timezone settings',
    ],
  },
  {
    id: 'branding',
    name: 'Branding',
    icon: Palette,
    description: 'Customize your workspace appearance',
    color: 'bg-rose-500',
    features: ['Theme preferences', 'Logo customization', 'Color schemes'],
  },
]

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -2, transition: { duration: 0.2 } },
}

export const SettingsOverviewStep: React.FC<SettingsOverviewStepProps> = ({
  form,
}) => {
  useEffect(() => {
    form.setValue('settingsOverviewViewed', true, { shouldValidate: false })
  }, [form])

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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 shadow-lg">
            <Settings2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-primary text-2xl font-bold">
              Settings Overview
            </h2>
            <p className="text-muted-foreground text-sm">
              Explore what you can configure after onboarding
            </p>
          </div>
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div variants={fadeInUp}>
        <Card className="border-border bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-primary text-sm font-medium">
                  Configure After Onboarding
                </p>
                <p className="text-foreground text-sm">
                  These settings are available in your dashboard after
                  onboarding. You can update company details, payment methods,
                  tax information, and more at any time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Settings Sections Grid */}
      <motion.div variants={fadeInUp} className="space-y-4">
        <h3 className="text-primary text-lg font-semibold">
          Available Settings
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {settingsSections.map((section, index) => {
            const Icon = section.icon
            return (
              <motion.div
                key={section.id}
                variants={cardHover}
                initial="rest"
                whileHover="hover"
                animate="rest"
                custom={index}
              >
                <Card className="group border-l-4 border-l-slate-300 transition-all duration-300 hover:shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={`h-12 w-12 rounded-lg ${section.color} flex flex-shrink-0 items-center justify-center shadow-md`}
                      >
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-primary mb-1 font-semibold">
                          {section.name}
                        </h4>
                        <p className="text-muted-foreground mb-3 text-sm">
                          {section.description}
                        </p>
                        <ul className="space-y-1.5">
                          {section.features.map((feature, idx) => (
                            <li
                              key={idx}
                              className="text-muted-foreground flex items-start gap-2 text-xs"
                            >
                              <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-500" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <ArrowRight className="text-muted-foreground mt-1 h-5 w-5 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Quick Access Info */}
      <motion.div variants={fadeInUp} className="mt-6">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Settings2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">
                  Easy Access After Onboarding
                </p>
                <p className="text-sm text-blue-700">
                  All these settings are accessible from the{' '}
                  <strong>Settings</strong> page in your dashboard. You can
                  update them anytime to reflect changes in your business.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Note */}
      <motion.div variants={fadeInUp} className="pt-2 text-center">
        <p className="text-muted-foreground text-xs">
          Settings are pre-configured with the information you provide during
          onboarding. You can modify them anytime.
        </p>
      </motion.div>
    </motion.div>
  )
}
