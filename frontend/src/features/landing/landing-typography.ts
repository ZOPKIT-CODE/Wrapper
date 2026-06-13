/** Shared landing page font stacks — Inter Tight display, Inter body, JetBrains Mono labels. */
export const landingFonts = {
  display: "'Inter Tight', ui-sans-serif, system-ui, sans-serif",
  body: "'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const

export const landingType = {
  displayTracking: '-0.025em',
  monoTrackingWide: '0.14em',
  monoTrackingWider: '0.22em',
} as const
