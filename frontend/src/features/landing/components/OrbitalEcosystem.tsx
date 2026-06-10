import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DynamicIcon } from '@/features/landing/components/Icons';
import { products } from '@/data/content';
import type { Product } from '@/types';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';

/** Default ring radius in viewBox units (0–100). */
export const DEFAULT_ORBITAL_R = 36;
/** Landing hero: ring radius in viewBox units (fewer nodes → can use a slightly larger R for label clearance). */
const HERO_ORBITAL_R = 46;

/** Hero + industry workflow: five core apps (even spacing, fewer collisions than full suite). */
export const WORKFLOW_ORBIT_APP_IDS = [
  'operations',
  'finance',
  'affiliate-connect',
  'b2b-crm',
  'project-management',
] as const;

/** Base orbit nodes (order matches DEPENDENCIES indices 0–10). */
export const ORBIT_APPS_BASE = [
  { id: 'b2b-crm', label: 'B2B CRM', short: 'CRM', icon: 'Briefcase' },
  { id: 'b2c-crm', label: 'B2C CRM', short: 'B2C', icon: 'ShoppingCart' },
  { id: 'finance', label: 'Finance', short: 'Fin', icon: 'Landmark' },
  { id: 'operations', label: 'Operations', short: 'Ops', icon: 'Box' },
  { id: 'project-management', label: 'Projects', short: 'PM', icon: 'ClipboardList' },
  { id: 'hrms', label: 'HRMS', short: 'HR', icon: 'UserCheck' },
  { id: 'esop-system', label: 'ESOP', short: 'ESOP', icon: 'Award' },
  { id: 'affiliate-connect', label: 'Affiliates', short: 'Aff', icon: 'Link' },
  { id: 'flowtilla', label: 'Flowtilla', short: 'Flow', icon: 'GitBranch' },
  { id: 'zopkit-academy', label: 'Academy', short: 'Acad', icon: 'GraduationCap' },
  { id: 'zopkit-itsm', label: 'ITSM', short: 'ITSM', icon: 'Wrench' },
] as const;

export type OrbitApp = (typeof ORBIT_APPS_BASE)[number] & { x: number; y: number };

export const FULL_APP_IDS_ORDER: readonly string[] = ORBIT_APPS_BASE.map((a) => a.id);

export const DEPENDENCIES: [number, number, string][] = [
  [0, 2, 'Invoices'],
  [0, 3, 'Orders'],
  [1, 0, 'Contacts'],
  [2, 5, 'Payroll'],
  [2, 3, 'Costs'],
  [4, 5, 'Resources'],
  [4, 2, 'Budgets'],
  [7, 0, 'Referrals'],
  [8, 4, 'Workflows'],
  [10, 4, 'Tickets'],
];

export const HUB_PRODUCT_LABELS: Record<string, string> = {
  'esop-system': 'Equity Plans',
  'zopkit-academy': 'Learning',
};

function addRadialPositions<T extends { id: string }>(
  apps: T[],
  radius: number,
): (T & { x: number; y: number })[] {
  return apps.map((app, i, arr) => {
    const angle = (360 / arr.length) * i - 90;
    const rad = (angle * Math.PI) / 180;
    return { ...app, x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
  });
}

/**
 * Build positioned orbit apps. Pass `appIds` to show only that subset (evenly spaced).
 * Unknown ids are skipped. Order follows `appIds` when provided.
 */
export function buildOrbitApps(
  appIds?: readonly string[] | null,
  radius: number = DEFAULT_ORBITAL_R,
): OrbitApp[] {
  if (appIds?.length) {
    const selected = appIds
      .map((id) => ORBIT_APPS_BASE.find((a) => a.id === id))
      .filter((a): a is (typeof ORBIT_APPS_BASE)[number] => a != null);
    return addRadialPositions([...selected], radius) as OrbitApp[];
  }
  return addRadialPositions([...ORBIT_APPS_BASE], radius) as OrbitApp[];
}

/** Full suite — used by landing hero “Connects to” logic (positions use default radius; ids match indices). */
export const ORBIT_APPS = buildOrbitApps(null, DEFAULT_ORBITAL_R);

const HUB = { x: 50, y: 50 };

/** Nudge dependency labels away from orbit node centers so SVG text doesn’t sit under HTML node titles. */
function repelLabelFromOrbitNodes(
  lx: number,
  ly: number,
  orbitApps: OrbitApp[],
  minSep: number,
): { lx: number; ly: number } {
  let x = lx;
  let y = ly;
  for (let iter = 0; iter < 4; iter++) {
    for (const app of orbitApps) {
      const dx = x - app.x;
      const dy = y - app.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= minSep) continue;
      if (d < 1e-9) {
        const hx = HUB.x - app.x;
        const hy = HUB.y - app.y;
        const hlen = Math.sqrt(hx * hx + hy * hy) || 1;
        x += (hx / hlen) * 0.35;
        y += (hy / hlen) * 0.35;
        continue;
      }
      const push = ((minSep - d) / d) * 0.72;
      x += dx * push;
      y += dy * push;
    }
  }
  return { lx: x, ly: y };
}

/**
 * Curve between two orbit nodes with control point pushed **outside** the ring (away from hub)
 * so paths don’t all cross the center — much easier to read.
 */
type LabelSpread = { index: number; total: number; hero: boolean };

function depCurveAndLabel(
  orbitApps: OrbitApp[],
  fromIdx: number,
  toIdx: number,
  bulge = 13,
  spread?: LabelSpread,
): { d: string; lx: number; ly: number } {
  const a = orbitApps[fromIdx];
  const b = orbitApps[toIdx];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const ux = mx - HUB.x;
  const uy = my - HUB.y;
  const ulen = Math.sqrt(ux * ux + uy * uy);

  /** Place labels slightly *inward* (toward hub) so they sit off the dashed curve, not on it. */
  const inwardFromChord = spread?.hero ? 10.5 : 5.5;

  let cx: number;
  let cy: number;
  let lx: number;
  let ly: number;

  if (ulen < 0.8) {
    const px = -(a.y - b.y);
    const py = a.x - b.x;
    const plen = Math.sqrt(px * px + py * py) || 1;
    cx = mx + (px / plen) * bulge;
    cy = my + (py / plen) * bulge;
    const hx = mx - HUB.x;
    const hy = my - HUB.y;
    const hlen = Math.sqrt(hx * hx + hy * hy) || 1;
    const hnx = hx / hlen;
    const hny = hy / hlen;
    lx = mx - hnx * inwardFromChord;
    ly = my - hny * inwardFromChord;
  } else {
    const nx = ux / ulen;
    const ny = uy / ulen;
    cx = mx + nx * bulge;
    cy = my + ny * bulge;
    const qx = 0.25 * a.x + 0.5 * cx + 0.25 * b.x;
    const qy = 0.25 * a.y + 0.5 * cy + 0.25 * b.y;
    lx = qx - nx * inwardFromChord;
    ly = qy - ny * inwardFromChord;
  }

  // Stagger labels when several edges meet (e.g. Finance) — offset ⊥ to chord so text doesn’t stack.
  if (spread && spread.total > 1) {
    let px = -(b.y - a.y);
    let py = b.x - a.x;
    const plen = Math.sqrt(px * px + py * py) || 1;
    px /= plen;
    py /= plen;
    const step = spread.hero
      ? spread.total > 5
        ? 5.5
        : spread.total > 3
          ? 5
          : 4
      : 2.4;
    const offset = (spread.index - (spread.total - 1) / 2) * step;
    lx += px * offset;
    ly += py * offset;
  }

  const repelled = repelLabelFromOrbitNodes(lx, ly, orbitApps, spread?.hero ? 18.5 : 13);
  lx = repelled.lx;
  ly = repelled.ly;

  // Soft bounds — avoid aggressive clamp that truncates words like “Budgets” near the rim.
  const pad = spread?.hero ? 3.5 : 3;
  lx = Math.min(100 - pad, Math.max(pad, lx));
  ly = Math.min(100 - pad, Math.max(pad, ly));

  const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
  return { d, lx, ly };
}

function filterDependenciesForOrbit(orbitApps: OrbitApp[]): [number, number, string][] {
  const idToIdx = new Map<string, number>();
  orbitApps.forEach((a, i) => idToIdx.set(a.id, i));
  const out: [number, number, string][] = [];
  for (const [fi, ti, label] of DEPENDENCIES) {
    const fromId = FULL_APP_IDS_ORDER[fi];
    const toId = FULL_APP_IDS_ORDER[ti];
    const from = idToIdx.get(fromId);
    const to = idToIdx.get(toId);
    if (from !== undefined && to !== undefined) {
      out.push([from, to, label]);
    }
  }
  return out;
}

export interface OrbitalEcosystemProps {
  activeProduct?: Product;
  onActiveProductChange?: React.Dispatch<React.SetStateAction<Product>>;
  autoRotate?: boolean;
  layout?: 'grid' | 'stack';
  motionClassName?: string;
  showMobileStrip?: boolean;
  /** If set, only these applications appear on the orbit (e.g. industry workflow subset). */
  appIds?: readonly string[] | null;
  /** Landing hero: larger ring, labels, and hub for readability. */
  variant?: 'default' | 'hero';
  /** Dark background mode — inverts SVG and node colors for use on dark hero sections. */
  theme?: 'light' | 'dark';
}

export const OrbitalEcosystem: React.FC<OrbitalEcosystemProps> = ({
  activeProduct: controlledActive,
  onActiveProductChange: setControlled,
  autoRotate = true,
  layout = 'stack',
  motionClassName = 'lg:col-span-5 order-2 lg:order-2 mx-auto lg:mx-0 w-full',
  showMobileStrip = true,
  appIds = null,
  variant = 'default',
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const isHero = variant === 'hero';
  const orbitRadius = isHero ? HERO_ORBITAL_R : DEFAULT_ORBITAL_R;
  const curveBulge = isHero ? 16 : 13;
  const orbitApps = useMemo(() => buildOrbitApps(appIds, orbitRadius), [appIds, orbitRadius]);
  const depsInView = useMemo(() => filterDependenciesForOrbit(orbitApps), [orbitApps]);

  const visibleProducts = useMemo(
    () => products.filter((p) => orbitApps.some((a) => a.id === p.id)),
    [orbitApps],
  );

  const [internalActive, setInternalActive] = useState<Product>(() => visibleProducts[0] ?? products[0]);
  const [hoveredEdge, setHoveredEdge] = useState<{ label: string; lx: number; ly: number } | null>(null);
  const isControlled = controlledActive !== undefined && setControlled !== undefined;
  const activeProduct = isControlled ? controlledActive : internalActive;
  const setActiveProduct = isControlled ? setControlled : setInternalActive;

  useEffect(() => {
    if (isControlled) return;
    const first = visibleProducts[0];
    if (first && !visibleProducts.some((p) => p.id === internalActive.id)) {
      setInternalActive(first);
    }
  }, [visibleProducts, internalActive.id, isControlled]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const productRefs = useRef<Map<string | number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setActiveProduct((prev) => {
        const pool = visibleProducts.length ? visibleProducts : products;
        const currentIndex = pool.findIndex((p) => p.id === prev.id);
        const idx = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = (idx + 1) % pool.length;
        return pool[nextIndex];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRotate, setActiveProduct, visibleProducts]);

  useEffect(() => {
    const activeButton = productRefs.current.get(activeProduct.id);
    const scrollContainer = scrollContainerRef.current;
    if (activeButton && scrollContainer) {
      const containerWidth = scrollContainer.offsetWidth;
      const buttonLeft = activeButton.offsetLeft;
      const buttonWidth = activeButton.offsetWidth;
      const scrollPosition = buttonLeft - containerWidth / 2 + buttonWidth / 2;
      scrollContainer.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
  }, [activeProduct]);

  const labelFor = (app: OrbitApp) => products.find((p) => p.id === app.id)?.name ?? app.label;

  const activeEdges = useMemo(() => {
    return depsInView.filter(([from, to]) => {
      const a = orbitApps[from];
      const b = orbitApps[to];
      return activeProduct.id === a.id || activeProduct.id === b.id;
    });
  }, [depsInView, orbitApps, activeProduct.id]);

  /** Pre-computed geometry for each active edge — path data + midpoint for hover tooltip. */
  const activeEdgeGeometry = useMemo(() => {
    const n = activeEdges.length;
    return activeEdges.map(([from, to, label], i) => {
      const fromApp = orbitApps[from];
      const toApp = orbitApps[to];
      const { d, lx, ly } = depCurveAndLabel(orbitApps, from, to, curveBulge, {
        index: i,
        total: n,
        hero: isHero,
      });
      return { fromApp, toApp, label, d, lx, ly };
    });
  }, [activeEdges, orbitApps, curveBulge, isHero]);

  const orbitFrameClass = isHero
    ? 'relative isolate aspect-square w-full max-w-[min(100%,520px)] sm:max-w-[500px] lg:max-w-[600px] xl:max-w-[640px] mx-auto overflow-visible px-4 sm:px-8 py-5 sm:py-7'
    : 'relative isolate aspect-square w-full max-w-[260px] sm:max-w-[360px] lg:max-w-none mx-auto overflow-visible px-1';

  const orbit = (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.06 }}
      className={motionClassName}
    >
      <div className={cn(orbitFrameClass, 'orbital-ecosystem')} data-theme={theme}>
        <svg
          className="absolute inset-0 w-full h-full overflow-visible z-0"
          viewBox="-14 -14 128 128"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <style>{`
                @keyframes flowDash { to { stroke-dashoffset: -12; } }
                .dep-flow { animation: flowDash 1.5s linear infinite; }
              `}</style>
          </defs>

          <circle
            cx="50"
            cy="50"
            r={orbitRadius}
            fill="none"
            stroke="var(--orbit-grid-stroke)"
            strokeWidth={isHero ? 0.28 : 0.35}
            opacity={isHero ? (isDark ? 0.7 : 0.14) : 0.9}
            style={{ pointerEvents: 'none' }}
          />

          {orbitApps.map((app) => {
            const isActive = activeProduct.id === app.id;
            if ((appIds?.length || isHero) && !isActive) return null;
            return (
              <line
                key={`spoke-${app.id}`}
                x1="50"
                y1="50"
                x2={app.x}
                y2={app.y}
                stroke={isActive ? 'var(--orbit-edge-active)' : 'var(--orbit-edge-idle)'}
                strokeWidth={isActive ? 0.45 : 0.18}
                opacity={isActive ? 1 : 0.55}
                className="transition-all duration-300"
                style={{ pointerEvents: 'none' }}
              />
            );
          })}

          {/* Dashed connection paths — non-interactive, painted first */}
          {activeEdgeGeometry.map(({ fromApp, toApp, d }, i) => (
            <g key={`dep-path-${fromApp.id}-${toApp.id}-${i}`} style={{ pointerEvents: 'none' }}>
              {!isHero ? (
                <path
                  d={d}
                  fill="none"
                  stroke="var(--orbit-dep-faint)"
                  strokeWidth="0.68"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.1}
                />
              ) : null}
              <path
                d={d}
                fill="none"
                stroke="var(--orbit-dep-flow)"
                strokeWidth={isHero ? 0.48 : 0.48}
                strokeDasharray="2.2 2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
                className="dep-flow"
              />
            </g>
          ))}

          {/* Wide transparent hit areas — interactive, painted on top of paths */}
          {activeEdgeGeometry.map(({ fromApp, toApp, label, d, lx, ly }, i) => (
            <path
              key={`dep-hit-${fromApp.id}-${toApp.id}-${i}`}
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={8}
              style={{ pointerEvents: 'all', cursor: 'default' }}
              onMouseEnter={() => setHoveredEdge({ label, lx, ly })}
              onMouseLeave={() => setHoveredEdge(null)}
            />
          ))}
        </svg>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 text-center">
          <div
            className={
              isHero
                ? `w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] lg:w-24 lg:h-24 rounded-full bg-primary flex items-center justify-center mx-auto overflow-hidden ring-[3px] sm:ring-4 shadow-lg ${isDark ? 'ring-white/25 shadow-blue-500/20' : 'ring-white'}`
                : `w-11 h-11 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-primary flex items-center justify-center mx-auto overflow-hidden ring-2 sm:ring-4 ${isDark ? 'ring-white/20' : 'ring-white'}`
            }
          >
            <img
              src={config.LOGO_URL}
              alt="Zopkit"
              className="w-full h-full rounded-full object-cover"
              loading="eager"
            />
          </div>
        </div>

        {orbitApps.map((app) => {
          const isActive = activeProduct.id === app.id;
          const matchingProduct = products.find((p) => p.id === app.id);
          const displayLabel = labelFor(app);
          return (
            <button
              key={app.id}
              ref={(el) => {
                if (el) productRefs.current.set(app.id, el);
              }}
              type="button"
              onClick={() => {
                if (matchingProduct) setActiveProduct(matchingProduct);
              }}
              className={`absolute z-30 group flex flex-col items-center justify-center cursor-pointer focus:outline-none min-w-0 ${
                isHero ? 'gap-[1.375rem] sm:gap-[1.5rem]' : 'gap-3'
              }`}
              style={{
                left: `${app.x}%`,
                top: `${app.y}%`,
                // Shift down so the icon center sits on the orbit ring; label stays below the tile (flex gap).
                transform: isHero
                  ? 'translate(-50%, calc(-50% + 0.85rem))'
                  : 'translate(-50%, calc(-50% + 0.55rem))',
              }}
              aria-label={displayLabel}
            >
              <div
                className={`
                    shrink-0 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-200
                    ${
                      isHero
                        ? 'w-10 h-10 sm:w-[52px] sm:h-[52px] lg:w-14 lg:h-14'
                        : 'w-8 h-8 sm:w-11 sm:h-11 lg:w-[52px] lg:h-[52px]'
                    }
                    ${
                      isActive
                        ? isDark
                          ? 'bg-background ring-2 ring-white/40 ring-offset-2 ring-offset-transparent scale-110 shadow-lg shadow-white/10'
                          : 'bg-[var(--orbit-node-active-bg)] ring-2 ring-[var(--orbit-node-active-bg)] ring-offset-2 ring-offset-background scale-110 shadow-md'
                        : isDark
                          ? 'bg-white/10 border border-white/15 backdrop-blur-sm group-hover:bg-white/20 group-hover:border-white/30 group-hover:scale-105'
                          : 'bg-[var(--orbit-node-idle-bg)] border border-[var(--orbit-node-idle-border)] group-hover:border-border group-hover:bg-background group-hover:shadow-sm group-hover:scale-105'
                    }
                  `}
              >
                <DynamicIcon
                  name={app.icon}
                  className={`transition-colors duration-200 ${
                    isHero
                      ? 'w-4 h-4 sm:w-[22px] sm:h-[22px] lg:w-6 lg:h-6'
                      : 'w-3.5 h-3.5 sm:w-[18px] sm:h-[18px] lg:w-5 lg:h-5'
                  } ${
                    isActive
                      ? isDark ? 'text-primary' : 'text-primary-foreground'
                      : isDark ? 'text-white/55 group-hover:text-white/90' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                />
              </div>
              <p
                className={`text-center font-sans leading-snug px-1 w-full max-w-[min(12.5rem,calc(100vw-3rem))] sm:max-w-[12.5rem] lg:max-w-[13rem] mx-auto break-words [text-wrap:balance] transition-colors duration-200 ${
                  isHero ? 'line-clamp-3 sm:line-clamp-none' : 'line-clamp-2 sm:line-clamp-none'
                } ${
                  isActive
                    ? isHero
                      ? `text-[8px] sm:text-[11px] lg:text-[12px] font-bold ${isDark ? 'text-white' : 'text-primary'}`
                      : `text-[7px] sm:text-[10px] lg:text-[11px] font-bold ${isDark ? 'text-white' : 'text-primary'}`
                    : isHero
                      ? `text-[7px] sm:text-[10px] lg:text-[11px] font-medium ${isDark ? 'text-white/50 group-hover:text-white/80' : 'text-muted-foreground group-hover:text-foreground'}`
                      : `text-[6px] sm:text-[9px] lg:text-[10px] font-medium ${isDark ? 'text-white/50 group-hover:text-white/80' : 'text-muted-foreground group-hover:text-foreground'}`
                }`}
              >
                <span className={`sm:hidden px-1.5 py-0.5 rounded-md ${isDark ? 'bg-transparent' : 'bg-white/90'}`}>{app.short}</span>
                <span className={`hidden sm:inline px-1.5 py-0.5 rounded-md ${isDark ? 'bg-transparent' : 'bg-white/90'}`}>{displayLabel}</span>
              </p>
            </button>
          );
        })}

        {/* Hover tooltip — appears above the hovered connection line's midpoint */}
        {hoveredEdge && (
          <div
            className="absolute z-50 px-2 py-1 rounded-md bg-[var(--orbit-tooltip-bg)] text-primary-foreground text-[11px] font-medium shadow-md pointer-events-none whitespace-nowrap"
            style={{
              left: `${hoveredEdge.lx}%`,
              top: `${hoveredEdge.ly}%`,
              transform: 'translate(-50%, calc(-100% - 8px))',
            }}
          >
            {hoveredEdge.label}
          </div>
        )}
      </div>
    </motion.div>
  );

  const mobileStrip = showMobileStrip ? (
    <div className={layout === 'grid' ? 'col-span-full lg:hidden mt-4' : 'lg:hidden mt-4'}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${isDark ? 'text-white/35' : 'text-muted-foreground'}`}>Explore the ecosystem</p>
      <div ref={scrollContainerRef} className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {orbitApps.map((app) => {
          const isActive = activeProduct.id === app.id;
          const matchingProduct = products.find((p) => p.id === app.id);
          const displayLabel = labelFor(app);
          return (
            <button
              type="button"
              key={`strip-${app.id}`}
              onClick={() => {
                if (matchingProduct) setActiveProduct(matchingProduct);
              }}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer font-sans ${
                isActive
                  ? isDark
                    ? 'bg-background text-[var(--orbit-tab-active-text)] font-bold shadow-sm'
                    : 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : isDark
                    ? 'bg-white/10 text-white/65 font-medium hover:bg-white/18'
                    : 'bg-muted text-muted-foreground font-medium hover:bg-accent'
              }`}
            >
              <DynamicIcon name={app.icon} className={`w-3.5 h-3.5 ${
                isActive
                  ? isDark ? 'text-[var(--orbit-tab-active-text)]' : 'text-primary-foreground'
                  : isDark ? 'text-white/40' : 'text-muted-foreground'
              }`} />
              {displayLabel}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  if (layout === 'grid') {
    return (
      <div className="contents">
        {orbit}
        {mobileStrip}
      </div>
    );
  }

  return (
    <>
      {orbit}
      {mobileStrip}
    </>
  );
};
