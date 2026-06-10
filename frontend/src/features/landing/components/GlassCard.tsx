import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type GlassCardProps = {
  children: ReactNode;
  className?: string;
};

/** Web glass approximation (labeled, not Apple Liquid Glass). */
export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/25 bg-white/65 backdrop-blur-xl',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_16px_40px_-12px_rgba(15,23,42,0.12)]',
        'dark:border-white/10 dark:bg-white/8',
        className
      )}
    >
      {children}
    </div>
  );
}
