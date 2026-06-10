import React, { useEffect } from 'react';
import { LandingFooter } from '@/components/layout/LandingFooter';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { MarketingPageShell } from '@/components/layout/MarketingPageShell';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
  wide?: boolean;
  contained?: boolean;
  docIntro?: React.ReactNode;
  tableOfContents?: { id: string; label: string }[];
  hideStartTrialCta?: boolean;
}

export function LegalPageLayout({
  title,
  lastUpdated = '',
  children,
  wide = false,
  contained = true,
  docIntro,
  tableOfContents,
}: LegalPageLayoutProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <MarketingPageShell>
      <MarketingNavbar minimal />

      <main className={`relative pt-28 sm:pt-32 pb-16 mx-auto px-4 sm:px-6 lg:px-8 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {contained ? (
          <div className="border-b border-border pb-12 md:pb-16">
            <h1 className="landing-display text-3xl md:text-4xl font-semibold text-foreground tracking-tight">{title}</h1>
            {lastUpdated && (
              <p className="landing-mono text-xs text-muted-foreground mt-3">Last updated: {lastUpdated}</p>
            )}
            {docIntro && (
              <div className="mt-6 text-muted-foreground text-[15px] leading-relaxed max-w-3xl border-l border-border pl-4">
                {docIntro}
              </div>
            )}
            {tableOfContents && tableOfContents.length > 0 && (
              <nav aria-label="Table of contents" className="mt-10 pt-8 border-t border-border">
                <p className="landing-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-3">
                  On this page
                </p>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {tableOfContents.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="landing-text-link hover:text-foreground transition-colors underline-offset-4 hover:underline"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <div className="mt-10 max-w-none flex flex-col gap-0">{children}</div>
          </div>
        ) : (
          <>{children}</>
        )}
      </main>

      <LandingFooter marketing />
    </MarketingPageShell>
  );
}
