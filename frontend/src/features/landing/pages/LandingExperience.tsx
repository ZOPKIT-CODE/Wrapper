import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LandingFooter } from '@/components/layout/LandingFooter'
import { MarketingNavbar } from '@/components/layout/MarketingNavbar'
import { LandingContactSection } from '@/features/landing/components/LandingContactSection'
import type { ContactFormState } from '@/features/landing/components/LandingContactSection'
import { ExperienceShell } from '@/features/landing/experience/ExperienceShell'
import { ExperienceHero } from '@/features/landing/experience/ExperienceHero'
import { ExperienceLogos } from '@/features/landing/experience/ExperienceLogos'
import { ExperienceMarquee } from '@/features/landing/experience/ExperienceMarquee'
import { ExperiencePlatform } from '@/features/landing/experience/ExperiencePlatform'
import { ExperienceStack } from '@/features/landing/experience/ExperienceStack'
import { ExperienceProof } from '@/features/landing/experience/ExperienceProof'
import { ExperienceClosing } from '@/features/landing/experience/ExperienceClosing'
import { useLandingSectionScroll } from '@/features/landing/useLandingSectionScroll'
import { testimonials } from '@/data/content'
import { consumeSessionRecoveryReason } from '@/lib/auth/session-recovery'

/** Landing v3 — cinematic GSAP + Three.js variant (archived at /landing/v3). */
export default function LandingExperience() {
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
  const testimonial = testimonials[0]

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
    <ExperienceShell>
      <MarketingNavbar minimal onBookDemo={scrollToContact} />

      <main>
        <ExperienceHero onBookDemo={scrollToContact} />
        <ExperienceLogos />
        <ExperienceMarquee />
        <ExperiencePlatform />
        <ExperienceStack />
        <ExperienceProof testimonial={testimonial} />
        <ExperienceClosing onBookDemo={scrollToContact} />
        <LandingContactSection
          contactForm={contactForm}
          setContactForm={setContactForm}
          isSubmitting={isSubmittingContact}
          setIsSubmitting={setIsSubmittingContact}
        />
      </main>

      <LandingFooter marketing />
    </ExperienceShell>
  )
}
