# Hero Section UI/UX Refactor Prompts

For agents working in `frontend/src/features/landing/pages/Landing.tsx` (hero block ~lines 164–361).
Theme: professional, white, premium B2B SaaS. Functionality must remain identical.

---

## Prompt 1 — Master prompt (use this if you want one-shot)

```
You are working in `frontend/src/features/landing/pages/Landing.tsx` in the Wrapper monorepo (React 19 + Vite 7 + Tailwind CSS 4 + Framer Motion + TanStack Router). The brand navy is `#1B2E5A` and the gradient accent is `from-blue-600 via-violet-600 to-cyan-500`. The orbital ecosystem on the right is owned by the `<OrbitalEcosystem variant="hero" theme="light" />` component — DO NOT change its internals or props.

GOAL
Refactor only the hero block (the `<main>` starting around line 204 and its background block above it around line 168) to look like a premium, professional, white-theme enterprise SaaS landing page (think Linear, Vercel, Stripe, Attio). Keep ALL existing functionality, props, state, navigation handlers, and the `OrbitalEcosystem` component exactly as-is.

CONSTRAINTS
- Do not add or remove imports for OrbitalEcosystem, MarketingNavbar, primaryCta, products, or any data hooks.
- Keep the headline copy, badge copy, value-prop copy, metrics, CTA buttons, product explorer card behavior, and the trust-badge strip below the hero.
- Keep TanStack Router `useNavigate` usage; do not introduce React Router.
- Tailwind utility classes only — no new CSS files. Use only utilities that exist in Tailwind 4.
- All colors must be neutral whites/slates with the existing `#1B2E5A` navy and the existing gradient as the only accents. No new colors.
- Keep Framer Motion entrance animations but make them subtler (shorter, less travel).

DESIGN DIRECTION
1. Background: replace the four overlapping radial gradients with ONE soft, very subtle radial wash from top-center plus a refined dot/grid pattern that fades to transparent at the edges. The page should read as crisp white, not "aurora."
2. Typography: tighten the headline into a single `<h1>` with `text-balance` and a 1.05–1.1 line-height. Use a fluid clamp via Tailwind responsive sizes (e.g. `text-4xl sm:text-5xl lg:text-6xl xl:text-[4.5rem]`). The word "decisions" keeps the gradient. Letter-spacing `-0.04em` at the largest size.
3. Hierarchy: badge → headline → subhead → metrics → CTAs → product explorer. Add 4–8px of extra rhythm between blocks; the current spacing feels uneven.
4. Badge: pill with a hairline border `border-slate-200`, white background, `text-slate-600`, and the existing teal status dot. Add `backdrop-blur-sm`.
5. Subhead: `text-slate-600 text-lg leading-relaxed max-w-xl`.
6. Metrics strip: replace the dividing vertical lines with more breathing room. Numbers in `text-[#1B2E5A] font-bold tabular-nums tracking-tight`, labels in `text-slate-500 text-xs uppercase tracking-[0.08em] font-medium`.
7. Primary CTA: keep navy background, but soften shadow to `shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-8px_rgba(27,46,90,0.45)]`, hover lifts 1px (`hover:-translate-y-px`), focus-visible ring `ring-2 ring-offset-2 ring-[#1B2E5A]/30`. Border-radius `rounded-lg` (not xl).
8. Secondary CTA ("Watch demo"): ghost style, `border-slate-200 hover:border-slate-300 hover:bg-slate-50`, same radius, same focus ring (slate). Replace the filled play circle with a simple `Play` icon at `text-slate-500`.
9. Product explorer card: keep the gradient hairline at the top. Reduce hover from `bg-slate-50/70` to `bg-slate-50/40`. Add `transition-shadow hover:shadow-md`. The "Connects to" pills become uppercase 10px chips with `bg-white border border-slate-200 text-slate-600`.
10. Right column: keep `<OrbitalEcosystem>` as-is, but ensure the column has `lg:pl-8` so it never crowds the headline at `lg` breakpoint.
11. Mobile (<lg): order is hero text → CTAs → orbital → product explorer. Add `px-5` minimum side padding and reduce headline to `text-4xl`.
12. Accessibility: every interactive element must have `focus-visible` ring states; `<h1>` must remain a single semantic heading; decorative gradient `aria-hidden="true"`.

DELIVERABLE
A single edit to `Landing.tsx` covering the background div and the `<main>` hero block. Do not touch the workflows section, industries section, or contact form. Run `pnpm --filter wrapper-frontend build` and confirm the bundle still produces.
```

---

## Prompt 2 — Background only (start here if you want to iterate piece by piece)

```
In `frontend/src/features/landing/pages/Landing.tsx`, replace the "Light aurora background" block (the absolute-positioned div around lines 168–175 with four nested radial gradients and the grid) with a calmer, more premium treatment.

Replace it with:
- A single soft radial gradient from top-center, fading from `rgba(96,165,250,0.06)` to transparent over ~720px height.
- A subtle dot pattern (NOT a grid) using `radial-gradient(circle, rgba(15,23,42,0.04) 1px, transparent 1px)` at `24px 24px`, masked with a vertical linear gradient so it fades to fully transparent by the bottom of the hero (~720px) and is invisible on the right column behind the orbital.
- Container stays `aria-hidden="true"`, `pointer-events-none`, `z-0`.

No other changes. Keep Tailwind utilities; inline `style` only for the gradients/mask.
```

---

## Prompt 3 — Typography & headline

```
In `frontend/src/features/landing/pages/Landing.tsx`, refactor the `<h1>` (around lines 222–236) which currently uses 4 nested `<span class="block">` lines.

Replace it with a single fluid headline:
- Wrap in `<h1 className="text-[#1B2E5A] font-black tracking-[-0.04em] leading-[1.05] text-balance text-4xl sm:text-5xl lg:text-6xl xl:text-[4.5rem]">`.
- Inside, render the copy as plain text with one inner `<span>` around "decisions" carrying `bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent`.
- Wrap "interconnected applications" in `<span className="whitespace-nowrap">` so it never breaks awkwardly mid-phrase on tablet widths.

Below the headline, change the subhead to `text-slate-600 text-base sm:text-lg leading-relaxed max-w-xl mt-6`. Keep copy identical.
```

---

## Prompt 4 — CTAs & metrics polish

```
In `frontend/src/features/landing/pages/Landing.tsx`, polish the metrics strip and CTA buttons inside the hero (the `motion.div` blocks roughly lines 244–287).

METRICS:
- Remove the vertical 1px divider lines.
- Layout: `flex items-baseline gap-10 sm:gap-14 mt-8 pt-8 border-t border-slate-100`.
- Number style: `text-2xl sm:text-3xl font-bold text-[#1B2E5A] tabular-nums tracking-tight`.
- Label style: `text-[11px] text-slate-500 mt-1.5 uppercase tracking-[0.08em] font-medium`.

PRIMARY CTA:
- `rounded-lg` (not xl). Padding `px-6 py-3`.
- Replace existing shadow with `shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-8px_rgba(27,46,90,0.45)]`.
- Hover: `hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(15,23,42,0.08),0_12px_32px_-8px_rgba(27,46,90,0.5)]`.
- Focus: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B2E5A]/40`.
- Active: `active:translate-y-0 active:scale-[0.98]`.
- Keep the conditional icon logic (LayoutDashboard / Rocket) and `ArrowRight` exactly as-is.

SECONDARY CTA ("Watch demo"):
- Same radius/padding as primary.
- `border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-[#1B2E5A]`.
- Replace the filled play-circle wrapper with a plain `<Play className="w-4 h-4 text-slate-500 fill-current" />`.
- Same focus-visible treatment (slate ring).

Keep all click handlers, disabled states, and `primaryCta` wiring unchanged.
```

---

## Prompt 5 — Product explorer card refinement

```
In `frontend/src/features/landing/pages/Landing.tsx`, refine the product explorer card (motion.div around lines 290–347) without changing its data, navigation, or animation behavior.

Outer container: `rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_16px_-4px_rgba(15,23,42,0.08)] transition-shadow`.

Top hairline: keep the gradient line but reduce to `h-px` and add `opacity-80`.

Inner row:
- Icon tile: `w-10 h-10 rounded-lg bg-[#1B2E5A]` (keep). Add `ring-1 ring-inset ring-white/10`.
- Title: `text-[15px] font-semibold text-[#1B2E5A]`.
- Tagline: `text-[13px] text-slate-500 mt-0.5 truncate`.
- Trailing arrow tile: keep, but soften — `bg-transparent border-slate-200 group-hover:bg-slate-50`.

"Connects to" chips:
- Label `text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em]`.
- Chip `text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5`.

Keep the `AnimatePresence`, the click-through to `/products/${activeProduct.id}`, and all dependency-graph logic exactly as-is.
```

---

## Prompt 6 — Layout, spacing, and responsive rhythm

```
In `frontend/src/features/landing/pages/Landing.tsx`, tighten the hero `<main>` layout (around line 205).

- Outer main: `relative pt-28 sm:pt-32 lg:pt-36 pb-24 lg:pb-28 max-w-[88rem] mx-auto px-5 sm:px-8 lg:px-12 z-10`.
- Grid: `grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center`.
- Left column: add `lg:pr-4` so text doesn't crowd the orbital.
- Right column (`<OrbitalEcosystem>`): add `lg:pl-4` to the `motionClassName` prop. Do not change other props.

Mobile order:
- Headline + subhead + metrics → CTAs → orbital ecosystem → product explorer card.
- On `lg+` keep current side-by-side with text left, orbital right.

Verify visual rhythm by adding `mt-` values consistently in 8px increments: badge → h1 (mt-6), h1 → subhead (mt-6), subhead → metrics (mt-8), metrics → CTAs (mt-8), CTAs → product explorer (mt-10).
```

---

## Verification checklist (run after agent finishes)

```
1. `pnpm --filter wrapper-frontend build` succeeds.
2. `pnpm --filter wrapper-frontend dev` opens, hero renders.
3. Click "Go to Workspace" / primary CTA → routes correctly (login or dashboard depending on auth).
4. Click product explorer card → navigates to /products/<id>.
5. Click an orbital app → activeProduct updates and the explorer card re-renders.
6. Tab through hero with keyboard → every interactive element shows a focus ring.
7. Resize to 375px width → no horizontal scroll, no overlap.
8. Lighthouse a11y score on the landing route still ≥ 95.
```
