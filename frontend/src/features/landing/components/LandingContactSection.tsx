import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { toast } from 'sonner'
import { LandingScrollReveal } from '@/features/landing/components/LandingScrollReveal'
import { LandingSectionIntro } from '@/features/landing/components/LandingSectionIntro'

export type ContactFormState = {
  name: string
  email: string
  company: string
  phone: string
  jobTitle: string
  companySize: string
  preferredTime: string
  comments: string
}

type LandingContactSectionProps = {
  contactForm: ContactFormState
  setContactForm: React.Dispatch<React.SetStateAction<ContactFormState>>
  isSubmitting: boolean
  setIsSubmitting: (value: boolean) => void
}

const inputClass = 'landing-input h-10 px-3'
const textareaClass = 'landing-input min-h-[7.5rem] resize-none px-3 py-2.5'

export function LandingContactSection({
  contactForm,
  setContactForm,
  isSubmitting,
  setIsSubmitting,
}: LandingContactSectionProps) {
  return (
    <section
      id="contact"
      className="landing-section border-border bg-background border-b py-20 sm:py-24"
    >
      <div className="landing-section-inner">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <LandingScrollReveal className="lg:col-span-4 lg:pt-1">
            <LandingSectionIntro
              eyebrow="Sales"
              title="Talk to sales"
              lead="We reply within one business day. Hyderabad office, Mon–Fri 9–6 IST."
              className="max-w-xs"
              animate={false}
            />
            <dl className="mt-8 space-y-4 text-sm">
              <div>
                <dt className="landing-mono text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Email
                </dt>
                <dd className="mt-1">
                  <a
                    href="mailto:sales@zopkit.com"
                    className="text-foreground hover:text-primary transition-colors"
                  >
                    sales@zopkit.com
                  </a>
                </dd>
              </div>
              <div>
                <dt className="landing-mono text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Phone
                </dt>
                <dd className="mt-1">
                  <a
                    href="tel:+918971055515"
                    className="text-foreground hover:text-primary transition-colors"
                  >
                    +91 89710 55515
                  </a>
                </dd>
              </div>
              <div>
                <dt className="landing-mono text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Office
                </dt>
                <dd className="text-foreground mt-1">
                  Hi-Tech City, Hyderabad
                </dd>
              </div>
            </dl>
          </LandingScrollReveal>

          <LandingScrollReveal
            className="landing-contact-form grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:col-span-8"
            delay={0.08}
          >
            <form
              className="contents"
              onSubmit={async (e) => {
                e.preventDefault()
                setIsSubmitting(true)
                try {
                  const response = await api.post(
                    '/contact/submit',
                    contactForm
                  )
                  if (response.data.success) {
                    toast.success(
                      "Thanks. We'll be in touch within one business day."
                    )
                    setContactForm({
                      name: '',
                      email: '',
                      company: '',
                      phone: '',
                      jobTitle: '',
                      companySize: '',
                      preferredTime: '',
                      comments: '',
                    })
                  } else {
                    throw new Error(response.data.message || 'Failed to submit')
                  }
                } catch (error: unknown) {
                  const message =
                    error &&
                    typeof error === 'object' &&
                    'response' in error &&
                    error.response &&
                    typeof error.response === 'object' &&
                    'data' in error.response &&
                    error.response.data &&
                    typeof error.response.data === 'object' &&
                    'message' in error.response.data &&
                    typeof error.response.data.message === 'string'
                      ? error.response.data.message
                      : 'Something went wrong. Please try again.'
                  toast.error(message)
                } finally {
                  setIsSubmitting(false)
                }
              }}
            >
              <div className="space-y-1.5 sm:col-span-1">
                <label
                  htmlFor="c-name"
                  className="text-foreground text-sm font-medium"
                >
                  Name
                </label>
                <input
                  id="c-name"
                  required
                  value={contactForm.name}
                  onChange={(e) =>
                    setContactForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Priya Mehta"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <label
                  htmlFor="c-email"
                  className="text-foreground text-sm font-medium"
                >
                  Work email
                </label>
                <input
                  id="c-email"
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={(e) =>
                    setContactForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="priya@company.com"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <label
                  htmlFor="c-company"
                  className="text-foreground text-sm font-medium"
                >
                  Company
                </label>
                <input
                  id="c-company"
                  required
                  value={contactForm.company}
                  onChange={(e) =>
                    setContactForm((p) => ({ ...p, company: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Northline Logistics"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <label
                  htmlFor="c-size"
                  className="text-foreground text-sm font-medium"
                >
                  Team size
                </label>
                <select
                  id="c-size"
                  value={contactForm.companySize}
                  onChange={(e) =>
                    setContactForm((p) => ({
                      ...p,
                      companySize: e.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">Select</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="500+">500+</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="c-msg"
                  className="text-foreground text-sm font-medium"
                >
                  Message
                </label>
                <textarea
                  id="c-msg"
                  rows={4}
                  value={contactForm.comments}
                  onChange={(e) =>
                    setContactForm((p) => ({ ...p, comments: e.target.value }))
                  }
                  className={textareaClass}
                  placeholder="What should connect first in your stack?"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 sm:col-span-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="landing-btn-primary landing-cta h-10 rounded-full px-6 font-medium"
                >
                  {isSubmitting ? 'Sending...' : 'Send message'}
                </Button>
                <p className="landing-mono text-muted-foreground text-xs">
                  Typical reply within 1 business day
                </p>
              </div>
            </form>
          </LandingScrollReveal>
        </div>
      </div>
    </section>
  )
}
