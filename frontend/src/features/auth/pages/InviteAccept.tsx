import { useState, useEffect, useRef } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { logger } from '@/lib/logger'
import { useInvalidateQueries, queryKeys } from '@/hooks/useSharedQueries'
import {
  InviteInvalidState,
  InviteSignInState,
  InviteJoiningState,
} from './InviteAcceptLayout'

interface InvitationDetails {
  email: string
  organizationName: string
  inviterName: string
  roles: string[]
  message?: string
  orgCode: string
}

export function InviteAccept() {
  const search = useSearch({ strict: false }) as Record<string, string>
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { invalidateAuthStatus, invalidateOnboardingStatus } = useInvalidateQueries()
  const { isAuthenticated, user, isLoading, login } = useKindeAuth()

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [inviteLoading, setInviteLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const [joinStep, setJoinStep] = useState(0)
  const joinTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const autoAcceptFired = useRef(false)

  const orgCode = search['org']
  const email = search['email']
  const token = search['token']

  // ── Fetch invitation details ────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      if (token) {
        try {
          const res = await api.get('/invitations/details-by-token', { params: { token } })
          if (res.data.success) setInvitation(res.data.invitation)
          else setError(res.data.message || 'Failed to load invitation')
        } catch (err: any) {
          if (err.response?.status === 404) setError('Invitation not found or has expired')
          else if (err.response?.status === 410) setError('This invitation has expired')
          else if (err.response?.status === 409) setError('This invitation has already been accepted')
          else setError('Unable to load invitation details')
        }
        setInviteLoading(false)
        return
      }
      if (!orgCode) {
        setError('Invalid invitation link — missing organisation or token')
        setInviteLoading(false)
        return
      }
      try {
        const res = await api.get('/invitations/details', { params: { org: orgCode, email: email || '' } })
        if (res.data.success) setInvitation(res.data.invitation)
        else setError(res.data.message || 'Failed to load invitation')
      } catch (err: any) {
        if (err.response?.status === 404) setError('Invitation not found or has expired')
        else setError('Unable to load invitation details')
      }
      setInviteLoading(false)
    }
    fetch()
  }, [orgCode, email, token])

  // ── Refetch invitation after OAuth redirect (page reloaded without invitation) ─
  useEffect(() => {
    if (isAuthenticated && user && !invitation && token) {
      api.get('/invitations/details-by-token', { params: { token } })
        .then(res => {
          if (res.data.success) setInvitation(res.data.invitation)
          else setError(res.data.message || 'Failed to load invitation')
          setInviteLoading(false)
        })
        .catch(() => {
          setError('Failed to load invitation details after authentication')
          setInviteLoading(false)
        })
    }
  }, [isAuthenticated, user, token])

  // ── Preserve token across OAuth redirect ───────────────────────────────
  useEffect(() => {
    if (token) sessionStorage.setItem('pendingInvitationToken', token)
    return () => { if (token) sessionStorage.removeItem('pendingInvitationToken') }
  }, [token])

  // ── Restore token post-OAuth if missing from URL ────────────────────────
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingInvitationToken')
    if (pending && !token) navigate({ to: `/invite/accept?token=${pending}`, replace: true })
  }, [token, navigate])

  // ── Auto-accept as soon as auth + invitation are both ready ────────────
  // autoAcceptFired prevents repeated calls when Kinde's user/auth objects
  // get new references across re-renders (which would otherwise re-trigger
  // this effect and spam the API after a 403 or transient error).
  useEffect(() => {
    if (isAuthenticated && !isLoading && user && invitation && !autoAcceptFired.current) {
      autoAcceptFired.current = true
      handleAcceptInvitation()
    }
  }, [isAuthenticated, isLoading, user, invitation])

  // ── Joining animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!accepting) {
      joinTimers.current.forEach(clearTimeout)
      setJoinStep(0)
      return
    }
    setJoinStep(0)
    joinTimers.current = [
      setTimeout(() => setJoinStep(1), 300),
      setTimeout(() => setJoinStep(2), 700),
      setTimeout(() => setJoinStep(3), 1200),
    ]
    return () => joinTimers.current.forEach(clearTimeout)
  }, [accepting])

  // ── Handle Google sign-in ───────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      const googleConnectionId = (import.meta as any).env.VITE_KINDE_GOOGLE_CONNECTION_ID
      const opts: any = { popup: true }
      if (googleConnectionId) {
        opts.connectionId = googleConnectionId
        opts.connection_id = googleConnectionId
      }
      if (invitation?.orgCode) opts.org_code = invitation.orgCode
      await login(opts)
    } catch (err) {
      logger.error('Google sign-in error:', err)
      toast.error('Failed to sign in with Google')
      setGoogleLoading(false)
    }
  }

  // ── Accept invitation ───────────────────────────────────────────────────
  const handleAcceptInvitation = async () => {
    if (!invitation || !user) return
    setAccepting(true)

    try {
      let response
      if (token) {
        response = await api.post('/invitations/accept-by-token', { token })
      } else {
        response = await api.post('/invitations/accept', {
          org: invitation.orgCode, email: invitation.email, kindeUserId: user.id,
        })
      }

      if (response.data.success) {
        sessionStorage.removeItem('pendingInvitationToken')
        invalidateAuthStatus()
        invalidateOnboardingStatus()
        await queryClient.refetchQueries({ queryKey: queryKeys.authStatus })
        await queryClient.refetchQueries({ queryKey: queryKeys.onboardingStatus })
        toast.success(`Welcome to ${invitation.organizationName}!`)
        navigate({ to: '/dashboard/applications', search: { welcome: 'true', invited: 'true' } })
      } else {
        throw new Error(response.data.message || 'Failed to accept invitation')
      }
    } catch (err: any) {
      logger.error('❌ Error accepting invitation:', err)
      if (err.response?.status === 409) {
        toast.error('This invitation has already been accepted')
        setTimeout(() => navigate({ to: '/dashboard/applications' }), 1500)
      } else if (err.response?.status === 410) {
        toast.error('This invitation has expired')
        setAccepting(false)
      } else if (err.response?.status === 403) {
        toast.error(err.response?.data?.message || 'This invitation was sent to a different email address. Please sign in with the invited email account.')
        setAccepting(false)
      } else {
        toast.error(err.response?.data?.message || 'Failed to accept invitation. Please try again.')
        setAccepting(false)
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <InviteInvalidState
        errorMessage={error}
        onHomepage={() => navigate({ to: '/landing' })}
      />
    )
  }

  if (accepting) {
    return <InviteJoiningState org={invitation?.organizationName ?? ''} joinStep={joinStep} />
  }

  // Single sign-in screen — shows inline skeleton while invitation or Kinde auth is loading
  return (
    <InviteSignInState
      org={invitation?.organizationName ?? ''}
      inviterName={invitation?.inviterName ?? ''}
      inviterEmail={invitation?.email}
      role={invitation?.roles?.[0] ?? 'Member'}
      message={invitation?.message}
      loading={inviteLoading || isLoading}
      onGoogleSignIn={handleGoogleSignIn}
      googleLoading={googleLoading}
    />
  )
}
