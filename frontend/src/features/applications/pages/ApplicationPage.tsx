import { useApplications } from "@/hooks/useApplications";
import { useNavigate } from "@tanstack/react-router";
import { useUserContextSafe } from "@/contexts/UserContextProvider";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { LoadingState } from "@/features/applications/components/LoadingState";
import { useState, useEffect } from "react";
import { Application } from "@/types/application";
import { config } from "@/lib/config";

// ─── Reuse-tracking hook ───────────────────────────────────────────────────────

function useRecentlyUsedApps() {
    const [recentlyUsedApps, setRecentlyUsedApps] = useState<any[]>([])
    useEffect(() => {
        const stored = localStorage.getItem('recentlyUsedApps')
        if (stored) {
            try { setRecentlyUsedApps(JSON.parse(stored)) } catch { /* ignore */ }
        }
    }, [])
    const trackAppUsage = (app: any) => {
        const appId = app.appId || app.id
        const current = [...recentlyUsedApps]
        const filtered = current.filter(i => i.appId !== appId)
        const updated = [{ appId, appData: app, lastUsed: Date.now(), usageCount: (current.find(i => i.appId === appId)?.usageCount || 0) + 1 }, ...filtered.slice(0, 9)]
        localStorage.setItem('recentlyUsedApps', JSON.stringify(updated))
        setRecentlyUsedApps(updated)
    }
    return { recentlyUsedApps, trackAppUsage }
}

// ─── SVG icon components ───────────────────────────────────────────────────────

const IconCRM = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16.5" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 19c1-2.6 3.2-4 6-4s5 1.4 6 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M15 18.5c.5-1.8 2-2.8 3.5-2.8s3 1 3.5 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
)
const IconFinance = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 14h4M7 16.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16.5" cy="15" r="1.4" fill="currentColor" />
    </svg>
)
const IconHR = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 20c1-3.4 4-5 7.5-5s6.5 1.6 7.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
)
const IconInventory = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
        <path d="M4 8l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M4 8v8l8 4 8-4V8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 12v8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
)
const IconProcurement = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
        <path d="M4 6h2.5l2 10h10l2-7H8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="10" cy="19.5" r="1.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17" cy="19.5" r="1.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
)
const IconHelpdesk = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
        <path d="M5 18V9a7 7 0 1 1 14 0v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="3" y="13" width="4" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
        <rect x="17" y="13" width="4" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19 19v.5a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
)
const IconDefault = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
)

// ─── Per-app style mapping ─────────────────────────────────────────────────────

interface AppStyle {
    glyphBg: string
    icon: React.ReactNode
    chip: string
    foot: string
}

const APP_STYLES: Record<string, AppStyle> = {
    crm: {
        glyphBg: 'linear-gradient(160deg, #1e3a8a 0%, #142a5e 100%)',
        icon: <IconCRM />,
        chip: 'Sales',
        foot: 'Included with workspace',
    },
    // Real appCode from API is 'accounting'
    accounting: {
        glyphBg: 'linear-gradient(160deg, #0e7a6f 0%, #06544c 100%)',
        icon: <IconFinance />,
        chip: 'Finance',
        foot: 'Included with workspace',
    },
    financialaccounting: {
        glyphBg: 'linear-gradient(160deg, #0e7a6f 0%, #06544c 100%)',
        icon: <IconFinance />,
        chip: 'Finance',
        foot: 'Included with workspace',
    },
    hr: {
        glyphBg: 'linear-gradient(150deg, #ff7a3d 0%, #e85a1c 100%)',
        icon: <IconHR />,
        chip: 'HR',
        foot: 'Included with workspace',
    },
    inventory: {
        glyphBg: '#0b1220',
        icon: <IconInventory />,
        chip: 'Operations',
        foot: 'Included with workspace',
    },
    procurement: {
        glyphBg: 'linear-gradient(160deg, #6c5ce7 0%, #4c3bbf 100%)',
        icon: <IconProcurement />,
        chip: 'Operations',
        foot: 'Included with workspace',
    },
    helpdesk: {
        glyphBg: 'linear-gradient(160deg, #be185d 0%, #831843 100%)',
        icon: <IconHelpdesk />,
        chip: 'Support',
        foot: 'Included with workspace',
    },
}

const FALLBACK_GLYPHS: AppStyle[] = [
    { glyphBg: 'linear-gradient(160deg, #1e3a8a 0%, #142a5e 100%)', icon: <IconDefault />, chip: 'Business Suite', foot: 'Included with workspace' },
    { glyphBg: 'linear-gradient(160deg, #0e7a6f 0%, #06544c 100%)', icon: <IconDefault />, chip: 'Business Suite', foot: 'Included with workspace' },
    { glyphBg: 'linear-gradient(150deg, #ff7a3d 0%, #e85a1c 100%)', icon: <IconDefault />, chip: 'Business Suite', foot: 'Included with workspace' },
]

function getAppStyle(appCode: string, index: number): AppStyle {
    const key = appCode.toLowerCase().replace(/[^a-z]/g, '')
    return APP_STYLES[key] ?? FALLBACK_GLYPHS[index % FALLBACK_GLYPHS.length]
}

// ─── Browser-window hero preview ──────────────────────────────────────────────

function HeroPreview() {
    const S = '"Helvetica Neue", Helvetica, Arial, sans-serif'
    return (
        <div style={{
            background: '#fff',
            borderRadius: 6,
            boxShadow: '0 1px 0 rgba(15,28,58,0.04), 0 24px 60px rgba(15,28,58,0.12), 0 8px 20px rgba(15,28,58,0.05)',
            overflow: 'hidden',
            width: '100%',
            maxWidth: 640,
            marginLeft: 'auto',
        }}>
            {/* Title bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#f0f1f4', borderBottom: '1px solid #e2e4ea' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <i style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff605c', display: 'inline-block' }} />
                    <i style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd44', display: 'inline-block' }} />
                    <i style={{ width: 11, height: 11, borderRadius: '50%', background: '#00ca4e', display: 'inline-block' }} />
                </div>
                <div style={{ background: '#fff', borderRadius: '5px 5px 0 0', padding: '4px 14px 4px 10px', fontFamily: S, fontSize: 11.5, color: '#4b5563', display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #e2e4ea', borderBottom: 'none', position: 'relative', top: 1 }}>
                    zopkit <span style={{ color: '#9ca3af', fontSize: 13 }}>×</span>
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#fff', borderBottom: '1px solid #eef0f5' }}>
                <div style={{ display: 'flex', gap: 6, color: '#9ca3af' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8a5 5 0 1 0 1.5-3.5L3 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M3 3v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={{ flex: 1, height: 24, background: '#f0f1f4', borderRadius: 12, padding: '0 12px', display: 'flex', alignItems: 'center', fontFamily: S, fontSize: 11.5, color: '#6b7280' }}>
                    app.zopkit.com
                </div>
                <div style={{ color: '#9ca3af' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M3 8h10M3 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </div>
            </div>

            {/* Stage — faux CRM dashboard */}
            <div style={{ background: '#fbfbf9', padding: '28px 30px 30px', minHeight: 280 }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    <div style={{ width: 18, height: 18, background: '#142a5e', borderRadius: 4, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: S }}>z</div>
                    <span style={{ fontFamily: S, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: '#111827' }}>Zopkit</span>
                </div>

                <p style={{ fontFamily: S, fontSize: 13.5, color: '#1f2937', margin: '0 0 10px', fontWeight: 600 }}>
                    Sure thing, here's a summary on Project Atlas:
                </p>
                <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none' }}>
                    {[
                        'Project Atlas feedback summary:',
                        'Early proposals show strong creative potential',
                        'Stakeholders are excited about how adaptable these ideas could be',
                        'We are on track for a November 2025 launch 🎉',
                    ].map((line, i) => (
                        <li key={i} style={{ fontFamily: S, fontSize: 12.5, color: '#374151', lineHeight: 1.8, paddingLeft: 14, position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 0, color: '#6b7280' }}>•</span>
                            {line}
                        </li>
                    ))}
                </ul>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: S, fontSize: 11.5, color: '#6b7280', marginBottom: 8 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: 'linear-gradient(135deg, #1e3a8a, #2a4ec0)', display: 'inline-block' }} />
                    zopkit · crm
                </div>

                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 4, padding: '10px 14px', fontFamily: S, fontSize: 12.5, color: '#1f2937', display: 'inline-block', marginBottom: 16, boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                    Please send to #proj-atlas in Zopkit
                </div>

                <p style={{ fontFamily: S, fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 18 }}>
                    I sent the message to #proj-atlas on your behalf.<br />
                    You can <span style={{ color: '#142a5e', textDecoration: 'underline' }}>follow the conversation here</span>.
                </p>

                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 8px' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 4, background: '#142a5e', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11 }}>↑</div>
                </div>
            </div>
        </div>
    )
}

// ─── Resolve app launch URL (mirrors ApplicationDetailsPage logic) ─────────────

function getAppLaunchUrl(application: Application): string {
    if (application.baseUrl) return application.baseUrl
    const origin = window.location.origin
    const patterns: Record<string, string> = {
        crm: config.CRM_DOMAIN,
        hr: `${origin}/hr`,
        affiliateconnect: `${origin}/affiliate`,
    }
    const key = (application.appCode || '').toLowerCase().replace(/[^a-z]/g, '')
    return patterns[key] || `${origin}/apps/${application.appCode}`
}

// ─── Marketplace app card ──────────────────────────────────────────────────────

function MarketplaceCard({ application, index, onLaunch, onDetails, showDetails }: {
    application: Application
    index: number
    onLaunch: (app: Application) => void
    onDetails: (app: Application) => void
    showDetails: boolean
}) {
    const [hover, setHover] = useState(false)
    const [detailsHover, setDetailsHover] = useState(false)
    const style = getAppStyle(application.appCode || '', index)
    const S = '"Helvetica Neue", Helvetica, Arial, sans-serif'

    return (
        <div
            role="button"
            tabIndex={0}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={() => onLaunch(application)}
            onKeyDown={e => e.key === 'Enter' && onLaunch(application)}
            style={{
                display: 'grid',
                gridTemplateColumns: '174px 1fr',
                background: '#fff',
                border: `1px solid ${hover ? '#cbd2dc' : '#e5e7eb'}`,
                borderRadius: 6,
                overflow: 'hidden',
                minHeight: 174,
                boxShadow: hover ? '0 4px 20px rgba(15,28,58,0.08)' : '0 1px 0 rgba(15,28,58,0.03)',
                transition: 'border-color 0.12s ease, box-shadow 0.15s ease',
                cursor: 'pointer',
                color: 'inherit',
            }}
        >
            {/* Icon column */}
            <div style={{ background: '#eef1fb', display: 'grid', placeItems: 'center' }}>
                <div style={{
                    width: 78,
                    height: 78,
                    borderRadius: 14,
                    background: style.glyphBg,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.05)',
                }}>
                    {style.icon}
                </div>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 16px 16px 22px', display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
                {/* Details icon — top right, admins only */}
                {showDetails && <button
                    title="View details"
                    aria-label={`View details for ${application.appName}`}
                    onMouseEnter={e => { e.stopPropagation(); setDetailsHover(true) }}
                    onMouseLeave={e => { e.stopPropagation(); setDetailsHover(false) }}
                    onClick={e => { e.stopPropagation(); onDetails(application) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onDetails(application) } }}
                    style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: 'none',
                        background: detailsHover ? '#e4e9f8' : 'transparent',
                        color: detailsHover ? '#1e3a8a' : '#9ca3af',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        transition: 'background 0.12s ease, color 0.12s ease',
                        flexShrink: 0,
                        padding: 0,
                    }}
                >
                    {/* Info circle icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M12 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        <circle cx="12" cy="7.5" r="1" fill="currentColor" />
                    </svg>
                </button>}

                <h3 style={{ fontFamily: S, fontSize: 17, fontWeight: 700, color: '#0b1220', letterSpacing: '-0.005em', margin: '0 0 8px', paddingRight: showDetails ? 32 : 0 }}>
                    {application.appName}
                </h3>
                <span style={{
                    display: 'inline-block',
                    background: '#e4e9f8',
                    color: '#1e3a8a',
                    fontFamily: S,
                    fontSize: 11.5,
                    fontWeight: 500,
                    padding: '3px 8px',
                    borderRadius: 3,
                    marginBottom: 12,
                    alignSelf: 'flex-start',
                }}>
                    {style.chip}
                </span>
                <p style={{ fontFamily: S, fontSize: 13.5, color: '#1f2937', lineHeight: 1.45, margin: '0 0 auto' }}>
                    {application.description || 'Access and manage this application from your workspace.'}
                </p>
                <div style={{ fontFamily: S, fontSize: 12.5, color: '#6b7280', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M15 3h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {style.foot}
                </div>
            </div>
        </div>
    )
}

// ─── Full marketplace view ────────────────────────────────────────────────────

function InvitedMarketplaceView({ applications, onLaunch, onDetails }: {
    applications: Application[]
    onLaunch: (app: Application) => void
    onDetails: (app: Application) => void
}) {
    const S = '"Helvetica Neue", Helvetica, Arial, sans-serif'
    const ctx = useUserContextSafe()
    const { user: kindeUser } = useKindeAuth()
    const navigate = useNavigate()

    const user = ctx?.user ?? null
    const tenant = ctx?.tenant ?? null

    const isTenantAdmin = user?.isTenantAdmin ?? false

    // Prefer Kinde's explicit name fields (givenName + familyName) over user.name
    // which can hold the company/account name instead of the person's name.
    const kindeFullName = [kindeUser?.givenName, kindeUser?.familyName].filter(Boolean).join(' ')
    const fullName = kindeFullName || user?.name || kindeUser?.email?.split('@')[0] || 'there'

    const companyName = tenant?.companyName || 'Zopkit'
    const logoUrl = (tenant as any)?.logoUrl as string | undefined

    const hour = new Date().getHours()
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

    return (
        <div style={{ fontFamily: S, color: '#0b1220', background: '#fff', WebkitFontSmoothing: 'antialiased', fontSize: 15, lineHeight: 1.5 }}>


            {/* ── Hero band ── */}
            <section style={{
                position: 'relative',
                background: 'radial-gradient(900px 480px at 92% 30%, #e2eefc 0%, transparent 60%), linear-gradient(180deg, #f5faff 0%, #eaf3fd 90%)',
                padding: '90px 64px 160px',
                overflow: 'hidden',
            }}>
                {/* Curved white bottom */}
                <div style={{ position: 'absolute', left: '-10%', right: '-10%', bottom: -180, height: 300, background: '#fff', borderRadius: '50%', zIndex: 0 }} />

                <div style={{
                    position: 'relative', zIndex: 1,
                    maxWidth: 1280, margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)',
                    gap: 56, alignItems: 'center',
                }}>
                    {/* Left: copy */}
                    <div>
                        {/* Eyebrow */}
                        <div style={{ marginBottom: 22 }}>
                            <span style={{ fontFamily: S, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: '#0b1220', textTransform: 'uppercase' }}>
                                Welcome to{' '}
                                <span style={{ color: '#142a5e' }}>{companyName} Marketplace</span>
                            </span>
                        </div>

                        {/* Greeting headline */}
                        <h1 style={{ fontFamily: S, fontWeight: 800, fontSize: 56, lineHeight: 1.04, letterSpacing: '-0.025em', color: '#0b1220', margin: '0 0 10px' }}>
                            {timeGreeting}, {fullName}.
                        </h1>

                        {/* Tagline */}
                        <p style={{ fontFamily: S, fontWeight: 600, fontSize: 20, lineHeight: 1.3, color: '#142a5e', letterSpacing: '-0.01em', margin: '0 0 18px' }}>
                            The unified suite your business runs on.
                        </p>

                        <p style={{ color: '#1f2937', fontSize: 15, lineHeight: 1.6, maxWidth: 460, margin: '0 0 36px' }}>
                            Zopkit brings your entire operational stack together — scalable, secure, and purpose-built for running every part of your business from a single workspace.
                        </p>

                        {/* Admin console CTA — only visible to tenant admins */}
                        {isTenantAdmin && (
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button
                                    onClick={() => navigate({ to: '/dashboard/organization' })}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        fontFamily: S, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                                        padding: '16px 26px', borderRadius: 4, cursor: 'pointer',
                                        background: '#142a5e', color: '#fff', border: '1.5px solid #142a5e',
                                        minWidth: 200, transition: 'background 0.15s ease',
                                    }}
                                >
                                    Admin Console →
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: browser preview */}
                    <HeroPreview />
                </div>
            </section>

            {/* ── Available apps ── */}
            <section id="apps" style={{ background: '#fff', padding: '36px 64px 100px' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                    <h2 style={{ fontFamily: S, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: '#0b1220', margin: '0 0 6px' }}>
                        Available apps
                    </h2>
                    <p style={{ fontFamily: S, fontSize: 14, color: '#4b5563', margin: '0 0 28px' }}>
                        {applications.length} module{applications.length !== 1 ? 's' : ''} in your {companyName} workspace.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20 }}>
                        {applications.map((app, i) => (
                            <MarketplaceCard
                                key={app.appId}
                                application={app}
                                index={i}
                                onLaunch={onLaunch}
                                onDetails={onDetails}
                                showDetails={isTenantAdmin}
                            />
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}

// ─── Main page component ───────────────────────────────────────────────────────

export function ApplicationPage() {
    const { applications, isLoading } = useApplications();
    const navigate = useNavigate();
    const { trackAppUsage } = useRecentlyUsedApps();

    if (isLoading) return <LoadingState />;

    const handleLaunch = (app: Application) => {
        trackAppUsage(app)
        const url = getAppLaunchUrl(app)
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const handleDetails = (app: Application) => {
        navigate({ to: `/dashboard/applications/${app.appId}` })
    }

    return <InvitedMarketplaceView applications={applications} onLaunch={handleLaunch} onDetails={handleDetails} />;
}
