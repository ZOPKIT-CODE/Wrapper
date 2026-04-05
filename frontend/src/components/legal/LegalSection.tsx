import React from 'react';

type LegalSectionProps = {
  id: string;
  /** e.g. "1. Introduction" — include the section number in the string */
  title: string;
  children: React.ReactNode;
};

/**
 * Consistent section block for policy pages: anchor id, heading, spacing.
 */
export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="scroll-mt-28 border-b border-slate-100 pb-10 last:border-b-0 last:pb-0">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4 tracking-tight">{title}</h2>
      <div className="space-y-4 text-slate-600 leading-relaxed [&_strong]:text-slate-800 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_a]:text-blue-600 [&_a]:underline-offset-2 hover:[&_a]:underline">
        {children}
      </div>
    </section>
  );
}
