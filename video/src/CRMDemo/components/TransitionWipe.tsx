import React from "react";
import { interpolate } from "remotion";
import { PRM } from "../tokens";

interface TransitionWipeProps {
  /** Global frame (parent composition's useCurrentFrame) */
  frame: number;
  /** Frame indices where a wipe should occur */
  boundaries: number[];
  /** Duration of each half of the wipe in frames (~250ms @ 30fps = 8 frames) */
  wipeDuration?: number;
  color?: string;
}

export const TransitionWipe: React.FC<TransitionWipeProps> = ({
  frame,
  boundaries,
  wipeDuration = 8,
  color = PRM,
}) => {
  for (const boundary of boundaries) {
    const exitStart  = boundary - wipeDuration;
    const exitEnd    = boundary;
    const enterStart = boundary;
    const enterEnd   = boundary + wipeDuration;

    let translateX: number | null = null;

    if (frame >= exitStart && frame < exitEnd) {
      // Wipe slides IN from the right (exit of old section)
      const p = interpolate(frame, [exitStart, exitEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      translateX = (1 - p) * 1920; // 1920 → 0
    } else if (frame >= enterStart && frame < enterEnd) {
      // Wipe slides OUT to the left (enter of new section)
      const p = interpolate(frame, [enterStart, enterEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      translateX = -p * 1920; // 0 → -1920
    }

    if (translateX !== null) {
      return (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: translateX,
            width: 1920,
            height: 1080,
            background: color,
            pointerEvents: "none",
            zIndex: 100,
          }}
        />
      );
    }
  }

  return null;
};
