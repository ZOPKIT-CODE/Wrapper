/** Fixed marketing navbar clearance when scrolling to in-page sections. */
export const LANDING_NAV_SCROLL_OFFSET = 88

export const LANDING_SECTION_IDS = [
  'contact',
  'workflows',
  'industries',
  'resources',
] as const

export type LandingSectionId = (typeof LANDING_SECTION_IDS)[number]

export function isLandingSectionId(id: string): id is LandingSectionId {
  return (LANDING_SECTION_IDS as readonly string[]).includes(id)
}

export function isLandingPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/landing' ||
    pathname === '/landing/classic' ||
    pathname === '/landing/v2' ||
    pathname === '/landing/v3'
  )
}

export function readLandingHash(): string {
  return decodeURIComponent(window.location.hash.replace(/^#/, ''))
}

export function writeLandingHash(
  sectionId: string,
  pathname = window.location.pathname
) {
  window.history.replaceState(null, '', `${pathname}#${sectionId}`)
}

export function scrollToLandingSection(
  sectionId: string,
  behavior: ScrollBehavior = 'smooth'
): boolean {
  const el = document.getElementById(sectionId)
  if (!el) return false

  const top =
    el.getBoundingClientRect().top + window.scrollY - LANDING_NAV_SCROLL_OFFSET
  window.scrollTo({ top: Math.max(0, top), behavior })
  return true
}

export function scrollToLandingContact(behavior: ScrollBehavior = 'smooth') {
  const scrolled = scrollToLandingSection('contact', behavior)
  if (scrolled) writeLandingHash('contact')
  return scrolled
}

/** Retry scroll until lazy sections mount (e.g. after route navigation). */
export function scrollToLandingSectionWhenReady(
  sectionId: string,
  behavior: ScrollBehavior = 'instant',
  maxAttempts = 24
) {
  let attempts = 0

  const tryScroll = () => {
    if (scrollToLandingSection(sectionId, behavior)) return
    if (attempts++ < maxAttempts) requestAnimationFrame(tryScroll)
  }

  tryScroll()
}
