type MarketingNavigate = (opts: { to: string }) => void

/** Route marketing CTA labels to contact, trial, pricing, or blog. */
export function resolveMarketingCtaAction(
  label: string,
  scrollToContact: () => void,
  navigate: MarketingNavigate
) {
  const lower = label.toLowerCase()
  if (lower.includes('case stud')) {
    return () => navigate({ to: '/blog' })
  }
  if (lower.includes('pricing') || lower.includes('plan')) {
    return () => navigate({ to: '/pricing' })
  }
  if (lower.includes('trial')) {
    return () => navigate({ to: '/onboarding' })
  }
  return scrollToContact
}
