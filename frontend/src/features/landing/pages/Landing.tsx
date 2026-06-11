import React, { useState, useEffect } from 'react'

import { PetpoojaHeroSection } from '@/features/landing/components/PetpoojaHeroSection'

import { LandingWorkflowBlock } from '@/features/landing/components/LandingWorkflowBlock'

import { LandingIndustriesGrid } from '@/features/landing/components/LandingIndustriesGrid'

import { LandingContactSection } from '@/features/landing/components/LandingContactSection'

import type { ContactFormState } from '@/features/landing/components/LandingContactSection'

import { LandingResourcesSection } from '@/features/landing/components/LandingResourcesSection'

import { LandingClosingCta } from '@/features/landing/components/LandingClosingCta'

import { toast } from 'sonner'

import { consumeSessionRecoveryReason } from '@/lib/auth/session-recovery'

import { LandingFooter } from '@/components/layout/LandingFooter'

import { MarketingNavbar } from '@/components/layout/MarketingNavbar'

import { MarketingPageShell } from '@/components/layout/MarketingPageShell'

import { useLandingSectionScroll } from '@/features/landing/useLandingSectionScroll'

const Landing: React.FC = () => {
  const [contactForm, setContactForm] = useState<ContactFormState>({
    name: '',

    email: '',

    company: '',

    phone: '',

    jobTitle: '',

    companySize: '',

    preferredTime: '',

    comments: '',
  })

  const [isSubmittingContact, setIsSubmittingContact] = useState(false)

  const { scrollToContact } = useLandingSectionScroll()

  useEffect(() => {
    const recoveryReason = consumeSessionRecoveryReason()

    if (
      recoveryReason === 'invalid_grant' ||
      recoveryReason === 'session_expired'
    ) {
      toast.error('Your session has expired. Please sign in again.', {
        id: 'session-expired',

        duration: 6000,

        position: 'top-center',
      })
    }
  }, [])

  return (
    <MarketingPageShell>
      <MarketingNavbar minimal onBookDemo={scrollToContact} />

      <main className="landing-page-main">
        <PetpoojaHeroSection onBookDemo={scrollToContact} />

        <LandingWorkflowBlock />

        <LandingIndustriesGrid />

        <LandingResourcesSection />

        <LandingContactSection
          contactForm={contactForm}
          setContactForm={setContactForm}
          isSubmitting={isSubmittingContact}
          setIsSubmitting={setIsSubmittingContact}
        />

        <LandingClosingCta onBookDemo={scrollToContact} />
      </main>

      <LandingFooter marketing />
    </MarketingPageShell>
  )
}

export default Landing
