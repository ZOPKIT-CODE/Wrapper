/**
 * Hero atmosphere — CSS mesh aurora (Stripe / Linear / Vercel pattern).
 * Layered OKLCH radial blobs + slow drift; no grid, no WebGL.
 */
export function LandingHeroBackdrop() {
  return (
    <div className="landing-hero-backdrop" aria-hidden="true">
      <div className="landing-hero-backdrop__mesh" />
      <div className="landing-hero-backdrop__mesh landing-hero-backdrop__mesh--drift" />
      <div className="landing-hero-backdrop__horizon" />
    </div>
  )
}
