import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import '@/features/landing/landing.css';

type MarketingPageShellProps = {
  children: ReactNode;
  className?: string;
};

/** Wraps public marketing pages with Vercel-minimal light theme scope. */
export function MarketingPageShell({ children, className }: MarketingPageShellProps) {
  return (
    <div
      data-landing
      data-landing-theme="minimal"
      className={cn('min-h-screen bg-background text-foreground font-sans antialiased overflow-x-clip', className)}
    >
      {children}
    </div>
  );
}
