import { Link, useLocation } from "@tanstack/react-router"
import { useSidebar } from "@/components/ui/sidebar"
import { useKindeAuth } from "@kinde-oss/kinde-auth-react"
import { useEffect, useState } from "react"
import {
    LayoutGrid,
    Building2,
    Users,
    Shield,
    Activity,
    CreditCard,
    Settings,
    LogOut,
} from "lucide-react"

const ADMIN_ONLY_URLS = [
    '/dashboard/organization',
    '/dashboard/roles',
    '/dashboard/activity',
    '/dashboard/billing',
    '/dashboard/settings',
]

interface NavItemDef {
    title: string
    url: string
    icon: React.ElementType
    badge?: number
}

interface NavGroup {
    label: string
    items: NavItemDef[]
}

function ZopkitLogo({ size = 38 }: { size?: number }) {
    return (
        <div style={{
            width: size,
            height: size,
            borderRadius: 10,
            background: 'var(--zk-navy)',
            display: 'grid',
            placeItems: 'center',
            color: 'white',
            fontFamily: 'var(--zk-display)',
            fontSize: size * 0.47,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
        }}>
            <span style={{ position: 'relative', zIndex: 1 }}>z</span>
            <div style={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#bfd0fa',
                animation: 'zk-pulseDot 2s ease-in-out infinite',
            }} />
        </div>
    )
}

function TenantLogo({
    logoUrl,
    companyName,
    size = 38,
}: {
    logoUrl?: string | null
    companyName?: string | null
    size?: number
}) {
    const [imageFailed, setImageFailed] = useState(false)
    const safeUrl = typeof logoUrl === 'string' ? logoUrl.trim() : ''
    const initial = (companyName || 'Z').charAt(0).toUpperCase()

    useEffect(() => {
        setImageFailed(false)
    }, [safeUrl])

    if (safeUrl && !imageFailed) {
        return (
            <div style={{
                width: size, height: size,
                borderRadius: 10,
                background: 'var(--zk-paper)',
                border: '1px solid var(--zk-line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
            }}>
                <img
                    src={safeUrl}
                    alt=""
                    role="presentation"
                    decoding="async"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
            </div>
        )
    }

    return (
        <div style={{
            width: size, height: size,
            borderRadius: 10,
            background: 'linear-gradient(140deg, #1c3a8f 0%, #0a1638 100%)',
            display: 'grid', placeItems: 'center',
            color: 'white',
            fontFamily: 'var(--zk-display)',
            fontSize: size * 0.47,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            flexShrink: 0,
        }}>
            {initial}
        </div>
    )
}

function SidebarNavItem({
    item,
    isActive,
    isCollapsed,
}: {
    item: NavItemDef
    isActive: boolean
    isCollapsed: boolean
}) {
    const [hover, setHover] = useState(false)
    const Ico = item.icon

    return (
        <Link
            to={item.url}
            title={isCollapsed ? item.title : undefined}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: isCollapsed ? '10px 0' : '8px 12px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                borderRadius: 9,
                color: isActive ? '#ffffff' : (hover ? '#ffffff' : 'var(--zk-navy-muted)'),
                background: isActive ? 'rgba(255,255,255,0.16)' : (hover ? 'rgba(255,255,255,0.08)' : 'transparent'),
                border: isActive ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
                boxShadow: isActive ? '0 6px 16px -8px rgba(0,0,0,0.45)' : 'none',
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                letterSpacing: '-0.005em',
                textAlign: 'left',
                position: 'relative',
                transition: 'all 160ms ease',
                textDecoration: 'none',
                fontFamily: 'var(--zk-font)',
            }}
        >
            {isActive && !isCollapsed && (
                <span style={{
                    position: 'absolute',
                    left: -14,
                    top: '50%',
                    width: 3,
                    height: 18,
                    transform: 'translateY(-50%)',
                    background: 'var(--zk-navy)',
                    borderRadius: '0 3px 3px 0',
                }} />
            )}
            <Ico size={15} strokeWidth={isActive ? 1.9 : 1.65} />
            {!isCollapsed && (
                <>
                    <span style={{ flex: 1 }}>{item.title}</span>
                    {item.badge !== undefined && (
                        <span style={{
                            fontSize: 10,
                            fontWeight: 500,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                            color: isActive ? '#ffffff' : 'var(--zk-navy-muted)',
                            fontFamily: 'var(--zk-mono)',
                        }}>
                            {item.badge}
                        </span>
                    )}
                </>
            )}
        </Link>
    )
}

export function ModernSidebar({
    navData,
    userData,
    tenantData,
    isTenantAdmin = false,
    className,
}: {
    navData?: any
    userData?: any
    tenantData?: { companyName?: string; logoUrl?: string }
    isTenantAdmin?: boolean
    onOrganizationSwitch?: (organizationId: string) => void
    className?: string
}) {
    const { state } = useSidebar()
    const { logout } = useKindeAuth()
    const location = useLocation()
    const isCollapsed = state === "collapsed"

    const rawNavMain: NavItemDef[] = navData?.navMain || [
        { title: "Applications", url: "/dashboard/applications", icon: LayoutGrid },
        { title: "Organization", url: "/dashboard/organization", icon: Building2 },
        { title: "Team", url: "/dashboard/users", icon: Users },
        { title: "Roles", url: "/dashboard/roles", icon: Shield },
        { title: "Activity", url: "/dashboard/activity", icon: Activity },
    ]

    const rawBottomNav: NavItemDef[] = [
        { title: "Billing", url: "/dashboard/billing", icon: CreditCard },
        { title: "Settings", url: "/dashboard/settings", icon: Settings },
    ]

    const mainNavItems = isTenantAdmin
        ? rawNavMain
        : rawNavMain.filter((item) => !ADMIN_ONLY_URLS.some(u => item.url.startsWith(u)))

    const bottomNavItems = isTenantAdmin
        ? rawBottomNav
        : rawBottomNav.filter((item) => !ADMIN_ONLY_URLS.some(u => item.url.startsWith(u)))

    const navGroups: NavGroup[] = [
        { label: 'Workspace', items: mainNavItems },
        { label: 'Account', items: bottomNavItems },
    ]

    const allItems = [...mainNavItems, ...bottomNavItems]
    const activeItem = allItems.find(item => location.pathname.startsWith(item.url))

    const user = {
        name: userData?.name || "User",
        email: userData?.email || "user@example.com",
        avatar: userData?.avatar || "",
    }

    const companyName = tenantData?.companyName || 'Zopkit'
    const userInitials = user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'ZO'

    const w = isCollapsed ? 78 : 256

    return (
        <aside
            className={className}
            style={{
                width: w,
                flexShrink: 0,
                background: 'var(--zk-navy)',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 14px',
                gap: 22,
                position: 'sticky',
                top: 0,
                height: '100vh',
                transition: 'width 320ms cubic-bezier(.2,.8,.2,1)',
                overflow: 'hidden',
                borderRight: '1px solid var(--zk-navy-line)',
                fontFamily: 'var(--zk-font)',
            }}
        >
            {/* Logo */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '0 6px',
            }}>
                {tenantData?.logoUrl ? (
                    <TenantLogo logoUrl={tenantData.logoUrl} companyName={companyName} size={38} />
                ) : (
                    <ZopkitLogo size={38} />
                )}
                {!isCollapsed && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                        animation: 'zk-fadeIn 240ms ease both',
                    }}>
                        <span style={{
                            fontSize: 18,
                            fontWeight: 600,
                            letterSpacing: '-0.035em',
                            fontFamily: 'var(--zk-display)',
                            color: '#ffffff',
                            lineHeight: 1.2,
                        }}>
                            {companyName.toLowerCase()}
                            <span style={{ color: 'var(--zk-navy-muted)' }}>.</span>
                        </span>
                    </div>
                )}
            </div>

            {/* Nav groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1, minHeight: 0 }}>
                {navGroups.map((group, gi) => (
                    <nav key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {!isCollapsed && group.items.length > 0 && (
                            <span style={{
                                fontSize: 9.5,
                                fontWeight: 500,
                                color: 'var(--zk-navy-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.16em',
                                padding: '4px 12px 10px',
                                fontFamily: 'var(--zk-mono)',
                            }}>
                                {group.label}
                            </span>
                        )}
                        {group.items.map(item => (
                            <SidebarNavItem
                                key={item.url}
                                item={item}
                                isActive={activeItem?.url === item.url}
                                isCollapsed={isCollapsed}
                            />
                        ))}
                    </nav>
                ))}
            </div>

            {/* Workspace card */}
            {!isCollapsed && (
                <div style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    animation: 'zk-fadeIn 320ms ease both',
                }}>
                    <div style={{
                        fontSize: 10,
                        fontFamily: 'var(--zk-mono)',
                        color: 'var(--zk-navy-muted)',
                        letterSpacing: '0.12em',
                        marginBottom: 4,
                    }}>
                        WORKSPACE
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#ffffff', letterSpacing: '-0.01em' }}>
                        Production
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--zk-navy-muted)', marginTop: 2 }}>
                        zopkit.app
                    </div>
                </div>
            )}

            {/* User card */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: isCollapsed ? 6 : '8px 10px 8px 8px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                flexShrink: 0,
            }}>
                <div style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 9,
                    background: 'linear-gradient(140deg, #1c3a8f, #0a1638)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    fontFamily: 'var(--zk-display)',
                }}>
                    {userInitials}
                </div>
                {!isCollapsed && (
                    <>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: 0,
                            flex: 1,
                            animation: 'zk-fadeIn 200ms ease both',
                        }}>
                            <span style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                letterSpacing: '-0.005em',
                                color: '#ffffff',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {user.name}
                            </span>
                            <span style={{
                                fontSize: 10.5,
                                color: 'var(--zk-navy-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {user.email}
                            </span>
                        </div>
                        <button
                            onClick={() => logout()}
                            title="Sign out"
                            style={{
                                color: 'var(--zk-navy-muted)',
                                display: 'grid',
                                placeItems: 'center',
                                padding: 4,
                                borderRadius: 6,
                                transition: 'color 160ms ease',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ffffff' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--zk-navy-muted)' }}
                        >
                            <LogOut size={14} />
                        </button>
                    </>
                )}
            </div>
        </aside>
    )
}
