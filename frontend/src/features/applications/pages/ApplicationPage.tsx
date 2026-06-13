import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useApplications } from '@/hooks/useApplications'
import { useUserContextSafe } from '@/contexts/UserContextProvider'
import { useAuth } from '@/lib/auth/cognito-auth'
import { LoadingState } from '@/features/applications/components/LoadingState'
import { CardEmpty } from '@/components/common/feedback/LoadingStates'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { Application } from '@/types/application'
import { config } from '@/lib/config'
import * as Popover from '@radix-ui/react-popover'
import {
  HeroAgentDemo,
  buildScenarios,
} from '@/features/applications/components/HeroAgentDemo'
import '@/features/applications/styles/marketplace.css'

const S = '"Helvetica Neue", Helvetica, Arial, sans-serif'

// ─── Reuse-tracking hook ───────────────────────────────────────────────────────

interface RecentlyUsedApp {
  appId: string
  appData: Application
  lastUsed: number
  usageCount: number
}

function useRecentlyUsedApps() {
  const [recentlyUsedApps, setRecentlyUsedApps] = useState<RecentlyUsedApp[]>(
    []
  )
  useEffect(() => {
    const stored = localStorage.getItem('recentlyUsedApps')
    if (stored) {
      try {
        setRecentlyUsedApps(JSON.parse(stored))
      } catch {
        /* ignore */
      }
    }
  }, [])
  const trackAppUsage = useCallback((app: Application) => {
    setRecentlyUsedApps((current) => {
      const appId = app.appId
      const filtered = current.filter((i) => i.appId !== appId)
      const updated = [
        {
          appId,
          appData: app,
          lastUsed: Date.now(),
          usageCount:
            (current.find((i) => i.appId === appId)?.usageCount || 0) + 1,
        },
        ...filtered.slice(0, 9),
      ]
      localStorage.setItem('recentlyUsedApps', JSON.stringify(updated))
      return updated
    })
  }, [])
  return { recentlyUsedApps, trackAppUsage }
}

// ─── SVG icon components ───────────────────────────────────────────────────────

const IconCRM = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
    <circle
      cx="16.5"
      cy="10.5"
      r="2.2"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M3 19c1-2.6 3.2-4 6-4s5 1.4 6 4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M15 18.5c.5-1.8 2-2.8 3.5-2.8s3 1 3.5 2.8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
)
const IconFinance = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="3.5"
      y="5"
      width="17"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M7 14h4M7 16.5h6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="16.5" cy="15" r="1.4" fill="currentColor" />
  </svg>
)
const IconHR = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M4.5 20c1-3.4 4-5 7.5-5s6.5 1.6 7.5 5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
)
const IconInventory = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 8l8-4 8 4-8 4-8-4z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M4 8v8l8 4 8-4V8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M12 12v8" stroke="currentColor" strokeWidth="1.8" />
  </svg>
)
const IconProcurement = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 6h2.5l2 10h10l2-7H8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <circle cx="10" cy="19.5" r="1.4" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="17" cy="19.5" r="1.4" stroke="currentColor" strokeWidth="1.8" />
  </svg>
)
const IconHelpdesk = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M5 18V9a7 7 0 1 1 14 0v9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <rect
      x="3"
      y="13"
      width="4"
      height="6"
      rx="1.4"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <rect
      x="17"
      y="13"
      width="4"
      height="6"
      rx="1.4"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M19 19v.5a2 2 0 0 1-2 2h-3"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
)
const IconDefault = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="3"
      y="3"
      width="8"
      height="8"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <rect
      x="13"
      y="3"
      width="8"
      height="8"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <rect
      x="3"
      y="13"
      width="8"
      height="8"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <rect
      x="13"
      y="13"
      width="8"
      height="8"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </svg>
)

// ─── Per-app style mapping ─────────────────────────────────────────────────────

interface AppStyle {
  glyphBg: string
  icon: ReactNode
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
  {
    glyphBg: 'linear-gradient(160deg, #1e3a8a 0%, #142a5e 100%)',
    icon: <IconDefault />,
    chip: 'Business Suite',
    foot: 'Included with workspace',
  },
  {
    glyphBg: 'linear-gradient(160deg, #0e7a6f 0%, #06544c 100%)',
    icon: <IconDefault />,
    chip: 'Business Suite',
    foot: 'Included with workspace',
  },
  {
    glyphBg: 'linear-gradient(150deg, #ff7a3d 0%, #e85a1c 100%)',
    icon: <IconDefault />,
    chip: 'Business Suite',
    foot: 'Included with workspace',
  },
]

function getAppStyle(appCode: string, index: number): AppStyle {
  const key = appCode.toLowerCase().replace(/[^a-z]/g, '')
  return APP_STYLES[key] ?? FALLBACK_GLYPHS[index % FALLBACK_GLYPHS.length]
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

function launchHost(application: Application): string {
  try {
    return new URL(getAppLaunchUrl(application)).host
  } catch {
    return ''
  }
}

// ─── Marketplace app card ──────────────────────────────────────────────────────

interface CardProps {
  application: Application
  index: number
  onLaunch: (app: Application) => void
  onDetails: (app: Application) => void
  canManage: boolean
}

const MarketplaceCard = memo(function MarketplaceCard({
  application,
  index,
  onLaunch,
  onDetails,
  canManage,
}: CardProps) {
  const style = getAppStyle(application.appCode || '', index)
  const host = launchHost(application)
  const moduleCount = application.enabledModules?.length ?? 0

  const launch = useCallback(
    () => onLaunch(application),
    [onLaunch, application]
  )

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        launch()
      }
    },
    [launch]
  )

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

  return (
    <div
      className="zkm-card"
      role="button"
      tabIndex={0}
      aria-label={`Open ${application.appName}`}
      onClick={launch}
      onKeyDown={onKeyDown}
      style={{ fontFamily: S }}
    >
      {/* Icon column */}
      <div
        style={{ background: '#eef1fb', display: 'grid', placeItems: 'center' }}
      >
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: 14,
            background: style.glyphBg,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            boxShadow: '0 1px 0 rgba(0,0,0,0.05)',
          }}
        >
          {style.icon}
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          padding: '16px 16px 16px 22px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          position: 'relative',
        }}
      >
        {/* Info popover — available to everyone */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="zkm-iconbtn"
              aria-label={`About ${application.appName}`}
              onClick={stop}
              onKeyDown={stop}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 28,
                height: 28,
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: '#9ca3af',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                padding: 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M12 11v6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="7.5" r="1" fill="currentColor" />
              </svg>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="zkm-pop"
              side="bottom"
              align="end"
              sideOffset={8}
              collisionPadding={12}
              onClick={stop}
              style={{
                zIndex: 200,
                width: 288,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                boxShadow: '0 12px 40px rgba(15,28,58,0.16)',
                padding: 16,
                fontFamily: S,
                color: '#0b1220',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: style.glyphBg,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      transform: 'scale(0.55)',
                      transformOrigin: 'center',
                    }}
                  >
                    {style.icon}
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: '-0.005em',
                      lineHeight: 1.2,
                    }}
                  >
                    {application.appName}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {style.chip}
                  </div>
                </div>
              </div>

              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: 12.5,
                  color: '#374151',
                  lineHeight: 1.5,
                }}
              >
                {application.description ||
                  'Access and manage this application from your workspace.'}
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  marginBottom: 14,
                  fontSize: 11.5,
                }}
              >
                <div>
                  <div style={{ color: '#9ca3af', marginBottom: 2 }}>
                    Status
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontWeight: 600,
                      color: application.isEnabled ? '#16a34a' : '#d97706',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'currentColor',
                      }}
                      aria-hidden="true"
                    />
                    {application.isEnabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#9ca3af', marginBottom: 2 }}>
                    Modules
                  </div>
                  <div style={{ fontWeight: 600, color: '#0b1220' }}>
                    {moduleCount > 0 ? moduleCount : '—'}
                  </div>
                </div>
                {host && (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#9ca3af', marginBottom: 2 }}>
                      Opens at
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: '#0b1220',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 110,
                      }}
                    >
                      {host}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Popover.Close asChild>
                  <button
                    type="button"
                    className="zkm-popbtn zkm-popbtn-primary"
                    onClick={launch}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#142a5e',
                      color: '#fff',
                      fontFamily: S,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Open app
                  </button>
                </Popover.Close>
                {canManage && (
                  <Popover.Close asChild>
                    <button
                      type="button"
                      className="zkm-popbtn zkm-popbtn-ghost"
                      onClick={() => onDetails(application)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        color: '#374151',
                        fontFamily: S,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Manage
                    </button>
                  </Popover.Close>
                )}
              </div>
              <Popover.Arrow style={{ fill: '#fff' }} width={14} height={7} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <h3
          style={{
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: '-0.005em',
            margin: '0 0 8px',
            paddingRight: 36,
          }}
        >
          {application.appName}
        </h3>
        <span
          style={{
            display: 'inline-block',
            background: '#e4e9f8',
            color: '#1e3a8a',
            fontSize: 11.5,
            fontWeight: 500,
            padding: '3px 8px',
            borderRadius: 3,
            marginBottom: 12,
            alignSelf: 'flex-start',
          }}
        >
          {style.chip}
        </span>
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.45,
            margin: '0 0 auto',
          }}
        >
          {application.description ||
            'Access and manage this application from your workspace.'}
        </p>
        <div
          style={{
            fontSize: 12.5,
            color: '#6b7280',
            paddingTop: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            style={{ flexShrink: 0 }}
            aria-hidden="true"
          >
            <path
              d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M15 3h6v6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 14L21 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {style.foot}
        </div>
      </div>
    </div>
  )
})

// ─── Available-apps section (search + category filter) ─────────────────────────

interface IndexedApp {
  app: Application
  index: number
  chip: string
}

function AvailableApps({
  applications,
  companyName,
  onLaunch,
  onDetails,
  canManage,
}: {
  applications: Application[]
  companyName: string
  onLaunch: (app: Application) => void
  onDetails: (app: Application) => void
  canManage: boolean
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  const indexed = useMemo<IndexedApp[]>(
    () =>
      applications.map((app, index) => ({
        app,
        index,
        chip: getAppStyle(app.appCode || '', index).chip,
      })),
    [applications]
  )

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(indexed.map((x) => x.chip)))],
    [indexed]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return indexed.filter(({ app, chip }) => {
      if (category !== 'All' && chip !== category) return false
      if (!q) return true
      return (
        (app.appName || '').toLowerCase().includes(q) ||
        (app.description || '').toLowerCase().includes(q) ||
        (app.appCode || '').toLowerCase().includes(q) ||
        chip.toLowerCase().includes(q)
      )
    })
  }, [indexed, query, category])

  const total = applications.length
  const showControls = total >= 2
  const showCategories = categories.length > 2 // more than just "All" + one
  const isFiltering = query.trim() !== '' || category !== 'All'

  const clear = useCallback(() => {
    setQuery('')
    setCategory('All')
  }, [])

  return (
    <section id="apps" className="zkm-section">
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: 'var(--foreground)',
                margin: '0 0 6px',
              }}
            >
              Available apps
            </h2>
            <p
              style={{
                fontSize: 14,
                color: 'var(--muted-foreground)',
                margin: 0,
              }}
              aria-live="polite"
            >
              {isFiltering
                ? `Showing ${filtered.length} of ${total} app${total !== 1 ? 's' : ''}`
                : `${total} module${total !== 1 ? 's' : ''} in your ${companyName} workspace.`}
            </p>
          </div>

          {showControls && (
            <div className="zkm-search">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M20 20l-3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <input
                className="zkm-searchinput"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search apps"
                aria-label="Search apps"
                style={{ fontFamily: S }}
              />
            </div>
          )}
        </div>

        {showControls && showCategories && (
          <div
            role="group"
            aria-label="Filter by category"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 24,
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className="zkm-chip"
                aria-pressed={category === cat}
                onClick={() => setCategory(cat)}
                style={{ fontFamily: S }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="zkm-grid">
            {filtered.map(({ app, index }) => (
              <MarketplaceCard
                key={app.appId}
                application={app}
                index={index}
                onLaunch={onLaunch}
                onDetails={onDetails}
                canManage={canManage}
              />
            ))}
          </div>
        ) : (
          <CardEmpty
            showHeader={false}
            icon={Search}
            title="No apps match your search"
            description="Try a different term or category."
            action={
              <Button type="button" variant="outline" size="sm" onClick={clear}>
                Clear filters
              </Button>
            }
          />
        )}
      </div>
    </section>
  )
}

// ─── Full marketplace view ────────────────────────────────────────────────────

function InvitedMarketplaceView({
  applications,
  onLaunch,
  onDetails,
}: {
  applications: Application[]
  onLaunch: (app: Application) => void
  onDetails: (app: Application) => void
}) {
  const ctx = useUserContextSafe()
  const { user: idpUser } = useAuth()
  const navigate = useNavigate()

  const user = ctx?.user ?? null
  const tenant = ctx?.tenant ?? null

  const isTenantAdmin = user?.isTenantAdmin ?? false

  // Prefer Kinde's explicit name fields (givenName + familyName) over user.name
  // which can hold the company/account name instead of the person's name.
  const idpFullName = [idpUser?.givenName, idpUser?.familyName]
    .filter(Boolean)
    .join(' ')
  const fullName =
    idpFullName || user?.name || idpUser?.email?.split('@')[0] || 'there'

  const companyName = tenant?.companyName || 'Zopkit'

  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours()
    return hour < 12
      ? 'Good morning'
      : hour < 17
        ? 'Good afternoon'
        : 'Good evening'
  }, [])

  const scenarios = useMemo(() => buildScenarios(applications), [applications])

  return (
    <div
      className="zkm-root"
      style={{
        fontFamily: S,
        WebkitFontSmoothing: 'antialiased',
        fontSize: 15,
        lineHeight: 1.5,
      }}
    >
      {/* ── Hero band ── */}
      <section
        className="zkm-hero"
        style={{
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Curved bottom */}
        <div
          className="zkm-hero-curve"
          style={{
            position: 'absolute',
            left: '-10%',
            right: '-10%',
            bottom: -180,
            height: 300,
            borderRadius: '50%',
            zIndex: 0,
          }}
          aria-hidden="true"
        />

        <div className="zkm-herogrid">
          {/* Left: copy */}
          <div>
            <div style={{ marginBottom: 22 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--foreground)',
                  textTransform: 'uppercase',
                }}
              >
                Welcome to{' '}
                <span style={{ color: 'var(--primary)' }}>
                  {companyName} Marketplace
                </span>
              </span>
            </div>

            <h1
              className="zkm-h1"
              style={{
                fontWeight: 800,
                lineHeight: 1.04,
                letterSpacing: '-0.025em',
                color: 'var(--foreground)',
                margin: '0 0 10px',
              }}
            >
              {timeGreeting}, {fullName}.
            </h1>

            <p
              style={{
                fontWeight: 600,
                fontSize: 20,
                lineHeight: 1.3,
                color: 'var(--primary)',
                letterSpacing: '-0.01em',
                margin: '0 0 18px',
              }}
            >
              The unified suite your business runs on.
            </p>

            <p
              style={{
                color: 'var(--muted-foreground)',
                fontSize: 15,
                lineHeight: 1.6,
                maxWidth: 460,
                margin: '0 0 36px',
              }}
            >
              Zopkit brings your entire operational stack together — scalable,
              secure, and purpose-built for running every part of your business
              from a single workspace.
            </p>

            {isTenantAdmin && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="zkm-cta"
                  onClick={() => navigate({ to: '/dashboard/organization' })}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '16px 26px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: '#142a5e',
                    color: '#fff',
                    border: '1.5px solid #142a5e',
                    minWidth: 200,
                  }}
                >
                  Admin Console →
                </button>
              </div>
            )}
          </div>

          {/* Right: interactive agent demo */}
          <HeroAgentDemo scenarios={scenarios} />
        </div>
      </section>

      {/* ── Available apps ── */}
      <AvailableApps
        applications={applications}
        companyName={companyName}
        onLaunch={onLaunch}
        onDetails={onDetails}
        canManage={isTenantAdmin}
      />
    </div>
  )
}

// ─── Main page component ───────────────────────────────────────────────────────

export function ApplicationPage() {
  const { applications, isLoading } = useApplications()
  const navigate = useNavigate()
  const { trackAppUsage } = useRecentlyUsedApps()

  const handleLaunch = useCallback(
    (app: Application) => {
      trackAppUsage(app)
      const url = getAppLaunchUrl(app)
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    [trackAppUsage]
  )

  const handleDetails = useCallback(
    (app: Application) => {
      navigate({ to: `/dashboard/applications/${app.appId}` })
    },
    [navigate]
  )

  if (isLoading) return <LoadingState />

  return (
    <InvitedMarketplaceView
      applications={applications}
      onLaunch={handleLaunch}
      onDetails={handleDetails}
    />
  )
}
