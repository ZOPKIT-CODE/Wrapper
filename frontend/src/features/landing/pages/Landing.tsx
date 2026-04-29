import React, { Suspense, useState, useEffect } from 'react'
import { PetpoojaHeroSection } from '@/features/landing/components/PetpoojaHeroSection'
import { useNavigate } from '@tanstack/react-router'
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { DynamicIcon } from '@/features/landing/components/Icons'
import { ArrowRight, FileText, GraduationCap, Users, Zap, Mail, Phone, MapPin, LayoutDashboard, Rocket } from 'lucide-react'
import api, { createCancelableRequest } from '@/lib/api'
import toast from 'react-hot-toast'
import { consumeSessionRecoveryReason } from '@/lib/auth/session-recovery'

const WorkflowVisualizer = React.lazy(() =>
  import('@/features/landing/components/WorkflowVisualizer').then(m => ({ default: m.WorkflowVisualizer }))
)
import { getAllIndustries } from '@/data/industryPages'

import { NavbarButton } from "@/components/ui/resizable-navbar"
import { LandingFooter } from "@/components/layout/LandingFooter"
import { MarketingNavbar } from "@/components/layout/MarketingNavbar"

const Landing: React.FC = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useKindeAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [backendAuthenticated, setBackendAuthenticated] = useState<boolean | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  
  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    jobTitle: '',
    companySize: '',
    preferredTime: '',
    comments: ''
  })
  const [isSubmittingContact, setIsSubmittingContact] = useState(false)

  // Scroll to top when landing page loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const recoveryReason = consumeSessionRecoveryReason()
    if (recoveryReason === 'invalid_grant' || recoveryReason === 'session_expired') {
      toast.error('Your session has expired. Please sign in again.', {
        id: 'session-expired',
        duration: 6000,
        position: 'top-center',
      })
    }
  }, [])

  // Check authentication and onboarding status in background
  useEffect(() => {
    const { signal, cancel } = createCancelableRequest()

    const checkAuthenticatedUser = async () => {
      try {
        const response = await api.get('/admin/auth-status', { signal })
        const auth = response.data?.authStatus
        const isBackendAuth = auth?.isAuthenticated === true

        setBackendAuthenticated(isBackendAuth)

        if (isBackendAuth) {
          const hasCompletedOnboarding =
            auth?.onboardingCompleted === true ||
            auth?.needsOnboarding === false

          setOnboardingCompleted(hasCompletedOnboarding)
        } else {
          setOnboardingCompleted(false)
        }
      } catch {
        // Fall back to Kinde state when backend auth status is unavailable
        setBackendAuthenticated(null)
      }
      setAuthChecked(true)
    }

    const timer = setTimeout(checkAuthenticatedUser, 100)
    return () => {
      clearTimeout(timer)
      cancel()
    }
  }, [isAuthenticated])

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      // Get Google connection ID from environment variable for custom auth
      const googleConnectionId = import.meta.env.VITE_KINDE_GOOGLE_CONNECTION_ID
      
      if (!googleConnectionId) {
        console.error('❌ VITE_KINDE_GOOGLE_CONNECTION_ID is not configured')
        // Fallback to standard login if connection ID not configured
        await login()
      } else {
        // Use Kinde custom auth with connection ID
        await login({ connectionId: googleConnectionId })
      }
    } catch (error) {
      console.error('Login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const hasAuthenticatedSession = authChecked && (backendAuthenticated ?? isAuthenticated)

  const getPrimaryCtaConfig = () => {
    if (!authChecked) {
      return {
        label: 'Loading...',
        icon: null as React.ReactNode,
        action: () => undefined,
        disabled: true,
      }
    }

    if (!hasAuthenticatedSession) {
      return {
        label: isLoading ? 'Loading...' : 'Sign In',
        icon: null as React.ReactNode,
        action: handleLogin,
        disabled: isLoading,
      }
    }

    if (onboardingCompleted) {
      return {
        label: 'Go to Workspace',
        icon: <LayoutDashboard className="w-4 h-4 mr-2 inline" />,
        action: () => navigate({ to: '/dashboard/applications' }),
        disabled: false,
      }
    }

    return {
      label: 'Complete onboarding',
      icon: <Rocket className="w-4 h-4 mr-2 inline" />,
      action: () => navigate({ to: '/onboarding' }),
      disabled: false,
    }
  }

  const primaryCta = getPrimaryCtaConfig()

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-teal-100 selection:text-teal-900 font-sans overflow-x-clip lg:overflow-x-visible relative">

      {/* Hero background */}
      <div className="absolute top-0 left-0 right-0 h-[720px] z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Base gradient */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #FAFBFC 0%, #FFFFFF 100%)' }} />
        {/* Single indigo radial wash */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 700px 350px at 50% 0%, rgba(99,102,241,0.05) 0%, transparent 70%)' }} />
        {/* Dot pattern — low opacity, 32px, masked to fade out */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(15,23,42,0.025) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 80%)',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 80%)',
          }}
        />
        {/* Hairline separator just below navbar */}
        <div className="absolute left-0 right-0 h-px" style={{ top: '64px', background: 'linear-gradient(to right, transparent, rgba(148,163,184,0.6), transparent)' }} />
      </div>

      <MarketingNavbar
        desktopRight={
          <NavbarButton
            variant={hasAuthenticatedSession ? 'gradient' : 'primary'}
            onClick={primaryCta.action}
            disabled={primaryCta.disabled}
            as="button"
            className="text-[13px]"
          >
            {primaryCta.icon}
            {primaryCta.label}
          </NavbarButton>
        }
        mobileFooter={
          <NavbarButton
            onClick={() => { primaryCta.action(); }}
            variant={hasAuthenticatedSession ? 'gradient' : 'primary'}
            className="w-full justify-center"
            as="button"
            disabled={primaryCta.disabled}
          >
            {primaryCta.icon}
            {primaryCta.label}
          </NavbarButton>
        }
      />

      {/* Hero */}
      <PetpoojaHeroSection
        onBookDemo={() => {
          const el = document.getElementById('contact')
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        }}
      />

      <section id="workflows" className="py-16 sm:py-20 lg:py-24 bg-white" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
        <Suspense fallback={<div className="min-h-[400px]" />}>
          <WorkflowVisualizer />
        </Suspense>
      </section>

      {/* Industries Section */}
      <section id="industries" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-semibold text-slate-400 tracking-wide mb-3">Industries</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1B2E5A] tracking-[-0.025em]">
              Built for how you work
            </h2>
            <p className="text-slate-500 text-base sm:text-lg max-w-lg mx-auto mt-4 leading-relaxed">
              Tailored solutions for the unique challenges of your industry.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {getAllIndustries().map((industry) => {
              const iconMap: Record<string, string> = {
                'e-commerce': 'ShoppingCart',
                'saas': 'Briefcase',
                'manufacturing': 'Box',
                'professional-services': 'Users',
              };
              const topStats = industry.hero.stats.slice(0, 2);

              return (
                <div
                  key={industry.slug}
                  className="group cursor-pointer rounded-2xl bg-[#fafafa] hover:bg-[#243B6E] p-6 sm:p-7 transition-all duration-300 flex flex-col"
                  onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                >
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl bg-white group-hover:bg-white/10 flex items-center justify-center mb-6 transition-colors duration-300">
                    <DynamicIcon name={iconMap[industry.slug] ?? 'Building2'} className="w-5 h-5 text-slate-700 group-hover:text-white transition-colors duration-300" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-bold text-[#1B2E5A] group-hover:text-white mb-2 tracking-tight transition-colors duration-300">
                    {industry.name}
                  </h3>
                  <p className="text-sm text-slate-500 group-hover:text-slate-400 leading-relaxed mb-6 transition-colors duration-300 flex-1">
                    {industry.hero.subheadline}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-6 pt-5 border-t border-slate-200/60 group-hover:border-white/10 transition-colors duration-300">
                    {topStats.map((stat, i) => (
                      <div key={i}>
                        <p className="text-lg font-extrabold text-[#1B2E5A] group-hover:text-white tracking-tight transition-colors duration-300">{stat.value}</p>
                        <p className="text-[11px] text-slate-400 group-hover:text-slate-500 transition-colors duration-300">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <span className="text-sm font-semibold text-slate-900 group-hover:text-white inline-flex items-center gap-1.5 transition-colors duration-300">
                    Explore <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-semibold text-slate-400 tracking-wide mb-3">Contact</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1B2E5A] tracking-[-0.025em]">
              Talk to our team
            </h2>
            <p className="text-slate-500 text-base sm:text-lg max-w-lg mx-auto mt-4 leading-relaxed">
              Whether you&apos;re evaluating Zopkit for your company or have a specific question, we&apos;ll get back to you within one business day.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Left — quick info */}
            <div className="lg:col-span-2 space-y-5">
              {[
                { icon: Mail, label: 'Email', value: 'sales@zopkit.com', href: 'mailto:sales@zopkit.com' },
                { icon: Phone, label: 'Phone', value: '8971055515' },
                { icon: MapPin, label: 'Office', value: 'Hi-Tech City, Hyderabad' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#fafafa] flex items-center justify-center shrink-0">
                    <item.icon className="w-[18px] h-[18px] text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} className="text-sm font-semibold text-slate-900 hover:text-slate-600 transition-colors cursor-pointer">{item.value}</a>
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">Mon – Fri, 9 AM – 6 PM IST</p>
              </div>
            </div>

            {/* Right — form */}
            <div className="lg:col-span-3">
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setIsSubmittingContact(true)
                  try {
                    const response = await api.post('/contact/submit', contactForm)
                    if (response.data.success) {
                      toast.success("Thanks! We'll be in touch within one business day.")
                      setContactForm({ name: '', email: '', company: '', phone: '', jobTitle: '', companySize: '', preferredTime: '', comments: '' })
                    } else {
                      throw new Error(response.data.message || 'Failed to submit')
                    }
                  } catch (error: any) {
                    toast.error(error.response?.data?.message || 'Something went wrong. Please try again.')
                  } finally {
                    setIsSubmittingContact(false)
                  }
                }}
                className="space-y-4"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="c-name" className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
                    <input type="text" id="c-name" required value={contactForm.name} onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B2E5A]/10 focus:border-slate-400 transition-colors"
                      placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label htmlFor="c-email" className="block text-sm font-medium text-slate-700 mb-1.5">Work email</label>
                    <input type="email" id="c-email" required value={contactForm.email} onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B2E5A]/10 focus:border-slate-400 transition-colors"
                      placeholder="jane@company.com" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="c-company" className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
                    <input type="text" id="c-company" required value={contactForm.company} onChange={(e) => setContactForm(prev => ({ ...prev, company: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B2E5A]/10 focus:border-slate-400 transition-colors"
                      placeholder="Acme Inc." />
                  </div>
                  <div>
                    <label htmlFor="c-size" className="block text-sm font-medium text-slate-700 mb-1.5">Team size</label>
                    <select id="c-size" value={contactForm.companySize} onChange={(e) => setContactForm(prev => ({ ...prev, companySize: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1B2E5A]/10 focus:border-slate-400 transition-colors">
                      <option value="">Select</option>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201-500">201-500</option>
                      <option value="500+">500+</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="c-msg" className="block text-sm font-medium text-slate-700 mb-1.5">How can we help?</label>
                  <textarea id="c-msg" rows={4} value={contactForm.comments} onChange={(e) => setContactForm(prev => ({ ...prev, comments: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B2E5A]/10 focus:border-slate-400 transition-colors resize-none"
                    placeholder="Tell us about your use case, team size, or any questions..." />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingContact}
                  className="w-full sm:w-auto px-7 py-3 rounded-full bg-[#1B2E5A] hover:bg-[#243B6E] text-white font-semibold text-[15px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingContact ? 'Sending...' : 'Send message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

{/* Resources Section */}
      <section id="resources" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 500px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-semibold text-slate-400 tracking-wide mb-3">Resources</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1B2E5A] tracking-[-0.025em]">
              Everything you need to succeed
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: FileText, title: 'Documentation', desc: 'Comprehensive guides and API docs' },
              { icon: GraduationCap, title: 'Academy', desc: 'Video tutorials and courses' },
              { icon: Users, title: 'Community', desc: 'Join our user community' },
              { icon: Zap, title: 'Support', desc: '24/7 customer support' },
            ].map((item) => (
              <div key={item.title} className="group cursor-pointer rounded-2xl bg-[#fafafa] hover:bg-[#243B6E] p-6 sm:p-7 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-white group-hover:bg-white/10 flex items-center justify-center mb-5 transition-colors duration-300">
                  <item.icon className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-base font-bold text-[#1B2E5A] group-hover:text-white mb-1.5 tracking-tight transition-colors duration-300">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-500 group-hover:text-slate-400 leading-relaxed transition-colors duration-300">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}

export default Landing
