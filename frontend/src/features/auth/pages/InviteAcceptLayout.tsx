import React from 'react'
import './invite-accept.css'
import zopkitLogoFull from '@/public/Zopkit Full Logo.jpg'

// ---------------------------------------------------------------------------
// Design tokens (inline style values)
// ---------------------------------------------------------------------------
const INK       = '#0a1024'
const INK_SOFT  = '#3a4267'
const MUTED     = '#6a7396'
const MUTED_2   = '#9aa1bc'
const LINE      = 'rgba(15,22,50,0.08)'
const LINE_STR  = 'rgba(15,22,50,0.14)'
const PAPER     = '#f6f6f1'
const ACCENT    = '#4a5cf0'
const ACCENT_2  = '#6a7dff'
const ACC_SOFT  = '#e6e9ff'
const ACC_INK   = '#2334b8'
const DANGER    = '#d23a4a'
const DAN_SOFT  = '#fde8ea'

const FONT_SANS  = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
const FONT_SERIF = "'Instrument Serif', 'Times New Roman', serif"
const FONT_MONO  = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const IconAlert = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)
const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const IconArrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)
const IconGoogle = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.4-1.11 2.6-2.34 3.41v2.83h3.78c2.22-2.04 3.49-5.05 3.49-8.48z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.78-2.83c-1.05.7-2.39 1.13-4.15 1.13-3.19 0-5.89-2.15-6.85-5.04H1.22v3.17C3.19 21.3 7.31 24 12 24z" />
    <path fill="#FBBC05" d="M5.15 14.35c-.25-.73-.39-1.51-.39-2.35s.14-1.62.39-2.35V6.48H1.22C.44 8.03 0 9.78 0 12s.44 3.97 1.22 5.52l3.93-3.17z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.36.61 4.61 1.81l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.19 2.7 1.22 6.48l3.93 3.17C6.11 6.9 8.81 4.75 12 4.75z" />
  </svg>
)
const IconLoadingArc = () => (
  <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
    style={{ animation: 'ia-spin 1.2s linear infinite', color: '#fff' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 28 }}>
      <img
        src={zopkitLogoFull}
        alt="Zopkit"
        style={{
          height: '100%', width: 'auto', display: 'block',
          mixBlendMode: light ? 'screen' : 'multiply',
          filter: light ? 'grayscale(1) contrast(100) invert(1)' : 'none',
        }}
      />
    </div>
  )
}

function LiveDot({ label, red }: { label: string; red?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span className={`ia-pulse${red ? ' ia-pulse-red' : ''}`} />
      <span>{label}</span>
    </div>
  )
}

function LeftMeta({ right }: { right: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'rgba(240,238,230,0.55)',
    }}>
      <BrandMark light />
      {right}
    </div>
  )
}

function Avatar({ text, gradient = 'linear-gradient(135deg, #6a7dff, #4a5cf0)', size = 46, border = '' }:
  { text: string; gradient?: string; size?: number; border?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: gradient, display: 'grid', placeItems: 'center',
      color: '#fff', fontWeight: 600, fontSize: size > 38 ? 16 : 12,
      letterSpacing: '-0.02em', flexShrink: 0,
      border: border || undefined,
    }}>
      {text}
    </div>
  )
}

function InviterCard({ inviterName, inviterEmail }: { inviterName: string; inviterEmail?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: 18,
      background: 'rgba(240,238,230,0.05)',
      border: '1px solid rgba(240,238,230,0.1)',
      borderRadius: 16,
      backdropFilter: 'blur(6px)',
      maxWidth: 460,
    }}>
      <Avatar text={initials(inviterName)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,238,230,0.5)', marginBottom: 4 }}>
          Invited by
        </div>
        <div style={{ color: '#f0eee6', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 2 }}>
          {inviterName}
        </div>
        {inviterEmail && (
          <div style={{ color: 'rgba(240,238,230,0.55)', fontSize: 13 }}>{inviterEmail}</div>
        )}
      </div>
    </div>
  )
}

function TeammateStack() {
  const avatars = [
    { text: 'JS', gradient: 'linear-gradient(135deg, #6a7dff, #4a5cf0)' },
    { text: 'MA', gradient: 'linear-gradient(135deg, #f4a261, #e76f51)' },
    { text: 'TR', gradient: 'linear-gradient(135deg, #2a9d8f, #264653)' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {avatars.map((a, i) => (
        <div key={i} style={{ marginRight: -10, zIndex: avatars.length - i }}>
          <Avatar text={a.text} gradient={a.gradient} size={32} border={`2px solid #0a1024`} />
        </div>
      ))}
      <div style={{ marginRight: -10 }}>
        <Avatar text="+8" gradient="rgba(240,238,230,0.1)" size={32} border="2px solid #0a1024" />
      </div>
      <span style={{ marginLeft: 22, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,238,230,0.55)' }}>
        11 teammates already inside
      </span>
    </div>
  )
}

function LeftFoot({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24,
      color: 'rgba(240,238,230,0.55)', fontFamily: FONT_MONO,
      fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <div style={{
      alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8,
      background: ACC_SOFT, color: ACC_INK, borderRadius: 999,
      padding: '6px 12px', fontFamily: FONT_MONO, fontSize: 11.5,
      letterSpacing: '0.06em', fontWeight: 500, marginBottom: 16, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, display: 'inline-block' }} />
      Role · {role}
    </div>
  )
}

function Btn({ variant, onClick, disabled, children }: { variant: 'primary' | 'light' | 'ghost'; onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: variant === 'ghost' ? 'auto' : 52,
    padding: variant === 'ghost' ? '6px 0' : '0 22px',
    borderRadius: variant === 'ghost' ? 0 : 14,
    fontWeight: 500, fontSize: variant === 'ghost' ? 13.5 : 15,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: variant === 'light' ? `1px solid ${LINE_STR}` : variant === 'ghost' ? 'none' : `1px solid ${INK}`,
    width: variant === 'ghost' ? 'auto' : '100%',
    fontFamily: FONT_SANS, letterSpacing: '-0.005em',
    opacity: disabled ? 0.6 : 1,
    transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
    background: variant === 'primary' ? INK : variant === 'light' ? '#fff' : 'transparent',
    color: variant === 'primary' ? PAPER : variant === 'light' ? INK : MUTED,
  }
  return (
    <button type="button" style={base} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function RightFoot() {
  return (
    <div style={{
      marginTop: 'auto', paddingTop: 32, display: 'flex',
      justifyContent: 'space-between', alignItems: 'center',
      color: MUTED_2, fontFamily: FONT_MONO, fontSize: 11,
      letterSpacing: '0.1em', textTransform: 'uppercase',
    }}>
      <div>EN · UTC+05:30</div>
      <a href="/landing" style={{ color: INK_SOFT, textDecoration: 'none' }}>Need help?</a>
    </div>
  )
}

function Legal({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: MUTED_2, fontSize: 12.5, lineHeight: 1.5, margin: '22px 0 0' }}>{children}</p>
  )
}

function ActionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ia-action-shell" style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  )
}

function ActionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTED, marginBottom: 20 }}>
      {children}
    </div>
  )
}

function HAction({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: FONT_SANS, fontSize: 32, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.05, margin: '0 0 10px', color: INK }}>
      {children}
    </h2>
  )
}

function PAction({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: MUTED, fontSize: 15.5, lineHeight: 1.5, margin: '0 0 28px' }}>{children}</p>
  )
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: light ? 'rgba(240,238,230,0.55)' : MUTED }}>
      {children}
    </div>
  )
}

function SerItalic({ children }: { children: React.ReactNode }) {
  return <em style={{ fontStyle: 'italic', fontFamily: FONT_SERIF, fontWeight: 400, letterSpacing: '-0.02em', display: 'inline-block', paddingRight: '0.18em' }}>{children}</em>
}

// ---------------------------------------------------------------------------
// State 01 — Loading
// ---------------------------------------------------------------------------

export function InviteLoadingState({ org }: { org?: string }) {
  return (
    <div className="ia-loading-stage ia-fade-in" style={{ fontFamily: FONT_SANS, WebkitFontSmoothing: 'antialiased' }}>
      {/* centered inner */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {/* gradient ring with spinning arc */}
        <div className="ia-ring-wrap" style={{
          width: 84, height: 84, borderRadius: 24,
          background: 'linear-gradient(140deg, #6a7dff, #4a5cf0, #2334b8)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 22px 60px -12px rgba(74,92,240,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}>
          <IconLoadingArc />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em', color: INK }}>
            Loading your <SerItalic>invitation</SerItalic>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTED }}>
            Verifying token{org ? ` · ${org}` : ''}
          </div>
        </div>

        <div className="ia-shimmer" />
      </div>

      {/* logo anchored at bottom */}
      <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 2, opacity: 0.55 }}>
        <BrandMark />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// State 02 — Invalid / Expired
// ---------------------------------------------------------------------------

export function InviteInvalidState({ errorMessage, onHomepage, onContact }: {
  errorMessage: string
  onHomepage: () => void
  onContact?: () => void
}) {
  return (
    <div className="ia-stage ia-fade-in" style={{ fontFamily: FONT_SANS, WebkitFontSmoothing: 'antialiased' }}>
      {/* LEFT */}
      <div className="ia-panel ia-panel-left">
        <LeftMeta right={<LiveDot label="Status · Expired" red />} />

        <div style={{ marginTop: 'auto', marginBottom: 'auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div>
            <Eyebrow light>Invitation · void</Eyebrow>
            <h1 style={{ fontFamily: FONT_SANS, fontSize: 'clamp(44px, 5.4vw, 72px)', lineHeight: 0.98, letterSpacing: '-0.035em', fontWeight: 600, color: '#f0eee6', margin: '18px 0 0' }}>
              No <SerItalic>longer</SerItalic><br />valid.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: 'rgba(240,238,230,0.7)', maxWidth: 460, margin: '22px 0 0' }}>
              This invitation link has expired or been revoked. Ask the workspace admin to send a fresh one, or contact support if this feels wrong.
            </p>
          </div>
        </div>

        <LeftFoot left="Last seen · 4 days ago" right="Ref · INV-7f3d-2a91" />
      </div>

      {/* RIGHT */}
      <div className="ia-panel ia-panel-right">
        <ActionShell>
          {/* red alert box */}
          <div style={{ width: 64, height: 64, borderRadius: 18, background: DAN_SOFT, color: DANGER, display: 'grid', placeItems: 'center', marginBottom: 18 }}>
            <IconAlert />
          </div>

          <ActionEyebrow>Error · 410</ActionEyebrow>
          <HAction>Invitation <SerItalic>expired</SerItalic></HAction>
          <PAction>{errorMessage || 'Tokens are valid for 7 days. Need a new one? Reach out to the person who invited you.'}</PAction>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn variant="primary" onClick={onHomepage}>
              Return to homepage <IconArrow />
            </Btn>
            {onContact && <Btn variant="light" onClick={onContact}>Contact support</Btn>}
          </div>

          <Legal>
            If you believe this is a mistake, email us at{' '}
            <a href="mailto:support@zopkit.com" style={{ color: INK_SOFT }}>support@zopkit.com</a>.
          </Legal>
        </ActionShell>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// State 03 — Sign In (unauthenticated)
// ---------------------------------------------------------------------------

export function InviteSignInState({ org, inviterName, inviterEmail, role, message, loading, onGoogleSignIn, googleLoading }: {
  org: string
  inviterName: string
  inviterEmail?: string
  role: string
  message?: string
  loading?: boolean
  onGoogleSignIn: () => void
  googleLoading: boolean
}) {
  const orgFirst = loading ? '…' : (org.split(' ')[0] || '…')
  return (
    <div className="ia-stage ia-fade-in" style={{ fontFamily: FONT_SANS, WebkitFontSmoothing: 'antialiased' }}>
      {/* LEFT */}
      <div className="ia-panel ia-panel-left">
        <LeftMeta right={<LiveDot label={loading ? 'Loading…' : 'Live · awaiting accept'} />} />

        <div style={{ marginTop: 'auto', marginBottom: 'auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div>
            <Eyebrow light>An invitation, just for you</Eyebrow>
            <h1 style={{ fontFamily: FONT_SANS, fontSize: 'clamp(44px, 5.4vw, 72px)', lineHeight: 0.98, letterSpacing: '-0.035em', fontWeight: 600, color: '#f0eee6', margin: '18px 0 0', opacity: loading ? 0.4 : 1, transition: 'opacity 0.3s' }}>
              Join your <SerItalic>team</SerItalic><br />at {orgFirst}.
            </h1>
          </div>

          <div style={{ opacity: loading ? 0.4 : 1, transition: 'opacity 0.3s' }}>
            {!loading && <InviterCard inviterName={inviterName} inviterEmail={inviterEmail} />}
            {!loading && message && (
              <div style={{ borderLeft: '2px solid rgba(240,238,230,0.2)', paddingLeft: 16, marginTop: 22, maxWidth: 460 }}>
                <p style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: 22, lineHeight: 1.35, color: 'rgba(240,238,230,0.85)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                  "{message}"
                </p>
              </div>
            )}
          </div>
        </div>

        <LeftFoot left={<TeammateStack />} right="" />
      </div>

      {/* RIGHT */}
      <div className="ia-panel ia-panel-right">
        <ActionShell>
          <RoleBadge role={loading ? '…' : role} />
          <ActionEyebrow>Sign in to accept</ActionEyebrow>
          <HAction>Accept your <SerItalic>invite</SerItalic></HAction>
          <PAction>Sign in with Google to join the workspace. We never post or message anyone on your behalf.</PAction>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn variant="light" onClick={onGoogleSignIn} disabled={loading || googleLoading}>
              <IconGoogle />
              {googleLoading ? 'Signing in…' : 'Continue with Google'}
            </Btn>
          </div>

          <Legal>
            By continuing you agree to our{' '}
            <a href="/terms" style={{ color: INK_SOFT }}>Terms</a> and acknowledge our{' '}
            <a href="/privacy" style={{ color: INK_SOFT }}>Privacy Policy</a>.
          </Legal>
        </ActionShell>
        <RightFoot />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// State 04 — Welcome Back (authenticated, not yet joined)
// ---------------------------------------------------------------------------

export function InviteWelcomeBackState({ org, inviterName, role, userEmail, userName, onJoin, onSwitch, joining }: {
  org: string
  inviterName: string
  role: string
  userEmail: string
  userName?: string
  onJoin: () => void
  onSwitch?: () => void
  joining: boolean
}) {
  const firstName = userName?.split(' ')[0] || userEmail.split('@')[0]
  return (
    <div className="ia-stage ia-fade-in" style={{ fontFamily: FONT_SANS, WebkitFontSmoothing: 'antialiased' }}>
      {/* LEFT */}
      <div className="ia-panel ia-panel-left">
        <LeftMeta right={<LiveDot label="Signed in · ready" />} />

        <div style={{ marginTop: 'auto', marginBottom: 'auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div>
            <Eyebrow light>Welcome back, {firstName}</Eyebrow>
            <h1 style={{ fontFamily: FONT_SANS, fontSize: 'clamp(44px, 5.4vw, 72px)', lineHeight: 0.98, letterSpacing: '-0.035em', fontWeight: 600, color: '#f0eee6', margin: '18px 0 0' }}>
              One <SerItalic>tap</SerItalic><br />to join.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: 'rgba(240,238,230,0.7)', maxWidth: 460, margin: '22px 0 0' }}>
              You're already signed in. Confirm below and we'll set up your seat in {org} right away.
            </p>
          </div>

          <div>
            <InviterCard inviterName={inviterName} inviterEmail={`Role · ${role}`} />
          </div>
        </div>

        <LeftFoot left={`Joining as · ${userEmail}`} right="SSO · GOOGLE" />
      </div>

      {/* RIGHT */}
      <div className="ia-panel ia-panel-right">
        <ActionShell>
          <RoleBadge role={role} />
          <ActionEyebrow>Final step · Confirm</ActionEyebrow>
          <HAction>Hi <SerItalic>{firstName}</SerItalic>, ready to dive in?</HAction>
          <PAction>
            You're signed in as <strong style={{ color: INK, fontWeight: 600 }}>{userEmail}</strong>. Tap below to accept your invitation and enter the workspace.
          </PAction>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn variant="primary" onClick={onJoin} disabled={joining}>
              {joining ? 'Joining…' : `Join ${org}`}
              {!joining && <IconArrow />}
            </Btn>
            {onSwitch && (
              <Btn variant="ghost" onClick={onSwitch}>Not you? Switch account →</Btn>
            )}
          </div>

          <Legal>By joining you accept the workspace's policies set by your admin. Your personal data stays with you.</Legal>
        </ActionShell>
        <RightFoot />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// State 05 — Joining (provisioning progress)
// ---------------------------------------------------------------------------

const JOIN_STEPS = [
  'Verifying invitation',
  'Creating your account',
  'Setting up workspace access',
  'Finalising',
]

type StepState = 'done' | 'active' | 'pending'

function stepState(idx: number, joinStep: number): StepState {
  if (joinStep > idx) return 'done'
  if (joinStep === idx) return 'active'
  return 'pending'
}

export function InviteJoiningState({ org, joinStep }: { org: string; joinStep: number }) {
  return (
    <div className="ia-joining-stage ia-fade-in" style={{ fontFamily: FONT_SANS, WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 560 }}>
        {/* Head */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Eyebrow light>Provisioning · {org}</Eyebrow>
          <h2 style={{ fontFamily: FONT_SANS, fontSize: 44, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: '#f0eee6', margin: '14px 0 12px' }}>
            Setting up <SerItalic>your</SerItalic> seat
          </h2>
          <p style={{ color: 'rgba(240,238,230,0.6)', fontSize: 15, maxWidth: 380, margin: '0 auto' }}>
            This takes just a few seconds. We're configuring access and notifying your team.
          </p>
        </div>

        {/* Step list */}
        <div style={{
          background: 'rgba(240,238,230,0.04)', border: '1px solid rgba(240,238,230,0.08)',
          borderRadius: 22, padding: 8, backdropFilter: 'blur(8px)',
        }}>
          {JOIN_STEPS.map((label, i) => {
            const s = stepState(i, joinStep)
            return (
              <div
                key={i}
                className={s === 'active' ? 'ia-step-row-active' : ''}
                style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 14, alignItems: 'center',
                  padding: '16px 18px', borderRadius: 14,
                  borderTop: i > 0 ? '1px solid rgba(240,238,230,0.06)' : 'none',
                  background: s === 'active' ? 'rgba(74,92,240,0.12)' : 'transparent',
                  transition: 'background 0.25s',
                }}
              >
                <div style={{
                  fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.08em',
                  color: s === 'pending' ? 'rgba(240,238,230,0.4)' : 'rgba(240,238,230,0.8)',
                }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{
                  fontSize: 15,
                  color: s === 'active' ? '#f0eee6' : s === 'done' ? 'rgba(240,238,230,0.85)' : 'rgba(240,238,230,0.55)',
                  fontWeight: s === 'active' ? 500 : 400,
                  transition: 'color 0.25s',
                }}>
                  {label}
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontFamily: FONT_MONO, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.14em',
                  color: s === 'done' ? '#6fe5a8' : s === 'active' ? ACCENT_2 : 'rgba(240,238,230,0.4)',
                }}>
                  <span
                    className={s === 'active' ? 'ia-step-row-active' : ''}
                    style={{
                      width: 7, height: 7, borderRadius: '50%', background: 'currentColor',
                      display: 'inline-block',
                      animation: s === 'active' ? 'ia-dot-pulse 1.8s ease-out infinite' : 'none',
                    }}
                  />
                  {s === 'done' ? 'Done' : s === 'active' ? 'Running' : 'Queued'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// State 06 — Success
// ---------------------------------------------------------------------------

export function InviteSuccessState({ org, role, userEmail, onOpenWorkspace }: {
  org: string
  role: string
  userEmail: string
  onOpenWorkspace: () => void
}) {
  const orgSlug = org.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="ia-stage ia-fade-in" style={{ fontFamily: FONT_SANS, WebkitFontSmoothing: 'antialiased' }}>
      {/* LEFT */}
      <div className="ia-panel ia-panel-left">
        <LeftMeta right={<LiveDot label="Welcome · seat active" />} />

        <div style={{ marginTop: 'auto', marginBottom: 'auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div>
            <Eyebrow light>You're in</Eyebrow>
            <h1 style={{ fontFamily: FONT_SANS, fontSize: 'clamp(44px, 5.4vw, 72px)', lineHeight: 0.98, letterSpacing: '-0.035em', fontWeight: 600, color: '#f0eee6', margin: '18px 0 0' }}>
              Welcome to<br /><SerItalic>{org}</SerItalic>.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: 'rgba(240,238,230,0.7)', maxWidth: 460, margin: '22px 0 0' }}>
              Your account has been provisioned and your teammates have been notified. Ready when you are.
            </p>
          </div>

          <TeammateStack />
        </div>

        <LeftFoot left="Joined · just now" right={`Role · ${role}`} />
      </div>

      {/* RIGHT */}
      <div className="ia-panel ia-panel-right">
        <ActionShell>
          {/* green success mark */}
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: 'linear-gradient(140deg, #6fe5a8, #1f9d57)', color: '#fff',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 14px 40px -10px rgba(31,157,87,0.5)',
            marginBottom: 24,
          }}>
            <IconCheck />
          </div>

          <ActionEyebrow>Status · 200 OK</ActionEyebrow>
          <HAction>You're <SerItalic>in</SerItalic>.</HAction>
          <PAction>Your seat at {org} is ready. A confirmation has been sent to {userEmail}.</PAction>

          {/* workspace preview chip */}
          <div style={{
            marginTop: 4, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16,
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(140deg, ${ACCENT_2}, ${ACCENT})`,
              color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 16,
            }}>
              {org[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 2 }}>{org}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, letterSpacing: '0.04em' }}>
                zopkit.com/{orgSlug}
              </div>
            </div>
            <div style={{ color: MUTED }}><IconArrow /></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            <Btn variant="primary" onClick={onOpenWorkspace}>
              Open workspace <IconArrow />
            </Btn>
          </div>

          <Legal>Pro tip · invite a teammate from your dashboard once you're signed in.</Legal>
        </ActionShell>
        <RightFoot />
      </div>
    </div>
  )
}
