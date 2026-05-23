import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { PRM, ff } from "../tokens";

interface CalloutChipProps {
  label: string;
  value: string;
  color?: string;
  startFrame?: number;
  /** Absolute top offset from the canvas top (not the browser frame) */
  top?: number;
  right?: number;
}

export const CalloutChip: React.FC<CalloutChipProps> = ({
  label,
  value,
  color = PRM,
  startFrame = 30,
  top = 160,
  right = 52,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - startFrame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top,
        right,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "rgba(255,255,255,0.97)",
        border: `1.5px solid ${color}22`,
        borderRadius: 14,
        padding: "10px 18px",
        boxShadow: `0 8px 32px rgba(0,0,0,0.10), 0 0 0 1px ${color}18`,
        opacity: t,
        transform: `translateX(${interpolate(t, [0, 1], [16, 0])}px)`,
        fontFamily: ff,
        pointerEvents: "none",
      }}
    >
      <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, letterSpacing: 0.3, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, color: "#0F172A", fontWeight: 700, letterSpacing: -0.1 }}>
          {value}
        </div>
      </div>
    </div>
  );
};
