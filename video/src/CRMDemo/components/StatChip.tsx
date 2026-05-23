import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { PRM, ff } from "../tokens";

interface StatChipProps {
  value: string;
  startFrame?: number;
  bottom?: number;
  left?: number;
}

export const StatChip: React.FC<StatChipProps> = ({
  value,
  startFrame = 25,
  bottom = 40,
  left = 52,
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
        bottom,
        left,
        background: PRM,
        color: "#FFFFFF",
        borderRadius: 100,
        padding: "9px 22px",
        fontFamily: ff,
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: 0.1,
        opacity: t,
        transform: `translateY(${interpolate(t, [0, 1], [10, 0])}px)`,
        boxShadow: "0 4px 20px rgba(27,46,90,0.28)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </div>
  );
};
