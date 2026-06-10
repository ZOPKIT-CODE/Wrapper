import React from 'react';

type LegalSectionProps = {
  id: string;
  title: string;
  children: React.ReactNode;
};

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="scroll-mt-28 border-b border-border pb-10 last:border-b-0 last:pb-0">
      <h2 className="landing-display text-xl font-semibold text-foreground mb-4 tracking-tight">{title}</h2>
      <div className="space-y-4 text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_a]:text-foreground [&_a]:underline-offset-4 hover:[&_a]:underline">
        {children}
      </div>
    </section>
  );
}
