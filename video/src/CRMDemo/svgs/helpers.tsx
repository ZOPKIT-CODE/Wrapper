// Shared SVG helpers — mirrored from getCRMFeatureSvg, exported for animation use
import React from "react";
import { NAV, W, BD, H, M, PRM, ff } from "../tokens";

export const Sb: React.FC = () => (
  <g>
    <rect width="28" height="480" fill={NAV} />
    <rect x="7" y="8" width="14" height="14" rx="3" fill="#3B82F6" />
    {[0, 1, 2, 3, 4].map((j) => (
      <g key={j}>
        <rect x="8" y={34 + j * 36} width="12" height="2.5" rx="1.25" fill="rgba(255,255,255,0.25)" />
        <rect x="8" y={39.5 + j * 36} width="8" height="1.5" rx="0.75" fill="rgba(255,255,255,0.12)" />
      </g>
    ))}
    <circle cx="14" cy="462" r="7" fill="rgba(255,255,255,0.12)" />
  </g>
);

export const Hdr = (title: string, crumb: string, btn?: string) => (
  <g>
    <rect x="28" y="0" width="772" height="44" fill={W} />
    <line x1="28" y1="44" x2="800" y2="44" stroke={BD} strokeWidth="0.5" />
    <text x="40" y="18" fontFamily={ff} fontSize="13" fontWeight="700" fill={H}>{title}</text>
    <text x="40" y="34" fontFamily={ff} fontSize="9" fill={M}>{crumb}</text>
    {btn && (
      <React.Fragment>
        <rect x={796 - btn.length * 6 - 14} y="11" width={btn.length * 6 + 14} height="22" rx="5" fill={PRM} />
        <text x={796 - btn.length * 3} y="25" fontFamily={ff} fontSize="9" fontWeight="600" fill={W} textAnchor="middle">{btn}</text>
      </React.Fragment>
    )}
  </g>
);

export const K4 = (x: number, y: number, lbl: string, val: string, help: string, hc = M) => (
  <g key={`k4-${x}-${y}`}>
    <rect x={x} y={y} width="182" height="66" rx="6" fill={W} stroke={BD} strokeWidth="1" />
    <text x={x + 12} y={y + 15} fontFamily={ff} fontSize="7.5" fontWeight="700" fill={M} letterSpacing="0.06em">{lbl}</text>
    <text x={x + 12} y={y + 39} fontFamily={ff} fontSize="17" fontWeight="700" fill={H}>{val}</text>
    <text x={x + 12} y={y + 54} fontFamily={ff} fontSize="8.5" fill={hc}>{help}</text>
  </g>
);

export const K3 = (x: number, y: number, lbl: string, val: string, help: string, hc = M) => (
  <g key={`k3-${x}-${y}`}>
    <rect x={x} y={y} width="245" height="66" rx="6" fill={W} stroke={BD} strokeWidth="1" />
    <text x={x + 12} y={y + 15} fontFamily={ff} fontSize="7.5" fontWeight="700" fill={M} letterSpacing="0.06em">{lbl}</text>
    <text x={x + 12} y={y + 39} fontFamily={ff} fontSize="17" fontWeight="700" fill={H}>{val}</text>
    <text x={x + 12} y={y + 54} fontFamily={ff} fontSize="8.5" fill={hc}>{help}</text>
  </g>
);

export const Pill = (x: number, y: number, text: string, bg: string, tc: string, pw = 44) => (
  <g key={`pill-${x}-${y}`}>
    <rect x={x} y={y - 11} width={pw} height="15" rx="7" fill={bg} />
    <text x={x + pw / 2} y={y + 1} fontFamily={ff} fontSize="8.5" fontWeight="600" fill={tc} textAnchor="middle">{text}</text>
  </g>
);

export const ThRow = (y: number, x = 36, w = 752) => (
  <rect x={x} y={y} width={w} height="22" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
);

export const Tr = (y: number, even: boolean, x = 36, w = 752) => (
  <rect x={x} y={y} width={w} height="32" rx="3" fill={even ? W : "#F8FAFC"} stroke={BD} strokeWidth="0.5" />
);

export const T = (
  x: number, y: number, txt: string, sz = 9.5, bold = false,
  color = H, anchor: "start" | "middle" | "end" = "start",
) => (
  <text key={`t-${x}-${y}-${txt.slice(0, 6)}`} x={x} y={y} fontFamily={ff} fontSize={sz}
    fontWeight={bold ? "700" : "400"} fill={color} textAnchor={anchor}>{txt}</text>
);

export const Avatar = (cx: number, cy: number, ini: string, col: string, r = 9) => (
  <g key={`av-${cx}-${cy}-${ini}`}>
    <circle cx={cx} cy={cy} r={r} fill={col} opacity="0.15" />
    <text x={cx} y={cy + 3} fontFamily={ff} fontSize={r * 0.85} fontWeight="700" fill={col} textAnchor="middle">{ini}</text>
  </g>
);
