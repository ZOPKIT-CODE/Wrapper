// Design tokens — mirror the getCRMFeatureSvg.tsx palette exactly
export const NAV  = "#0d1f3a";
export const W    = "#FFFFFF";
export const BD   = "#E2E8F0";
export const H    = "#0F172A";
export const M    = "#64748B";
export const PRM  = "#1B2E5A";
export const POS  = "#10B981";
export const WARN = "#F59E0B";
export const NEG  = "#EF4444";

export const BLUE   = "#3B82F6";
export const VIOLET = "#8B5CF6";
export const AMBER  = "#F59E0B";
export const TEAL   = "#06B6D4";
export const PINK   = "#EC4899";
export const GREEN  = "#10B981";

export const ff = "system-ui,-apple-system,sans-serif";

// Spring configs
export const SPRING_SNAP   = { damping: 28,  stiffness: 120, mass: 1 } as const;
export const SPRING_SOFT   = { damping: 200, stiffness: 50,  mass: 1 } as const;
export const SPRING_BOUNCE = { damping: 18,  stiffness: 180, mass: 1 } as const;
