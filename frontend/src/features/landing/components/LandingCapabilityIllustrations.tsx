import type { ReactNode } from 'react'

const sans = 'ui-sans-serif, system-ui, sans-serif'

function ModuleCard({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width="104"
        height="72"
        rx="12"
        fill="#fff"
        stroke="#334155"
        strokeWidth="1.5"
      />
      <rect x="14" y="14" width="36" height="8" rx="2" fill="#e2e8f0" />
      <rect x="14" y="28" width="76" height="6" rx="2" fill="#f1f5f9" />
      <rect x="14" y="40" width="56" height="6" rx="2" fill="#f1f5f9" />
      <text
        x="52"
        y="64"
        textAnchor="middle"
        fill="#64748b"
        fontFamily={sans}
        fontSize="11"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  )
}

function EntityCard({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width="112"
        height="80"
        rx="12"
        fill="#fff"
        stroke="#334155"
        strokeWidth="1.5"
      />
      <circle cx="28" cy="26" r="12" fill="#e2e8f0" />
      <rect x="48" y="16" width="48" height="7" rx="2" fill="#f1f5f9" />
      <rect x="48" y="28" width="36" height="6" rx="2" fill="#f1f5f9" />
      <text
        x="56"
        y="66"
        textAnchor="middle"
        fill="#64748b"
        fontFamily={sans}
        fontSize="10"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  )
}

export function SharedIdentityIllustration() {
  const moduleY = 172
  const moduleCenters = [180, 280, 380] as const
  const userCenterY = 108

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 560 360"
      fill="none"
      aria-hidden="true"
      className="landing-capability-illustration"
    >
      <rect width="560" height="360" fill="#f8fafc" />
      <g stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round">
        {moduleCenters.map((cx) => (
          <path key={cx} d={`M280 ${userCenterY + 12} L${cx} ${moduleY}`} />
        ))}
      </g>
      <g transform="translate(232 48)">
        <circle
          cx="48"
          cy="36"
          r="28"
          fill="#fff"
          stroke="#334155"
          strokeWidth="1.75"
        />
        <circle
          cx="48"
          cy="28"
          r="10"
          fill="#e2e8f0"
          stroke="#334155"
          strokeWidth="1.5"
        />
        <path
          d="M24 58c4-12 16-18 24-18s20 6 24 18"
          fill="#e2e8f0"
          stroke="#334155"
          strokeWidth="1.5"
        />
        <rect
          x="68"
          y="8"
          width="22"
          height="26"
          rx="6"
          fill="#5ee7ff"
          fillOpacity="0.25"
          stroke="#0891b2"
          strokeWidth="1.5"
        />
        <path
          d="M74 18h10M74 24h7"
          stroke="#0891b2"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
      <ModuleCard x={128} y={moduleY} label="CRM" />
      <ModuleCard x={228} y={moduleY} label="HRMS" />
      <ModuleCard x={328} y={moduleY} label="Finance" />
      <text
        x="280"
        y="292"
        textAnchor="middle"
        fill="#475569"
        fontFamily={sans}
        fontSize="13"
        fontWeight="500"
      >
        One login · one role model
      </text>
    </svg>
  )
}

export function SharedRecordsIllustration() {
  const cylinderX = 196
  const cylinderY = 58
  const sideCardY = 118
  const employeeY = 252
  const cylinderCenterX = cylinderX + 84
  const cylinderLeftX = cylinderX + 16
  const cylinderRightX = cylinderX + 152
  const cylinderBottomY = cylinderY + 120
  const sideCardMidY = sideCardY + 40
  const customerRightX = 56 + 112
  const vendorLeftX = 392

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 560 360"
      fill="none"
      aria-hidden="true"
      className="landing-capability-illustration"
    >
      <rect width="560" height="360" fill="#f8fafc" />
      <g transform={`translate(${cylinderX} ${cylinderY})`}>
        <ellipse
          cx="84"
          cy="104"
          rx="68"
          ry="16"
          fill="#e2e8f0"
          stroke="#334155"
          strokeWidth="1.5"
        />
        <path
          d="M16 104v-48c0-8 30-14 68-14s68 6 68 14v96c0 8-30 14-68 14s-68-6-68-14V104"
          fill="#fff"
          stroke="#334155"
          strokeWidth="1.75"
        />
        <ellipse
          cx="84"
          cy="56"
          rx="68"
          ry="16"
          fill="#fff"
          stroke="#334155"
          strokeWidth="1.5"
        />
        <ellipse
          cx="84"
          cy="80"
          rx="68"
          ry="16"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1.25"
        />
        <rect
          x="52"
          y="64"
          width="64"
          height="10"
          rx="3"
          fill="#5ee7ff"
          fillOpacity="0.35"
        />
        <text
          x="84"
          y="72"
          textAnchor="middle"
          fill="#0f172a"
          fontFamily={sans}
          fontSize="10"
          fontWeight="600"
        >
          Core record
        </text>
      </g>
      <g stroke="#0891b2" strokeWidth="1.5" strokeLinecap="round">
        <path d={`M${cylinderLeftX} ${sideCardMidY} H${customerRightX}`} />
        <path d={`M${cylinderRightX} ${sideCardMidY} H${vendorLeftX}`} />
        <path d={`M${cylinderCenterX} ${cylinderBottomY} V${employeeY}`} />
        <path
          d={`M${customerRightX + 8} ${sideCardMidY - 8} l-8 8 8 8`}
          fill="none"
        />
        <path
          d={`M${vendorLeftX - 8} ${sideCardMidY - 8} l8 8-8 8`}
          fill="none"
        />
        <path
          d={`M${cylinderCenterX - 8} ${employeeY - 8} l8 8 8-8`}
          fill="none"
        />
      </g>
      <EntityCard x={56} y={sideCardY} label="Customer" />
      <EntityCard x={392} y={sideCardY} label="Vendor" />
      <EntityCard x={224} y={employeeY} label="Employee" />
      <text
        x="280"
        y="348"
        textAnchor="middle"
        fill="#475569"
        fontFamily={sans}
        fontSize="13"
        fontWeight="500"
      >
        Same data · every module
      </text>
    </svg>
  )
}

export function SharedBillingIllustration() {
  const mainX = 72
  const mainY = 44
  const mainW = 416
  const mainH = 168
  const chipY = 232
  const chipW = 72
  const chipH = 44
  const chipGap = 16
  const chipsTotalW = chipW * 3 + chipGap * 2
  const chipStartX = mainX + (mainW - chipsTotalW) / 2
  const chipXs = [0, 1, 2].map((i) => chipStartX + i * (chipW + chipGap))
  const invoiceX = 448
  const invoiceY = chipY

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 560 360"
      fill="none"
      aria-hidden="true"
      className="landing-capability-illustration"
    >
      <rect width="560" height="360" fill="#f8fafc" />
      <rect
        x={mainX}
        y={mainY}
        width={mainW}
        height={mainH}
        rx="16"
        fill="#fff"
        stroke="#334155"
        strokeWidth="1.75"
      />
      <text
        x={mainX + 24}
        y={mainY + 32}
        fill="#64748b"
        fontFamily="ui-monospace, monospace"
        fontSize="11"
        fontWeight="500"
      >
        BILLING ACCOUNT
      </text>
      <rect
        x={mainX + 24}
        y={mainY + 44}
        width="140"
        height="56"
        rx="10"
        fill="#f1f5f9"
        stroke="#cbd5e1"
      />
      <text
        x={mainX + 36}
        y={mainY + 64}
        fill="#64748b"
        fontFamily={sans}
        fontSize="10"
      >
        Subscriptions
      </text>
      <text
        x={mainX + 36}
        y={mainY + 86}
        fill="#0f172a"
        fontFamily={sans}
        fontSize="18"
        fontWeight="600"
      >
        12 active
      </text>
      <rect
        x={mainX + 180}
        y={mainY + 44}
        width="140"
        height="56"
        rx="10"
        fill="#f1f5f9"
        stroke="#cbd5e1"
      />
      <text
        x={mainX + 192}
        y={mainY + 64}
        fill="#64748b"
        fontFamily={sans}
        fontSize="10"
      >
        Credits
      </text>
      <text
        x={mainX + 192}
        y={mainY + 86}
        fill="#0f172a"
        fontFamily={sans}
        fontSize="18"
        fontWeight="600"
      >
        48,200
      </text>
      <rect
        x={mainX + 336}
        y={mainY + 44}
        width="56"
        height="56"
        rx="10"
        fill="#5ee7ff"
        fillOpacity="0.2"
        stroke="#0891b2"
        strokeWidth="1.5"
      />
      <path
        d={`M${mainX + 352} ${mainY + 64}h24M${mainX + 352} ${mainY + 72}h16M${mainX + 352} ${mainY + 80}h20`}
        stroke="#0891b2"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1={mainX + 24}
        y1={mainY + 116}
        x2={mainX + mainW - 24}
        y2={mainY + 116}
        stroke="#e2e8f0"
        strokeWidth="1.5"
      />
      <rect
        x={mainX + 24}
        y={mainY + 128}
        width="368"
        height="12"
        rx="3"
        fill="#e2e8f0"
      />
      <rect
        x={mainX + 24}
        y={mainY + 128}
        width="248"
        height="12"
        rx="3"
        fill="#334155"
        fillOpacity="0.85"
      />
      <rect
        x={mainX + 24}
        y={mainY + 148}
        width="280"
        height="8"
        rx="2"
        fill="#f1f5f9"
      />
      <rect
        x={mainX + 24}
        y={mainY + 160}
        width="220"
        height="8"
        rx="2"
        fill="#f1f5f9"
      />
      {chipXs.map((x) => (
        <g key={x} transform={`translate(${x} ${chipY})`}>
          <rect
            width={chipW}
            height={chipH}
            rx="8"
            fill="#fff"
            stroke="#334155"
            strokeWidth="1.25"
          />
          <rect x="10" y="12" width="52" height="6" rx="2" fill="#cbd5e1" />
          <rect x="10" y="24" width="32" height="5" rx="2" fill="#e2e8f0" />
        </g>
      ))}
      <path
        d={`M${chipXs[2] + chipW} ${chipY + chipH / 2} H${invoiceX}`}
        stroke="#0891b2"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
      <rect
        x={invoiceX}
        y={invoiceY}
        width="96"
        height={chipH}
        rx="8"
        fill="#334155"
      />
      <text
        x={invoiceX + 48}
        y={invoiceY + 18}
        textAnchor="middle"
        fill="#f8fafc"
        fontFamily={sans}
        fontSize="10"
        fontWeight="600"
      >
        One invoice
      </text>
      <text
        x={invoiceX + 48}
        y={invoiceY + 34}
        textAnchor="middle"
        fill="#94a3b8"
        fontFamily={sans}
        fontSize="9"
      >
        Finance view
      </text>
      <text
        x="280"
        y="312"
        textAnchor="middle"
        fill="#475569"
        fontFamily={sans}
        fontSize="13"
        fontWeight="500"
      >
        Single account · full picture
      </text>
    </svg>
  )
}

const CAPABILITY_ILLUSTRATIONS: Record<string, () => ReactNode> = {
  'Shared identity': () => <SharedIdentityIllustration />,
  'Shared records': () => <SharedRecordsIllustration />,
  'Shared billing': () => <SharedBillingIllustration />,
}

export function getCapabilityIllustration(title: string): ReactNode | null {
  const render = CAPABILITY_ILLUSTRATIONS[title]
  return render ? render() : null
}
