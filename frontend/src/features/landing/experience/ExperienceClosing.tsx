type ExperienceClosingProps = {
  onBookDemo?: () => void
}

export function ExperienceClosing({ onBookDemo }: ExperienceClosingProps) {
  return (
    <section className="xp-closing" aria-label="Call to action">
      <h2 className="xp-display">See the workspace on your data</h2>
      <p>
        Walk through CRM, finance, and operations in one session. We map your
        stack and show where records connect first.
      </p>
      <button type="button" className="xp-btn-primary" onClick={onBookDemo}>
        Book a demo
      </button>
    </section>
  )
}
