# Zopkit Hero — Redesign Handoff

> Mockup: `hero-redesign.html` (open in browser to see motion + glow)
> Target file: `frontend/src/features/landing/pages/Landing.tsx` (hero JSX block, lines ~205–360)
> Stack: React 19 · Tailwind 4 · Framer Motion · custom SVG (`OrbitalEcosystem.tsx`)

---

## What changed and why

| Old | New | Reason |
|---|---|---|
| Flat white background, light grid | Deep navy gradient + 3 animated glow blobs + dot-grid mask + film grain | Modern SaaS heroes (Linear / Vercel / Cursor) use atmospheric dark stages — adds depth without losing brand |
| 4-line headline that wraps awkwardly | 3-line tight headline, "decisions" gets shimmer gradient + glow underline | Faster to read, hero stays above the fold |
| No primary CTA in the hero (only nav button) | Primary gradient pill **Start free trial** + glassy **Watch 90-sec demo** with play cap | Clear conversion path, secondary action retains the “demo” affordance |
| No social proof above the fold | Avatar stack + 4.9★ rating + “500+ teams” trust line | Adds credibility immediately |
| Stats floated below as plain text | 4-up stat bar with gradient icon tiles in a glass container | Reads as a product, not a brochure |
| Static orbital diagram | Same orbital concept but: rotating dashed rings, ping waves, glass app cards with live status (`312 contacts synced`, `+38 conversions`), two flying “live event” badges | Sells the “intelligent agents working in background” promise |
| No customer logo strip | Subtle 6-logo wordmark row | Standard trust signal |

**Brand fidelity preserved:** primary navy `#1B2E5A`, the blue→violet→cyan gradient, teal accent for live signals, and the orbital ecosystem concept (still your strongest differentiator — kept and amplified, not replaced).

---

## Design tokens (drop into `tailwind.config.js` extend)

```js
colors: {
  zopkit: {
    DEFAULT: '#1B2E5A',
    deep:    '#0e1a3c',
    bg0:     '#070b1a',
    bg1:     '#0b1230',
    bg2:     '#101a3d',
    ink:     '#e7ecff',
    inkDim:  '#aab3d9',
    inkMute: '#7a83ad',
    line:    'rgba(255,255,255,0.08)',
    line2:   'rgba(255,255,255,0.14)',
    teal:    '#22d3c5',
    cyan:    '#22d3ee',
    blue:    '#5b8cff',
    violet:  '#8b5cf6',
  },
},
backgroundImage: {
  'zk-grad':   'linear-gradient(135deg,#5b8cff 0%,#8b5cf6 45%,#22d3ee 100%)',
  'zk-grad-soft': 'linear-gradient(135deg,rgba(91,140,255,.18),rgba(139,92,246,.18) 50%,rgba(34,211,238,.18))',
},
fontFamily: {
  display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
},
keyframes: {
  shimmer: { '0%': { backgroundPosition: '0% 50%' }, '100%': { backgroundPosition: '200% 50%' } },
  'zk-pulse': {
    '0%':   { boxShadow: '0 0 0 0 rgba(34,211,197,.6)' },
    '70%':  { boxShadow: '0 0 0 12px rgba(34,211,197,0)' },
    '100%': { boxShadow: '0 0 0 0 rgba(34,211,197,0)' },
  },
  'zk-ping': { '0%': { transform: 'scale(.85)', opacity: '.9' }, '100%': { transform: 'scale(1.9)', opacity: '0' } },
  'zk-spin-slow':    { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
  'zk-float':        { '0%,100%': { transform: 'translate3d(0,0,0)' }, '50%': { transform: 'translate3d(20px,-30px,0)' } },
  'zk-float-node':   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
},
animation: {
  shimmer: 'shimmer 6s linear infinite',
  'zk-pulse': 'zk-pulse 1.8s ease-out infinite',
  'zk-ping':  'zk-ping 3s ease-out infinite',
  'zk-spin-slow':   'zk-spin-slow 40s linear infinite',
  'zk-spin-slower': 'zk-spin-slow 70s linear infinite reverse',
  'zk-float':       'zk-float 16s ease-in-out infinite',
  'zk-float-node':  'zk-float-node 6s ease-in-out infinite',
},
```

---

## Component breakdown

Suggested split (all under `frontend/src/features/landing/components/hero/`):

```
hero/
  HeroSection.tsx        ← orchestrates layout, replaces existing hero block in Landing.tsx
  HeroBackground.tsx     ← stage gradient + 3 glow blobs + grid + grain
  HeroEyebrow.tsx        ← live pulse pill
  HeroHeadline.tsx       ← shimmer gradient on "decisions"
  HeroCTAs.tsx           ← primary gradient + glass watch-demo
  HeroTrust.tsx          ← avatars + stars + copy
  HeroStatsBar.tsx       ← 4-up gradient-icon stat strip
  HeroLogoStrip.tsx      ← muted wordmark row
  HeroOrbital.tsx        ← refactor of OrbitalEcosystem with new dark variant + ping rings + flying badges
```

`OrbitalEcosystem.tsx` already accepts a `theme` prop — add `theme="dark"` and a `liveBadges` prop array `[{from:'CRM',to:'Finance',label:'Invoice synced'}]` instead of forking the component.

---

## Headline copy (verbatim)

Reuse the existing string so nothing changes for SEO / messaging tests:

> **driving influential decisions across interconnected applications.**

Just restructure the line breaks: 3 visual lines, with `decisions` wrapped in a `<span class="grad">…</span>` for the shimmer effect.

If you want to A/B test a tighter alternate later, candidates that fit the hero better:
- *"Run your business on one intelligent operating system."*
- *"Eleven apps. One brain. Zero data‑entry duplication."*

---

## Motion notes (Framer Motion)

Stagger pattern (you already use this — keep it):

```tsx
<motion.div initial={{opacity:0, y:14}} animate={{opacity:1, y:0}} transition={{duration:.6, delay:0}}/>
<motion.h1 ... transition={{duration:.6, delay:.12}}/>
<motion.p  ... transition={{duration:.6, delay:.22}}/>
<motion.div ... transition={{duration:.6, delay:.34}}/> // CTAs
<motion.div ... transition={{duration:.6, delay:.46}}/> // trust
<motion.div ... transition={{duration:.7, delay:.20}}/> // orbital wrap
```

The dashed rings, glow pulses and node bobbing are CSS keyframes (cheap, no JS). The flying "live event" badges should rotate every ~5s — drive with `useEffect` + a small reducer so future events can come from a websocket / SSE stream when the agent platform goes live.

---

## Accessibility checklist

- [ ] Headline is a single `<h1>`. Decorative gradient span has no aria text override.
- [ ] Background blobs / rings / grain wrapped in `aria-hidden`.
- [ ] Orbital diagram region uses `aria-hidden` for decorative version; supply a hidden `<ul>` with the 5 app names + statuses for screen readers.
- [ ] Live badges should respect `prefers-reduced-motion` — gate the `flyA / flyB / shimmer / spin` keyframes behind a `@media (prefers-reduced-motion: no-preference)`.
- [ ] Avatar stack uses `aria-hidden`; trust copy carries the meaning ("trusted by 500+ teams").

---

## Performance

- All animations are CSS transforms / opacity → composited on GPU, no layout thrash.
- Grain SVG is inline data-URI (no extra request).
- Glass blur (`backdrop-filter`) is the heaviest cost — limit to nav + hub + nodes. **Don't** stack it on the stats bar AND the nav AND the cards in the same viewport (already avoided in the mockup).
- Load `Inter Tight` only with `display: swap` and the weights actually used (700/800).
- Move `OrbitalEcosystem` to a `React.lazy()` import via `lazyPages.ts` if it isn't already — it's the heaviest piece and isn't needed for FCP.

---

## Implementation order for the Bridge Space agents

1. **Add the design tokens** to `tailwind.config.js` (above) — nothing else compiles until this is in.
2. **Create `HeroBackground.tsx`** — pure decoration, easy to ship and visually validate first.
3. **Refactor the existing hero block** in `Landing.tsx` into `HeroSection.tsx` keeping the current orbital component untouched. Verify desktop + mobile breakpoints.
4. **Add `HeroEyebrow / HeroHeadline / HeroCTAs / HeroTrust`** with motion stagger. Verify against `prefers-reduced-motion`.
5. **Update `OrbitalEcosystem.tsx`** to accept `theme="dark"`, ping rings, and a `liveBadges` prop. Don't fork — extend.
6. **Build `HeroStatsBar` + `HeroLogoStrip`**.
7. **QA pass:** Lighthouse (target ≥ 90 perf), keyboard tab order, screen-reader spot-check, mobile portrait.

---

## Files to inspect before editing

- `frontend/src/features/landing/pages/Landing.tsx` — current hero JSX
- `frontend/src/features/landing/components/OrbitalEcosystem.tsx` — orbital component (needs the dark variant)
- `frontend/src/features/landing/components/Icons.tsx` — house icon set, prefer over inlining new SVGs
- `frontend/tailwind.config.js` — add tokens here
- `frontend/src/components/ui/resizable-navbar.tsx` — current nav primitive; the redesigned nav can stay on this or be inlined into `HeroSection`
