import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { PRM, ff } from "../tokens";

interface CaptionProps {
  text: string;
  startFrame: number;
  endFrame: number;
  showCaptions?: boolean;
}

export const Caption: React.FC<CaptionProps> = ({
  text,
  startFrame,
  endFrame,
  showCaptions = true,
}) => {
  const frame = useCurrentFrame();

  if (!showCaptions) return null;

  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 8, endFrame - 8, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  if (opacity <= 0.01) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 52,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(255,255,255,0.97)",
        borderRadius: 12,
        padding: "12px 32px",
        fontFamily: ff,
        fontSize: 22,
        fontWeight: 600,
        color: PRM,
        opacity,
        maxWidth: 1280,
        textAlign: "center",
        letterSpacing: 0.1,
        lineHeight: 1.45,
        boxShadow: "0 2px 20px rgba(0,0,0,0.09)",
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
};
