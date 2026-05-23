// Outcome — 210 frames (7s) — four proof stats that count up
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { PRM, POS, BLUE, VIOLET, TEAL, ff, SPRING_SNAP } from "../tokens";

const T_LABEL   = 0;
const T_TILE1   = 20;
const T_TILE2   = 48;
const T_TILE3   = 76;
const T_TILE4   = 104;
const T_VO_CAP  = 120;

interface TileProps {
  startFrame: number;
  value: string;
  subvalue?: string;
  label: string;
  accent: string;
  icon: string;
}

const StatTile: React.FC<TileProps> = ({ startFrame, value, subvalue, label, accent, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sc = spring({ frame: frame - startFrame, fps, config: SPRING_SNAP });
  const opacity = interpolate(frame, [startFrame, startFrame + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${sc})`,
        background: "#FFFFFF",
        borderRadius: 20,
        border: `1.5px solid #E2E8F0`,
        boxShadow: `0 20px 56px rgba(27,46,90,0.10), 0 4px 16px rgba(0,0,0,0.05)`,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 40, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontFamily: ff, fontSize: 44, fontWeight: 800, color: accent, letterSpacing: -2, lineHeight: 1 }}>
        {value}
      </div>
      {subvalue && (
        <div style={{ fontFamily: ff, fontSize: 16, fontWeight: 600, color: accent, opacity: 0.6 }}>
          {subvalue}
        </div>
      )}
      <div style={{ fontFamily: ff, fontSize: 14, fontWeight: 600, color: "#64748B", textAlign: "center", lineHeight: 1.4 }}>
        {label}
      </div>
    </div>
  );
};

interface Props {
  showCaptions?: boolean;
}

export const Outcome: React.FC<Props> = ({ showCaptions = true }) => {
  const frame = useCurrentFrame();

  const labelOpacity = interpolate(frame, [T_LABEL, T_LABEL + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const vo = "One system. Sales closes faster. Support resolves in context. Marketing sees what converts. Every team, finally aligned.";

  return (
    <AbsoluteFill style={{ background: "linear-gradient(150deg, #0d1f3a 0%, #132444 100%)" }}>
      {/* Section label */}
      <div
        style={{
          position: "absolute",
          top: 88,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: ff,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 5,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          opacity: labelOpacity,
          whiteSpace: "nowrap",
        }}
      >
        Results at a glance
      </div>

      {/* Headline */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: ff,
          fontSize: 52,
          fontWeight: 800,
          color: "#FFFFFF",
          letterSpacing: -2,
          opacity: interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          whiteSpace: "nowrap",
        }}
      >
        One system.{" "}
        <span style={{ color: "#10B981" }}>Every team.</span>
      </div>

      {/* Stat tiles — 2×2 grid */}
      <div
        style={{
          position: "absolute",
          top: 210,
          left: "50%",
          transform: "translateX(-50%)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          width: 920,
        }}
      >
        <StatTile
          startFrame={T_TILE1}
          value="$8.2M"
          label="Total pipeline managed across all teams"
          accent={BLUE}
          icon="📈"
        />
        <StatTile
          startFrame={T_TILE2}
          value="3"
          subvalue="teams unified"
          label="Sales · Support · Marketing in one record"
          accent={TEAL}
          icon="🤝"
        />
        <StatTile
          startFrame={T_TILE3}
          value="−28%"
          label="Reduction in average deal cycle time"
          accent={POS}
          icon="⚡"
        />
        <StatTile
          startFrame={T_TILE4}
          value="94%"
          label="Customer retention rate across accounts"
          accent={VIOLET}
          icon="💎"
        />
      </div>

      <Caption
        text={vo}
        startFrame={T_VO_CAP}
        endFrame={208}
        showCaptions={showCaptions}
      />
    </AbsoluteFill>
  );
};
