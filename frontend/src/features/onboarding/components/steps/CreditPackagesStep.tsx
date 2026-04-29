import React, { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, CheckCircle2, Sparkles, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { newBusinessData, existingBusinessData } from '../../schemas';
import { UserClassification } from '../FlowSelector';
import { useQuery } from '@tanstack/react-query';
import { creditAPI } from '@/lib/api';

interface CreditPackagesStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  userClassification?: UserClassification;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  validityMonths: number;
  features: string[];
  recommended?: boolean;
  description?: string;
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4, transition: { duration: 0.2 } }
};

export const CreditPackagesStep: React.FC<CreditPackagesStepProps> = ({ form }) => {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  // Default packages to show if API fails
  const defaultPackages: CreditPackage[] = [
    {
      id: 'starter',
      name: 'Starter',
      credits: 1000,
      price: 0,
      currency: 'USD',
      validityMonths: 12,
      features: ['1,000 credits included', '100 free credits every month', 'Basic operations support'],
      recommended: false,
      description: 'Perfect for small teams getting started'
    },
    {
      id: 'professional',
      name: 'Professional',
      credits: 5000,
      price: 99,
      currency: 'USD',
      validityMonths: 12,
      features: ['5,000 credits included', '500 free credits every month', 'Priority support', 'Advanced reporting'],
      recommended: true,
      description: 'Ideal for growing teams with regular operations'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      credits: 15000,
      price: 249,
      currency: 'USD',
      validityMonths: 12,
      features: ['15,000 credits included', '1,500 free credits every month', 'Full operations support', 'Custom integrations'],
      recommended: false,
      description: 'For large organizations with high-volume operations'
    }
  ];

  // Fetch available credit packages
  const {
    data: packagesData,
    isLoading: packagesLoading,
    error: packagesError
  } = useQuery({
    queryKey: ['credit', 'packages', 'onboarding'],
    queryFn: async () => {
      try {
        const response = await creditAPI.getAvailablePackages();
        return response.data.data || defaultPackages;
      } catch (error) {
        console.error('Error fetching packages:', error);
        // Return default packages if API fails
        return defaultPackages;
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1 // Only retry once
  });

  const packages: CreditPackage[] = packagesData || [];

  useEffect(() => {
    const currentSelection = form.getValues('selectedCreditPackage');
    if (currentSelection) {
      setSelectedPackage(currentSelection);
    }
  }, [form]);

  const handlePackageSelect = (packageId: string) => {
    setSelectedPackage(packageId);
    form.setValue('selectedCreditPackage', packageId, { shouldValidate: false });
  };

  const calculateUnitPrice = (credits: number, price: number) => {
    if (credits === 0) return '0.0000';
    return (price / credits).toFixed(4);
  };

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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Coins className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1B2E5A]">Credit Packages</h2>
            <p className="text-slate-600 text-sm">Choose a credit package that fits your needs (optional)</p>
          </div>
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div variants={fadeInUp}>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900">
                  Understanding Credits
                </p>
                <p className="text-sm text-amber-700">
                  Credits power your operations. Each action consumes credits based on complexity. You'll receive 1,000 free credits to start, and can purchase more anytime. Selection is optional - you can choose later.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Packages Grid */}
      <motion.div variants={fadeInUp} className="space-y-4">
        {packagesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : packagesError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-700">
                Unable to load packages. You can select a package later from the billing page.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages.map((pkg, index) => (
              <motion.div
                key={pkg.id}
                variants={cardHover}
                initial="rest"
                whileHover="hover"
                animate="rest"
                custom={index}
              >
                <Card
                  className={`relative cursor-pointer transition-all duration-300 ${
                    selectedPackage === pkg.id
                      ? 'ring-2 ring-amber-500 bg-amber-50/50 shadow-lg'
                      : 'hover:shadow-md border-slate-200'
                  }`}
                  onClick={() => handlePackageSelect(pkg.id)}
                >
                  {pkg.recommended && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                      <Badge className="bg-green-500 text-white px-3 py-1 text-xs font-semibold">
                        RECOMMENDED
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-4 pt-6">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Coins className="h-5 w-5 text-amber-500" />
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    </div>
                    <div className="space-y-1">
                      <div className="text-3xl font-bold text-[#1B2E5A]">
                        {pkg.price === 0 ? 'Free' : `$${pkg.price}`}
                        {pkg.price > 0 && (
                          <span className="text-sm font-normal text-slate-500">/{pkg.currency}</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600">
                        {pkg.credits.toLocaleString()} credits
                      </div>
                    </div>
                    {pkg.description && (
                      <CardDescription className="text-center mt-2">
                        {pkg.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {pkg.features && pkg.features.length > 0 && (
                        <ul className="space-y-2">
                          {pkg.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {pkg.price > 0 && (
                      <div className="pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-500 text-center">
                          ${calculateUnitPrice(pkg.credits, pkg.price)} per credit
                        </p>
                      </div>
                    )}

                    {selectedPackage === pkg.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="pt-2"
                      >
                        <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Selected</span>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Free Credits Info */}
      <motion.div variants={fadeInUp} className="mt-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-900">
                  Free Credits Included
                </p>
                <p className="text-sm text-green-700">
                  All new accounts receive <strong>1,000 free credits</strong> to get started. These credits are valid until your subscription plan expires and can be used for any operation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Note */}
      <motion.div variants={fadeInUp} className="text-center">
        <p className="text-xs text-slate-500">
          You can change your package selection anytime from the Billing page after onboarding.
        </p>
      </motion.div>
    </motion.div>
  );
};
