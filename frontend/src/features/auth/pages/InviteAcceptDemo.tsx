import React, { useState, useEffect, useRef } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import {
  InviteLoadingState,
  InviteInvalidState,
  InviteSignInState,
  InviteWelcomeBackState,
  InviteJoiningState,
  InviteSuccessState,
} from './InviteAcceptLayout'

const MOCK = {
  org: 'Acme Restaurants',
  inviterName: 'John Smith',
  inviterEmail: 'john@acme.co',
  role: 'Manager',
  userEmail: 'jane.doe@example.com',
  userName: 'Jane Doe',
  message: 'Hey Jane, welcome aboard! Excited to have you build the launch with us.',
}

type DemoState = 'loading' | 'invalid' | 'signin' | 'welcome' | 'joining' | 'success'

const STATES: { value: DemoState; label: string }[] = [
  { value: 'loading', label: 'Loading' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'signin',  label: 'Sign in' },
  { value: 'welcome', label: 'Welcome back' },
  { value: 'joining', label: 'Joining' },
  { value: 'success', label: 'Success' },
]

function StateSwitcher({ current, onChange }: { current: DemoState; onChange: (s: DemoState) => void }) {
  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 4,
      borderRadius: 999, background: 'rgba(10,16,36,0.92)', backdropFilter: 'blur(12px)',
      padding: '6px 8px', boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
      fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, fontWeight: 500,
    }}>
      <span style={{ padding: '0 8px', color: 'rgba(255,255,255,0.4)', userSelect: 'none', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 11 }}>Preview</span>
      {STATES.map(s => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          style={{
            padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 500, letterSpacing: '-0.005em',
            background: current === s.value ? '#fff' : 'transparent',
            color: current === s.value ? '#0a1024' : 'rgba(255,255,255,0.55)',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

export default function InviteAcceptDemo() {
  const search = useSearch({ strict: false }) as Record<string, string>
  const navigate = useNavigate()

  const currentState = (search['state'] as DemoState) || 'signin'
  const [googleLoading, setGoogleLoading] = useState(false)
  const [joinStep, setJoinStep] = useState(0)
  const joinTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const setCurrentState = (s: DemoState) => {
    navigate({ to: '/dev/invite-preview', search: { state: s } })
  }

  // Animate joinStep when on joining state
  useEffect(() => {
    joinTimers.current.forEach(clearTimeout)
    if (currentState !== 'joining') { setJoinStep(0); return }
    setJoinStep(0)
    joinTimers.current = [
      setTimeout(() => setJoinStep(1), 700),
      setTimeout(() => setJoinStep(2), 1500),
      setTimeout(() => setJoinStep(3), 2400),
      setTimeout(() => setJoinStep(4), 3300),
    ]
    return () => joinTimers.current.forEach(clearTimeout)
  }, [currentState])

  const handleGoogleSignIn = () => {
    setGoogleLoading(true)
    setTimeout(() => {
      setGoogleLoading(false)
      setCurrentState('welcome')
    }, 1200)
  }

  const handleJoin = () => {
    setCurrentState('joining')
    setTimeout(() => setCurrentState('success'), 4000)
  }

  let screen: React.ReactNode = null
  if (currentState === 'loading') {
    screen = <InviteLoadingState org={MOCK.org} />
  } else if (currentState === 'invalid') {
    screen = (
      <InviteInvalidState
        errorMessage="This invitation has expired or been revoked."
        onHomepage={() => setCurrentState('signin')}
      />
    )
  } else if (currentState === 'signin') {
    screen = (
      <InviteSignInState
        org={MOCK.org}
        inviterName={MOCK.inviterName}
        inviterEmail={MOCK.inviterEmail}
        role={MOCK.role}
        message={MOCK.message}
        onGoogleSignIn={handleGoogleSignIn}
        googleLoading={googleLoading}
      />
    )
  } else if (currentState === 'welcome') {
    screen = (
      <InviteWelcomeBackState
        org={MOCK.org}
        inviterName={MOCK.inviterName}
        role={MOCK.role}
        userEmail={MOCK.userEmail}
        userName={MOCK.userName}
        onJoin={handleJoin}
        joining={false}
      />
    )
  } else if (currentState === 'joining') {
    screen = <InviteJoiningState org={MOCK.org} joinStep={joinStep} />
  } else if (currentState === 'success') {
    screen = (
      <InviteSuccessState
        org={MOCK.org}
        role={MOCK.role}
        userEmail={MOCK.userEmail}
        onOpenWorkspace={() => setCurrentState('signin')}
      />
    )
  }

  return (
    <>
      <StateSwitcher current={currentState} onChange={setCurrentState} />
      <div key={currentState}>{screen}</div>
    </>
  )
}
