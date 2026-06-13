const MODULE_MARKS = [
  'B2B CRM',
  'Finance',
  'HRMS',
  'Operations',
  'Projects',
  'Flowtilla',
]

export function ExperienceLogos() {
  return (
    <section className="xp-logos" aria-label="Platform modules">
      <div className="xp-logos-inner">
        {MODULE_MARKS.map((name) => (
          <span key={name} className="xp-logo-mark">
            {name}
          </span>
        ))}
      </div>
    </section>
  )
}
