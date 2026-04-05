import React from 'react';
import { LegalPageLayout } from '@/components/layout/LegalPageLayout';
import { PublicPricingSection } from '@/features/landing/components/PublicPricingSection';

const Pricing: React.FC = () => (
  <LegalPageLayout title="Pricing" wide contained={false} hideStartTrialCta>
    <PublicPricingSection variant="page" />
  </LegalPageLayout>
);

export default Pricing;
