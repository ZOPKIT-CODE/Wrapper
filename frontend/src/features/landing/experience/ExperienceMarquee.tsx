const MODULES = [
  'B2B CRM',
  'Finance',
  'HRMS',
  'Operations',
  'Projects',
  'Flowtilla',
  'ITSM',
  'Academy',
]

export function ExperienceMarquee() {
  const items = [...MODULES, ...MODULES]

  return (
    <div className="xp-marquee" aria-hidden="true">
      <div className="xp-marquee-track">
        {items.map((name, index) => (
          <span key={`${name}-${index}`} className="xp-marquee-item">
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}
