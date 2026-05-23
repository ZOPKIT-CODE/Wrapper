import React, { useEffect } from 'react';
import { LandingFooter } from '@/components/layout/LandingFooter';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
  /** Use wider max-width and no inner box (e.g. for Pricing page) */
  wide?: boolean;
  /** When false, do not render the white contained box or lastUpdated */
  contained?: boolean;
  /** Short intro below the date — scope, audience, or how to read the document */
  docIntro?: React.ReactNode;
  /** Anchor links for in-page navigation (label without leading numbers is fine) */
  tableOfContents?: { id: string; label: string }[];
  /** Unused — kept for API compatibility, ignored now that the navbar is self-contained */
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <MarketingNavbar />

      <main className={`relative pt-32 sm:pt-36 pb-16 mx-auto px-4 sm:px-6 lg:px-8 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {contained ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-[#1B2E5A] mb-2">{title}</h1>
            {lastUpdated && <p className="text-slate-500 text-sm mb-6">Last updated: {lastUpdated}</p>}
            {docIntro && <div className="mb-8 text-slate-600 text-[15px] leading-relaxed border-l-4 border-[#1B2E5A]/25 pl-4 py-1">{docIntro}</div>}
            {tableOfContents && tableOfContents.length > 0 && (
              <nav aria-label="Table of contents" className="mb-10 rounded-xl border border-slate-200 bg-slate-50 p-5 md:p-6">
                <p className="text-sm font-semibold text-[#1B2E5A] mb-3">On this page</p>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700 marker:font-medium">
                  {tableOfContents.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className="text-blue-600 hover:underline underline-offset-2">
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <div className="max-w-none flex flex-col gap-0">{children}</div>
          </div>
        ) : (
          <>{children}</>
        )}
      </main>

      <LandingFooter />
    </div>
  );
}
