import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import {
    motion,
    AnimatePresence,
    useMotionTemplate,
    useMotionValue,
} from "framer-motion";
import React, { useRef, useState } from "react";
import { config } from "@/lib/config";

// Types
interface NavbarProps {
    children?: React.ReactNode;
    className?: string;
}

interface NavBodyProps {
    children?: React.ReactNode;
    className?: string;
    visible?: boolean;
}

interface NavItemsProps {
    items: {
        name: string;
        link: string;
    }[];
    className?: string;
    onItemClick?: () => void;
}

interface MobileNavProps {
    children?: React.ReactNode;
    className?: string;
    visible?: boolean;
}

interface MobileNavHeaderProps {
    children?: React.ReactNode;
    className?: string;
}

interface MobileNavMenuProps {
    children?: React.ReactNode;
    className?: string;
    isOpen: boolean;
    onClose: () => void;
}

// Main Navbar Container — always pill shape, no scroll resizing
export const Navbar = ({ children, className }: NavbarProps) => {
    const ref = useRef<HTMLDivElement>(null);

    return (
        <div
            ref={ref}
            className={cn("fixed inset-x-0 top-0 z-[100] w-full pointer-events-none", className)}
        >
            {React.Children.map(children, (child) =>
                React.isValidElement(child)
                    ? React.cloneElement(
                        child as React.ReactElement<{ visible?: boolean }>,
                        { visible: true },
                    )
                    : child,
            )}
        </div>
    );
};

// Desktop Nav Body — full-width rectangle
export const NavBody = ({ children, className }: NavBodyProps) => {
    return (
        <div
            className={cn(
                "pointer-events-auto relative hidden flex-row items-center justify-between lg:flex z-50",
                "w-full border-b border-white/10 bg-white/10 py-3 px-8 backdrop-blur-xl",
                className,
            )}
        >
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child) && (child.type as any)?.__isNavbarLogo) {
                    return React.cloneElement(child as React.ReactElement<{ visible?: boolean }>, { visible: true });
                }
                return child;
            })}
        </div>
    );
};

// Nav Items (Links)
export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
    const [hovered, setHovered] = useState<number | null>(null);

    return (
        <div
            onMouseLeave={() => setHovered(null)}
            className={cn(
                "relative hidden flex-1 flex-row items-center justify-center gap-1 lg:flex",
                className,
            )}
        >
            {items.map((item, idx) => (
                <a
                    onMouseEnter={() => setHovered(idx)}
                    onClick={onItemClick}
                    className="relative px-4 py-2 text-sm font-medium transition-colors duration-200"
                    key={`link-${idx}`}
                    href={item.link}
                >
                    {hovered === idx && (
                        <motion.div
                            layoutId="hovered-nav-item"
                            transition={{
                                layout: { duration: 0.2, ease: "easeOut" },
                                opacity: { duration: 0.2 }
                            }}
                            className="absolute inset-0 h-full w-full rounded-full bg-neutral-100/80"
                        />
                    )}
                    <span className={cn(
                        "relative z-10 transition-colors duration-200",
                        hovered === idx ? "text-neutral-900" : "text-neutral-600"
                    )}>{item.name}</span>
                </a>
            ))}
        </div>
    );
};

// Mobile Nav Container — full-width rectangle
export const MobileNav = ({ children, className }: MobileNavProps) => {
    return (
        <div
            className={cn(
                "pointer-events-auto relative z-50 flex flex-col items-center justify-between lg:hidden",
                "w-full border-b border-white/10 bg-white/10 backdrop-blur-xl",
                className,
            )}
        >
            {children}
        </div>
    );
};

export const MobileNavHeader = ({
    children,
    className,
}: MobileNavHeaderProps) => {
    return (
        <div
            className={cn(
                "flex w-full flex-row items-center justify-between px-6 py-3",
                className,
            )}
        >
            {children}
        </div>
    );
};

export const MobileNavMenu = ({
    children,
    className,
    isOpen,
    onClose: _onClose,
}: MobileNavMenuProps) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className={cn(
                        "w-full overflow-hidden bg-transparent px-6 pb-6 pt-2",
                        className,
                    )}
                >
                    <div className="flex flex-col space-y-2">
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export const NavbarLogo = ({ visible: _visible }: { visible?: boolean }) => {
    (NavbarLogo as any).__isNavbarLogo = true;
    return (
        <a
            href="/"
            className="relative z-20 flex shrink-0 items-center pl-2"
        >
            <img
                src={config.FULL_LOGO_URL}
                alt="Zopkit"
                className="h-10 w-auto block"
            />
        </a>
    );
};

// Innovative Spotlight Button Implementation
const SpotlightButton = ({ 
    children, 
    as: Tag = "button", 
    href, 
    className, 
    onClick,
    ...props 
}: any) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
        let { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    }

    return (
        <Tag
            href={href}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            className={cn(
                "group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-neutral-950 px-6 py-2.5 font-medium text-neutral-50 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-neutral-500/20 active:scale-95",
                className
            )}
            {...props}
        >
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                    background: useMotionTemplate`
                        radial-gradient(
                        400px circle at ${mouseX}px ${mouseY}px,
                        rgba(255,255,255,0.15),
                        transparent 80%
                        )
                    `,
                }}
            />
            <span className="relative z-10 flex items-center gap-2">
                {children}
                <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
            <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
        </Tag>
    );
};

export const MagneticButton = ({ children, as: Tag = "button", href, className, ...props }: any) => {
    return (
        <Tag
            href={href}
            className={cn(
                "group relative inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-neutral-600 transition-colors duration-200 hover:text-neutral-900 focus:outline-none",
                className
            )}
            {...props}
        >
            <span className="relative z-10">{children}</span>
            <motion.div
                layoutId="magnetic-hover"
                className="absolute inset-0 -z-10 rounded-full bg-neutral-100 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            />
        </Tag>
    );
};

export const NavbarButton = ({
    href,
    as: Tag = "a",
    children,
    className,
    variant = "primary",
    ...props
}: {
    href?: string;
    as?: React.ElementType;
    children: React.ReactNode;
    className?: string;
    variant?: "primary" | "secondary" | "dark" | "gradient" | "outline" | "ghost";
} & (
        | React.ComponentPropsWithoutRef<"a">
        | React.ComponentPropsWithoutRef<"button">
    )) => {

    if (variant === "primary" || variant === "dark" || variant === "gradient") {
        return (
            <SpotlightButton href={href} as={Tag} className={className} {...props}>
                {children}
            </SpotlightButton>
        );
    }

    if (variant === "ghost" || variant === "secondary") {
        return (
             <Tag
                href={href}
                className={cn(
                    "group relative inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-neutral-600 transition-all duration-200 hover:bg-neutral-100 hover:text-neutral-900",
                    className
                )}
                {...props}
            >
                {children}
            </Tag>
        );
    }

    return (
        <Tag
            href={href || undefined}
            className={cn(
                "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 focus:outline-none active:scale-95 border border-neutral-200 bg-transparent text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900",
                className
            )}
            {...props}
        >
            {children}
        </Tag>
    );
};
