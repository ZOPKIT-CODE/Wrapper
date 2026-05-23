import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { NAV, NEG, ff, SPRING_SNAP } from "../tokens";

// ─── timing ────────────────────────────────────────────────────────────────────
const T_LABEL  = 0;   // "The problem" label
const T_TOOL1  = 12;  // Sales tool card springs in
const T_TOOL2  = 28;  // Help desk card
const T_TOOL3  = 44;  // Marketing card
const T_CONN1  = 58;  // Connector line 1 draws
const T_CONN2  = 68;  // Connector line 2 draws
const T_BREAK  = 92;  // Tools start glowing red
const T_GONE   = 142; // Tools dissolve
const T_VO_CAP = 112; // Caption

// ── Shared tool card ───────────────────────────────────────────────────────────
interface ToolCardProps {
  label: string;
  icon: string;
  delay: number;
  breakStart: number;
  goneStart: number;
}

const ToolCard: React.FC<ToolCardProps> = ({
  label,
  icon,
  delay,
  breakStart,
  goneStart,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sc = spring({ frame: frame - delay, fps, config: SPRING_SNAP });
  const appear = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breakP = interpolate(frame, [breakStart, breakStart + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const goneP = interpolate(frame, [goneStart, goneStart + 22], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const borderCol = breakP > 0.2
    ? `rgba(239,68,68,${0.2 + breakP * 0.7})`
    : "rgba(255,255,255,0.18)";
  const glowShadow = breakP > 0.2
    ? `0 0 48px rgba(239,68,68,${breakP * 0.35})`
    : "none";
  const labelColor = breakP > 0.25
    ? `rgba(239,68,68,${0.4 + breakP * 0.6})`
    : "rgba(255,255,255,0.72)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        opacity: Math.min(appear, goneP),
        transform: `scale(${sc})`,
      }}
    >
      <div
        style={{
          width: 128,
          height: 128,
          borderRadius: 30,
          background: "rgba(255,255,255,0.07)",
          border: `2px solid ${borderCol}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: glowShadow,
          transition: "none",
        }}
      >
        <span style={{ fontSize: 52 }}>{icon}</span>
      </div>
      <div
        style={{
          fontFamily: ff,
          fontSize: 20,
          fontWeight: 600,
          color: labelColor,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ── Connector SVG ──────────────────────────────────────────────────────────────
interface ConnectorProps {
  drawStart: number;
  breakStart: number;
  goneStart: number;
}

const Connector: React.FC<ConnectorProps> = ({ drawStart, breakStart, goneStart }) => {
  const frame = useCurrentFrame();
  const drawP  = interpolate(frame, [drawStart, drawStart + 28], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const breakP = interpolate(frame, [breakStart, breakStart + 28], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const goneP  = interpolate(frame, [goneStart, goneStart + 22], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const strokeColor = breakP > 0.2 ? `rgba(239,68,68,${0.5 + breakP * 0.5})` : "rgba(255,255,255,0.28)";
  const dashArray   = breakP > 0.45 ? `${6 + breakP * 10} ${6 + breakP * 10}` : "none";
  const lineLen     = drawP * 140;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: goneP }}>
      <svg width={140} height={24} viewBox="0 0 140 24" style={{ overflow: "visible" }}>
        <line
          x1="0" y1="12"
          x2={lineLen} y2="12"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeDasharray={dashArray}
          strokeLinecap="round"
        />
        {/* Arrowhead */}
        {drawP > 0.9 && (
          <path
            d={`M ${lineLen - 8} 7 L ${lineLen} 12 L ${lineLen - 8} 17`}
            stroke={strokeColor}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {breakP > 0.45 && (
        <div
          style={{
            fontFamily: ff,
            fontSize: 11,
            fontWeight: 700,
            color: `rgba(239,68,68,${breakP})`,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          no sync
        </div>
      )}
    </div>
  );
};

// ── Section ────────────────────────────────────────────────────────────────────
export const Problem: React.FC<{ showCaptions?: boolean }> = ({
  showCaptions = true,
}) => {
  const frame = useCurrentFrame();

  const labelOpacity = interpolate(frame, [T_LABEL, T_LABEL + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const billingOpacity = interpolate(
    frame,
    [T_BREAK + 30, T_BREAK + 48],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const vo =
    "A sales tool. A help desk. A marketing platform.\nNone of them talking. All of them billing you.";

  return (
    <AbsoluteFill style={{ background: NAV }}>
      {/* Section label */}
      <div
        style={{
          position: "absolute",
          top: 108,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: ff,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 4.5,
          color: "rgba(255,255,255,0.30)",
          textTransform: "uppercase",
          opacity: labelOpacity,
        }}
      >
        The problem
      </div>

      {/* Three tool cards + connectors */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -54%)",
          display: "flex",
          alignItems: "center",
          gap: 0,
        }}
      >
        <ToolCard
          label="Sales Tool"
          icon="💼"
          delay={T_TOOL1}
          breakStart={T_BREAK}
          goneStart={T_GONE}
        />
        <Connector drawStart={T_CONN1} breakStart={T_BREAK + 6} goneStart={T_GONE + 4} />
        <ToolCard
          label="Help Desk"
          icon="🎧"
          delay={T_TOOL2}
          breakStart={T_BREAK + 12}
          goneStart={T_GONE + 8}
        />
        <Connector drawStart={T_CONN2} breakStart={T_BREAK + 18} goneStart={T_GONE + 8} />
        <ToolCard
          label="Marketing"
          icon="📣"
          delay={T_TOOL3}
          breakStart={T_BREAK + 22}
          goneStart={T_GONE + 12}
        />
      </div>

      {/* "All of them billing you." */}
      <div
        style={{
          position: "absolute",
          bottom: 230,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: ff,
          fontSize: 32,
          fontWeight: 700,
          color: NEG,
          opacity: billingOpacity,
          textAlign: "center",
          letterSpacing: -0.4,
          whiteSpace: "nowrap",
        }}
      >
        All of them billing you separately.
      </div>

      <Caption
        text={vo}
        startFrame={T_VO_CAP}
        endFrame={178}
        showCaptions={showCaptions}
      />
    </AbsoluteFill>
  );
};
