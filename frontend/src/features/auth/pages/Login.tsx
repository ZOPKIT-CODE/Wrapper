import React, { useState, useEffect } from 'react'
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { useNavigate, useSearch, useLocation } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Shield, Zap, BarChart3, Users, CheckCircle2, Globe, ChevronRight } from 'lucide-react'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import api, { createCancelableRequest } from '@/lib/api'
import { jwtService } from '@/services/jwtService'
import { config, CRM_DOMAIN, CRM_CALLBACK_PATH } from '@/lib/config'
import { consumeSessionRecoveryReason } from '@/lib/auth/session-recovery'

const crmCallbackPath = CRM_CALLBACK_PATH || '/callback'

type CrmUser = {
  id: string
  email?: string
  name?: string
  givenName?: string
  organization?: { code?: string }
  tenantId?: string
  permissions?: string[]
  [key: string]: unknown
}

function extractCrmIntendedPath(returnTo: string): string {
  try {
    const returnUrl = new URL(returnTo)
    let intendedPath = returnUrl.pathname
    if (!intendedPath || intendedPath === '/') intendedPath = '/'
    if (intendedPath.includes('/callback')) {
      console.warn('⚠️ Blocked redirect to callback, using fallback')
      intendedPath = '/'
    }
    if (intendedPath.includes('/login')) {
      console.warn('⚠️ Blocked redirect to login, using fallback')
      intendedPath = '/'
    }
    if (returnUrl.hostname.includes('wrapper.zopkit.com')) {
      console.warn('⚠️ Blocked wrapper domain, using fallback')
      intendedPath = '/'
    }
    return intendedPath
  } catch (error) {
    console.error('❌ Error extracting intended path:', error)
    return '/'
  }
}

function validateCrmReturnToUrl(returnTo: string): boolean {
  try {
    const returnUrl = new URL(returnTo)
    const isDevelopment =
      import.meta.env.MODE === 'development' ||
      import.meta.env.DEV === true ||
      window.location.hostname === 'localhost'
    if (isDevelopment && returnUrl.hostname === 'localhost') return true
    const crmHostname = new URL(CRM_DOMAIN).hostname
    if (!returnUrl.hostname.includes(crmHostname)) {
      console.warn('⚠️ Invalid CRM domain:', returnUrl.hostname)
      return false
    }
    const wrapperHostname = new URL(config.WRAPPER_DOMAIN).hostname
    if (
      returnUrl.pathname.includes('/callback') ||
      returnUrl.pathname.includes('/login') ||
      returnUrl.hostname.includes(wrapperHostname)
    ) {
      console.warn('⚠️ Dangerous returnTo URL blocked:', returnUrl.pathname)
      return false
    }
    return true
  } catch (error) {
    console.error('❌ Invalid returnTo URL format:', error)
    return false
  }
}

function generateCrmCallbackUrl(user: CrmUser, returnTo: string): string {
  try {
    const token = jwtService.generateCRMToken(user)
    const callbackUrl = new URL(`${CRM_DOMAIN}${crmCallbackPath}`)
    callbackUrl.searchParams.set('code', token)
    callbackUrl.searchParams.set('state', 'authenticated')
    callbackUrl.searchParams.set('user_id', user.id)
    callbackUrl.searchParams.set('timestamp', Date.now().toString())
    callbackUrl.searchParams.set('returnTo', extractCrmIntendedPath(returnTo))
    callbackUrl.searchParams.set('source', 'wrapper')
    callbackUrl.searchParams.set('app', 'crm')
    return callbackUrl.toString()
  } catch (error) {
    console.error('❌ Error generating CRM callback URL:', error)
    return `${CRM_DOMAIN}/`
  }
}

function generateCrmFallbackUrl(): string {
  return `${CRM_DOMAIN}/?error=auth_failed&source=wrapper`
}

// --- Animated Components ---

const RotatingText = ({ words }: { words: string[] }) => {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [words.length])

  return (
    <div className="h-[1.2em] relative inline-block overflow-hidden align-bottom min-w-[9rem] w-full max-w-[15rem] sm:max-w-[17rem] md:max-w-[19rem] xl:max-w-[22rem] 2xl:max-w-[26rem] pl-0 pr-2">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={index}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="absolute left-0 top-0 whitespace-nowrap bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent font-extrabold pr-[0.08em]"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

const FeatureCard = ({ icon: Icon, title, desc, delay }: { icon: any, title: string, desc: string, delay: number }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.5 }}
    whileHover={{ 
      scale: 1.02, 
      backgroundColor: "rgba(255, 255, 255, 1)", 
      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.01)" 
    }}
      className="p-4 rounded-xl bg-white/60 border border-slate-200/60 backdrop-blur-sm cursor-default transition-all group shadow-sm"
  >
    <div className="flex items-start space-x-4">
      <div className="p-2 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
        <Icon className="w-6 h-6 text-indigo-600 transition-colors" />
      </div>
      <div>
        <h3 className="text-[#1B2E5A] font-bold mb-1 group-hover:text-indigo-700 transition-colors">{title}</h3>
        <p className="text-sm text-slate-500 leading-tight font-medium">{desc}</p>
      </div>
    </div>
  </motion.div>
)

const BackgroundGrid = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Strong gradient base - more visible */}
    <div 
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 25%, #faf5ff 50%, #f3e8ff 75%, #ede9fe 100%)'
      }}
    />
    
    {/* Grid Pattern */}
    <div 
      className="absolute inset-0 opacity-[0.5]"
      style={{
        backgroundImage: `linear-gradient(to right, #c7d2fe 1px, transparent 1px), linear-gradient(to bottom, #c7d2fe 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        maskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)'
      }}
    />
    
    {/* Moving Orbs - stronger, more visible */}
    <motion.div 
      animate={{ 
        x: [0, 50, 0], 
        y: [0, -30, 0],
        scale: [1, 1.1, 1] 
      }}
      transition={{ duration: 15, repeat: Infinity, repeatType: "reverse" }}
      className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-300/50 rounded-full blur-[80px] mix-blend-multiply"
    />
    <motion.div 
      animate={{ 
        x: [0, -50, 0], 
        y: [0, 40, 0],
        scale: [1, 1.2, 1] 
      }}
      transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
      className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-300/50 rounded-full blur-[80px] mix-blend-multiply"
    />
    <motion.div 
      animate={{ 
        x: [0, 30, 0], 
        y: [0, 50, 0],
        opacity: [0.4, 0.65, 0.4]
      }}
      transition={{ duration: 18, repeat: Infinity, repeatType: "reverse" }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-200/50 rounded-full blur-[100px] mix-blend-multiply"
    />
  </div>
)

// --- Main Component ---

export function Login() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, string>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const location = useLocation()
  const { 
    isAuthenticated, 
    user, 
    isLoading, 
    getToken, 
    login,
    getOrganization,
    getUserOrganizations 
  } = useKindeAuth()
  
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [userOrgs, setUserOrgs] = useState<any>(null)
  const [currentOrg, setCurrentOrg] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [attemptCount, setAttemptCount] = useState(0)

  // CRM-specific parameters
  const returnTo = search['returnTo']
  const source = search['source']
  const error = search['error']
  const crmRedirect = search['crmRedirect']
  
  // Determine if this is a CRM request
  const isCrmRequest = source === 'crm' || crmRedirect === 'true'

  useEffect(() => {
    const recoveryReason = consumeSessionRecoveryReason()
    if (recoveryReason === 'invalid_grant') {
      toast.error('Session expired. Please sign in again.')
    }
  }, [])
  
  // Store user's intended path when CRM request is detected
  useEffect(() => {
    if (isCrmRequest && returnTo) {
      try {
        const returnUrl = new URL(returnTo)
        const intendedPath = returnUrl.pathname === '/' ? '/' : returnUrl.pathname
        sessionStorage.setItem('crm_intended_path', intendedPath)
      } catch (err) {
        console.error('❌ Error storing intended path:', err)
      }
    }
  }, [isCrmRequest, returnTo])
  
  // Get organization data when user is authenticated
  useEffect(() => {
    const fetchOrgData = async () => {
      if (!isAuthenticated || !user || isLoading) return
      
      try {
        const org = await getOrganization()
        setCurrentOrg(org)
        
        const orgs = await getUserOrganizations()
        setUserOrgs(orgs)
      } catch (err) {
        console.error('❌ Error fetching organization data:', err)
      }
    }

    fetchOrgData()
  }, [isAuthenticated, user, isLoading, getOrganization, getUserOrganizations])

  // Handle CRM redirect after authentication
  useEffect(() => {
    const handleCrmRedirect = async () => {
      if (!isAuthenticated || !user || !returnTo || !isCrmRequest || isLoading || isRedirecting) {
        return
      }

      // Check for infinite redirect loops
      const crmRedirectCount = parseInt(localStorage.getItem('crm_redirect_count') || '0')
      if (crmRedirectCount > 3) {
        console.error('🚨 CRM INFINITE LOOP DETECTED - Too many redirects')
        localStorage.removeItem('crm_redirect_count')
        window.location.href = config.CRM_DOMAIN + '/'
        return
      }
      localStorage.setItem('crm_redirect_count', (crmRedirectCount + 1).toString())

      setIsRedirecting(true)
      
      try {
        // Validate return URL using CRM auth service
        if (!validateCrmReturnToUrl(returnTo)) {
          console.error('❌ Invalid CRM return URL:', returnTo)
          toast.error('Invalid return URL. Please contact support.')
          setIsRedirecting(false)
          return
        }
        
        // Get access token from Kinde
        try {
          await getToken()
        } catch (tokenError) {
          console.warn('⚠️ Could not get token via getToken():', tokenError)
        }
        
        // Clear the CRM params from current URL to prevent loops
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.delete('returnTo')
        currentUrl.searchParams.delete('source')
        currentUrl.searchParams.delete('crmRedirect')
        currentUrl.searchParams.delete('error')
        window.history.replaceState({}, '', currentUrl.toString())
        
        // Generate CRM callback URL with JWT authentication
        const callbackUrl = generateCrmCallbackUrl(user, returnTo)
        
        // Clear stored paths and redirect count
        sessionStorage.removeItem('crm_intended_path')
        localStorage.removeItem('crm_redirect_count')
        localStorage.removeItem('crm_last_redirect')
        
        // Store authentication data for debugging
        localStorage.setItem('crm_callback_url', callbackUrl)
        localStorage.setItem('crm_user_id', user.id || user.email || 'unknown')
        localStorage.setItem('crm_callback_timestamp', Date.now().toString())
        
        // Redirect to CRM callback endpoint with JWT authentication
        window.location.href = callbackUrl
        
      } catch (err) {
        console.error('❌ Failed to generate CRM authentication:', err)
        window.location.href = generateCrmFallbackUrl()
      }
    }
    
    const timer = setTimeout(handleCrmRedirect, 500)
    return () => clearTimeout(timer)
  }, [isAuthenticated, user, returnTo, isCrmRequest, isLoading, isRedirecting, getToken])

  // Handle post-login redirect for authenticated users
  useEffect(() => {
    const { signal, cancel } = createCancelableRequest()

    const handlePostLoginRedirect = async () => {
      if (!isAuthenticated || !user || isLoading || returnTo || isRedirecting) {
        return
      }

      setIsRedirecting(true)

      try {
        const response = await api.get('/onboarding/status', { signal })
        const status = response.data

        if (status.user && status.isOnboarded && !status.needsOnboarding) {
          navigate({ to: '/dashboard/applications', replace: true })
        } else if (status.authStatus?.onboardingCompleted === true || 
                   status.authStatus?.userType === 'INVITED_USER' ||
                   status.authStatus?.isInvitedUser === true) {
          navigate({ to: '/dashboard/applications', replace: true })
        } else {
          navigate({ to: '/onboarding', replace: true })
        }
      } catch (err) {
        console.error('❌ Error checking onboarding status:', err)
        navigate({ to: '/onboarding', replace: true })
      }
    }

    handlePostLoginRedirect()
    return () => cancel()
  }, [isAuthenticated, user, isLoading, returnTo, navigate, isRedirecting])

  const handleBackToCRM = () => {
    if (returnTo && validateCrmReturnToUrl(returnTo)) {
      window.location.href = returnTo
    } else {
      toast.error('Invalid return URL')
    }
  }

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true)
      setAttemptCount(prev => prev + 1)
      
      const googleConnectionId = (import.meta as any).env.VITE_KINDE_GOOGLE_CONNECTION_ID
      
      if (!googleConnectionId) {
        console.error('❌ VITE_KINDE_GOOGLE_CONNECTION_ID is not configured')
        await login()
        return
      }
      
      await login({ 
        connectionId: googleConnectionId
      })
    } catch (err) {
      console.error('❌ Login error:', err)
      toast.error('Failed to start login process. Please try again.')
      setIsLoggingIn(false)
    }
  }

  // --- Loading States ---
  
  const LoadingScreen = ({ message, subMessage, icon: Icon, colorClass }: { message: string, subMessage: string, icon: any, colorClass: string }) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center relative overflow-hidden">
      <BackgroundGrid />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 text-center space-y-6 p-8 rounded-2xl bg-white/50 backdrop-blur-xl border border-slate-200 shadow-xl"
      >
        <div className="relative w-20 h-20 mx-auto">
          <div className={`absolute inset-0 bg-gradient-to-r ${colorClass} rounded-full opacity-10 animate-ping`} />
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className={`absolute inset-2 border-2 border-transparent border-t-current rounded-full ${colorClass.replace('from-', 'text-').replace('to-', '')}`} 
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className={`w-8 h-8 ${colorClass.replace('from-', 'text-').split(' ')[0]}`} />
          </div>
        </div>
        <div>
          <h3 className="text-[#1B2E5A] font-semibold text-xl tracking-tight">{message}</h3>
          <p className="text-slate-500 text-sm mt-2 font-medium">{subMessage}</p>
        </div>
      </motion.div>
    </div>
  )

  if (!isLoading && isAuthenticated && user && !returnTo && !isRedirecting) {
    return <LoadingScreen message="Setting up your workspace" subMessage="Initializing your environment..." icon={Zap} colorClass="from-blue-600 to-indigo-600" />
  }

  if (isLoading) {
    return <LoadingScreen message="Verifying credentials" subMessage="Connecting to Zopkit..." icon={Shield} colorClass="from-blue-600 to-indigo-600" />
  }

  if (!isLoading && isAuthenticated && user && returnTo && isCrmRequest && isRedirecting) {
    return <LoadingScreen message="Redirecting to CRM" subMessage="Establishing secure connection..." icon={Globe} colorClass="from-violet-600 to-indigo-600" />
  }

  if (isRedirecting && !returnTo && isCrmRequest === false) {
    return <LoadingScreen message="Redirecting to dashboard" subMessage="Loading your workspace..." icon={Zap} colorClass="from-blue-600 to-indigo-600" />
  }

  // --- Main Render ---

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 bg-slate-50">
      <BackgroundGrid />

      {/* Content Container */}
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-5rem)] py-12 px-4 sm:px-6 lg:px-12 relative z-10 w-full">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          
          {/* Left Column - Hero Section */}
          <div className="hidden lg:flex flex-col justify-center space-y-12 w-full">
            {/* Logo Group */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center space-x-6 group"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full group-hover:bg-indigo-500/20 transition-all duration-500" />
                <img
                  src={config.LOGO_URL}
                  alt="Zopkit"
                  className="relative w-24 h-24 rounded-2xl object-contain shadow-2xl ring-4 ring-white z-10"
                />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-[#1B2E5A] tracking-tight">Zopkit</h2>
                <div className="flex items-center space-x-2 text-slate-500">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold uppercase tracking-wider">Business OS</span>
                </div>
              </div>
            </motion.div>

            {/* Dynamic Headline */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              <h1 className="text-5xl xl:text-7xl font-bold text-[#1B2E5A] leading-[1.1]">
                One place to <br />
                <RotatingText words={["Grow", "Scale", "Thrive"]} />
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed max-w-lg font-medium">
                Unified CRM, project management, and team collaboration tools built for the modern enterprise.
              </p>
            </motion.div>

            {/* Interactive Feature Grid */}
            <div className="grid grid-cols-2 gap-5">
              <FeatureCard 
                delay={0.4} 
                icon={Zap} 
                title="Grow Faster" 
                desc="Automated workflows that save time." 
              />
              <FeatureCard 
                delay={0.5} 
                icon={Shield} 
                title="Enterprise Security" 
                desc="Bank-grade encryption for your data." 
              />
              <FeatureCard 
                delay={0.6} 
                icon={Users} 
                title="Team Sync" 
                desc="Real-time collaboration across devices." 
              />
              <FeatureCard 
                delay={0.7} 
                icon={BarChart3} 
                title="Deep Insights" 
                desc="Analytics that drive decision making." 
              />
            </div>
          </div>

          {/* Right Column - Login Card */}
          <div className="flex items-center justify-center lg:justify-end w-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="w-full max-w-md"
            >
              <Card className="relative overflow-hidden border border-slate-200 bg-white/70 backdrop-blur-2xl shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
                {/* Top decorative gradient line */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-t-xl" />
                
                <CardHeader className="pb-8 space-y-4 text-center pt-10">
                   {/* Mobile Logo */}
                   <div className="lg:hidden flex justify-center mb-6">
                    <img
                      src={config.LOGO_URL}
                      alt="Zopkit"
                      className="w-20 h-20 rounded-xl shadow-lg ring-4 ring-white"
                    />
                  </div>

                  {isCrmRequest ? (
                    <div className="space-y-2">
                       <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-50 border border-emerald-100 mb-2">
                        <Globe className="w-6 h-6 text-emerald-600" />
                      </div>
                      <CardTitle className="text-3xl font-bold text-[#1B2E5A] tracking-tight">CRM Access</CardTitle>
                      <CardDescription className="text-slate-500 font-medium">Authenticate securely to access your workspace</CardDescription>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <CardTitle className="text-3xl font-bold text-[#1B2E5A] tracking-tight">Welcome Back</CardTitle>
                      <CardDescription className="text-slate-500 font-medium">Sign in to your Zopkit dashboard</CardDescription>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-6 pb-8 px-8">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      onClick={handleLogin}
                      disabled={isLoggingIn}
                      className={`w-full h-14 font-semibold text-lg rounded-xl transition-all relative overflow-hidden group shadow-sm ${
                        isCrmRequest
                          ? 'bg-[#1B2E5A] hover:bg-[#162447] text-white border-0'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Shine Effect */}
                      <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent z-10" />
                      
                      <div className="relative flex items-center justify-center z-20">
                        {isLoggingIn ? (
                          <>
                            <ZopkitRoundLoader size="sm" className={`mr-3 ${isCrmRequest ? 'text-white' : ''}`} />
                            <span className={isCrmRequest ? 'text-white' : 'text-slate-700'}>Signing in...</span>
                          </>
                        ) : (
                          <>
                            {/* Google Icon SVG */}
                             <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                  <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                  <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                                  <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.734 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                                  <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                                </g>
                              </svg>
                            <span className={isCrmRequest ? 'text-white' : 'text-slate-700'}>Continue with Google</span>
                          </>
                        )}
                      </div>
                    </Button>
                  </motion.div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-slate-400 font-bold tracking-wider">Secure Access</span></div>
                  </div>

                  {/* Trust Indicators */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-50 border border-slate-100 text-center hover:bg-white hover:shadow-sm transition-all">
                       <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-2" />
                       <span className="text-xs text-slate-600 font-medium">SSO Enabled</span>
                    </div>
                     <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-50 border border-slate-100 text-center hover:bg-white hover:shadow-sm transition-all">
                       <Shield className="w-5 h-5 text-indigo-500 mb-2" />
                       <span className="text-xs text-slate-600 font-medium">Encrypted</span>
                    </div>
                  </div>

                  {/* Authenticated State Info */}
                  {isAuthenticated && currentOrg && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 rounded-xl bg-indigo-50 border border-indigo-100"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                          {user?.givenName?.[0] || 'U'}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-slate-800 truncate">{user?.email}</p>
                          <p className="text-xs text-indigo-600 truncate font-medium">{currentOrg.orgName}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                      <p className="text-sm text-red-600 font-medium">{decodeURIComponent(error)}</p>
                    </motion.div>
                  )}

                  {/* Back to CRM */}
                  {isCrmRequest && (
                    <Button
                      onClick={handleBackToCRM}
                      variant="ghost"
                      className="w-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 group"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                      Return to CRM
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Legal Links below card */}
              <div className="mt-8 flex items-center justify-center space-x-6 text-sm text-slate-400 font-medium">
                <a href="#" className="hover:text-slate-600 transition-colors">Privacy</a>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <a href="#" className="hover:text-slate-600 transition-colors">Terms</a>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <a href="#" className="hover:text-slate-600 transition-colors">Help</a>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}