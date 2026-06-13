import React from 'react'

type LegalSectionProps = {
  id: string
  title: string
  children: React.ReactNode
}

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section
      id={id}
      className="border-border scroll-mt-28 border-b pb-10 last:border-b-0 last:pb-0"
    >
      <h2 className="landing-display text-foreground mb-4 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="text-muted-foreground [&_strong]:text-foreground [&_a]:text-foreground space-y-4 leading-relaxed [&_a]:underline-offset-4 hover:[&_a]:underline [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </section>
  )
}
