import { useReducedMotion } from 'framer-motion';

const INTEGRATIONS = [
  { name: 'Stripe', slug: 'stripe' },
  { name: 'Slack', slug: 'slack' },
  { name: 'Google', slug: 'google' },
  { name: 'GitHub', slug: 'github' },
  { name: 'Notion', slug: 'notion' },
  { name: 'Shopify', slug: 'shopify' },
  { name: 'Atlassian', slug: 'atlassian' },
  { name: 'Tally', slug: 'tally' },
] as const;

function LogoRow({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <>
      {INTEGRATIONS.map((brand) => (
        <li key={`${brand.slug}-${ariaHidden ? 'dup' : 'a'}`} className="flex shrink-0 items-center justify-center px-8 sm:px-12">
          <img
            src={`https://cdn.simpleicons.org/${brand.slug}/94A3B8`}
            alt={ariaHidden ? '' : brand.name}
            width={32}
            height={32}
            className="h-7 sm:h-8 w-auto opacity-40 grayscale"
            loading="lazy"
          />
        </li>
      ))}
    </>
  );
}

export function LandingLogoWall() {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-label="Integrations" className="border-y border-border/80 bg-background/60 backdrop-blur-sm py-11 sm:py-12 overflow-hidden">
      <p className="text-center text-sm text-muted-foreground mb-8 px-4">
        Plugs into the tools your teams already rely on
      </p>

      {reduceMotion ? (
        <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 px-4">
          <LogoRow />
        </ul>
      ) : (
        <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <ul className="flex animate-landing-marquee items-center min-w-full">
            <LogoRow />
            <LogoRow ariaHidden />
          </ul>
        </div>
      )}
    </section>
  );
}
