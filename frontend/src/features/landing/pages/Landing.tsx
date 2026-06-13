import React, { useState, useEffect } from 'react'

import { PetpoojaHeroSection } from '@/features/landing/components/PetpoojaHeroSection'
import { LandingCapabilityRow } from '@/features/landing/components/LandingCapabilityRow'
import { LandingWorkflowBlock } from '@/features/landing/components/LandingWorkflowBlock'
import { LandingIndustriesGrid } from '@/features/landing/components/LandingIndustriesGrid'
import { LandingContactSection } from '@/features/landing/components/LandingContactSection'
import type { ContactFormState } from '@/features/landing/components/LandingContactSection'
import { LandingResourcesSection } from '@/features/landing/components/LandingResourcesSection'
import { LandingTestimonial } from '@/features/landing/components/LandingTestimonial'
import { LandingClosingCta } from '@/features/landing/components/LandingClosingCta'
import { testimonials } from '@/data/content'
import { toast } from 'sonner'
import { consumeSessionRecoveryReason } from '@/lib/auth/session-recovery'
import { LandingFooter } from '@/components/layout/LandingFooter'
import { MarketingNavbar } from '@/components/layout/MarketingNavbar'
import { MarketingPageShell } from '@/components/layout/MarketingPageShell'
import { useLandingSectionScroll } from '@/features/landing/useLandingSectionScroll'

/** Canonical marketing landing at `/`: illustration hero + capability proof + workflow demo. */
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
    document.title = 'Zopkit — CRM, finance, and ops on one workspace'
    const description =
      'Shared identity, records, and billing across CRM, finance, HR, and operations. Book a demo to see the orchestrator on your stack.'

    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name'
      let el = document.querySelector(`meta[${attr}="${name}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    setMeta('description', description)
    setMeta('og:title', 'Zopkit — One shared workspace', true)
    setMeta('og:description', description, true)
    setMeta('og:type', 'website', true)
    setMeta(
      'og:image',
      'https://res.cloudinary.com/dr9vzaa7u/image/upload/v1771698937/Zopkit-full_n7lm0f.png',
      true
    )
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', 'Zopkit — One shared workspace')
    setMeta('twitter:description', description)
  }, [])

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
      <a href="#main-content" className="landing-skip-link">
        Skip to content
      </a>
      <MarketingNavbar minimal onBookDemo={scrollToContact} />

      <main id="main-content" className="landing-page-main">
        <PetpoojaHeroSection onBookDemo={scrollToContact} />
        <LandingCapabilityRow />
        <LandingWorkflowBlock />
        <LandingIndustriesGrid />
        <LandingResourcesSection />
        <LandingTestimonial quotes={testimonials} />
        <LandingContactSection
          contactForm={contactForm}
          setContactForm={setContactForm}
          isSubmitting={isSubmittingContact}
          setIsSubmitting={setIsSubmittingContact}
        />

        <LandingClosingCta />
      </main>

      <LandingFooter marketing />
    </MarketingPageShell>
  )
}

export default Landing
