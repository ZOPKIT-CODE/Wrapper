import { cn } from "@/lib/utils"
import { Link, useLocation } from "@tanstack/react-router"
import { useSidebar } from "@/components/ui/sidebar"
import { useKindeAuth } from "@kinde-oss/kinde-auth-react"
import { useEffect, useState } from "react"
import {
    LayoutDashboard,
    Users,
    Building2,
    Shield,
    CreditCard,
    Settings,
    LogOut,
    Activity,
} from "lucide-react"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"

// Extract NavItem component OUTSIDE of ModernSidebar to prevent re-mounting
const NavItem = ({ item, isActive, isCollapsed }: { item: any; isActive: boolean; isCollapsed: boolean }) => {
    return (
        <Link
            to={item.url}
            className={cn(
                "relative flex items-center gap-4 px-8 py-4 overflow-visible group"
            )}
        >
            {/* Active Background with cutout effect */}
            {isActive && (
                <>
                    {/* Main white background tab */}
                    <div
                        className="absolute inset-0 bg-white rounded-l-[32px]"
                        style={{
                            right: '-16px', // Extend to perfectly reach the sidebar edge (compensating for px-4 on parent)
                        }}
                    >
                        {/* Top Cutout Curve (Inverse Border Radius) */}
                        <div
                            className="absolute -top-5 right-0 w-5 h-5 bg-white pointer-events-none"
                        >
                            <div className="w-full h-full bg-[#1B2E5A] rounded-br-[20px]" />
                        </div>

                        {/* Bottom Cutout Curve (Inverse Border Radius) */}
                        <div
                            className="absolute -bottom-5 right-0 w-5 h-5 bg-white pointer-events-none"
                        >
                            <div className="w-full h-full bg-[#1B2E5A] rounded-tr-[20px]" />
                        </div>
                    </div>
                </>
            )}

            {/* Icon */}
            <div className={cn(
                "relative z-10",
                isActive ? "text-[#1B2E5A]" : "text-white"
            )}>
                <item.icon className="size-5" />
            </div>

            {/* Label */}
            {!isCollapsed && (
                <span className={cn(
                    "relative z-10 font-black text-sm tracking-tight",
                    isActive ? "text-[#1B2E5A]" : "text-white"
                )}>
                    {item.title}
                </span>
            )}
        </Link>
    )
}

const ADMIN_ONLY_URLS = [
    '/dashboard/organization',
    '/dashboard/roles',
    '/dashboard/activity',
    '/dashboard/billing',
    '/dashboard/settings',
]

export function ModernSidebar({
    navData,
    userData,
    isTenantAdmin = false,
    className,
}: {
    navData?: any
    userData?: any
    isTenantAdmin?: boolean
    className?: string
}) {
    const { state } = useSidebar()
    const { logout } = useKindeAuth()
    const location = useLocation()
    const isCollapsed = state === "collapsed"

    const allMainNavItems = navData?.navMain || [
        { title: "Applications", url: "/dashboard/applications", icon: LayoutDashboard },
        { title: "Organization", url: "/dashboard/organization", icon: Building2 },
        { title: "Roles", url: "/dashboard/roles", icon: Shield },
        { title: "Activity", url: "/dashboard/activity", icon: Activity },
    ]

    const allBottomItems = [
        { title: "Billing", url: "/dashboard/billing", icon: CreditCard },
        { title: "Settings", url: "/dashboard/settings", icon: Settings },
    ]

    const mainNavItems = isTenantAdmin
        ? allMainNavItems
        : allMainNavItems.filter((item: any) => !ADMIN_ONLY_URLS.some(u => item.url.startsWith(u)))

    const bottomItems = isTenantAdmin
        ? allBottomItems
        : allBottomItems.filter((item: any) => !ADMIN_ONLY_URLS.some(u => item.url.startsWith(u)))

    const [activeItem, setActiveItem] = useState<string>(() => {
        const allItems = [...mainNavItems, ...bottomItems]
        const currentItem = allItems.find(item => location.pathname.startsWith(item.url))
        return currentItem ? currentItem.title : ""
    })

    const user = {
        name: userData?.name || "User",
        email: userData?.email || "user@example.com",
        avatar: userData?.avatar || ""
    }

    useEffect(() => {
        const allItems = [...mainNavItems, ...bottomItems]
        const currentItem = allItems.find(item => location.pathname.startsWith(item.url))
        if (currentItem) {
            setActiveItem(currentItem.title)
        }
    }, [location.pathname])

    return (
        <div
            className={cn(
                "relative flex flex-col h-screen transition-[width] duration-100 ease-out z-40 will-change-[width]",
                "bg-[#1B2E5A]",
                isCollapsed ? "w-[100px]" : "w-[280px]",
                "rounded-tr-[40px] rounded-br-[40px]",
                className
            )}
        >
            {/* Branding Section */}
            <div className="pt-12 pb-10 px-8 flex items-center gap-4 relative z-10 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-white/25 flex items-center justify-center shadow-xl border border-white/20">
                    <span className="text-white font-black text-2xl">Z</span>
                </div>
                {!isCollapsed && (
                    <h1 className="text-white text-2xl font-black tracking-tight">
                        Zopkit
                    </h1>
                )}
            </div>

            {/* Top Navigation Bundle */}
            <div className="flex flex-col gap-1 relative overflow-visible px-4 shrink-0">
                {mainNavItems.map((item: any) => (
                    <NavItem key={item.title} item={item} isActive={activeItem === item.title} isCollapsed={isCollapsed} />
                ))}
            </div>

            {/* Flexible Spacer - This pushes bottom items down */}
            <div className="flex-grow" />

            {/* Bottom Utilities Bundle - Fixed at bottom */}
            <div className="flex flex-col shrink-0 px-4 pb-4">
                <div className="flex flex-col gap-1 relative overflow-visible">
                    {bottomItems.map((item: any) => (
                        <NavItem key={item.title} item={item} isActive={activeItem === item.title} isCollapsed={isCollapsed} />
                    ))}
                </div>
            </div>

            {/* Profile Section */}
            <div className="p-4 bg-black/15 border-t border-white/5 relative z-10 shrink-0">
                <div className={cn(
                    "flex items-center gap-3 p-2 rounded-2xl",
                    isCollapsed ? "justify-center" : "justify-start"
                )}>
                    <Avatar className="h-10 w-10 border-2 border-white/20 shadow-lg">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback className="bg-sky-400 text-white font-black">
                            {user.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    {!isCollapsed && (
                        <div className="grid flex-1 text-left leading-tight overflow-hidden">
                            <span className="truncate font-black text-white text-xs uppercase tracking-wider">
                                {user.name}
                            </span>
                            <span className="truncate text-[10px] text-white/50 font-medium">
                                {user.email}
                            </span>
                        </div>
                    )}

                    {!isCollapsed && (
                        <button
                            onClick={() => logout()}
                            className="p-2 text-white/40 hover:text-white"
                        >
                            <LogOut className="size-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Subtle gloss overlay */}
            <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
        </div>
    )
}
