import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface WordRevealProps {
  text: string;
  startFrame: number;
  /** Frames between each word reveal (~40ms = 1.2f; use 3–5f for legibility) */
  staggerFrames?: number;
  /** Frames for each word fade-up transition */
  fadeDuration?: number;
  style?: React.CSSProperties;
  wordStyle?: React.CSSProperties;
}

export const WordReveal: React.FC<WordRevealProps> = ({
  text,
  startFrame,
  staggerFrames = 4,
  fadeDuration = 10,
  style,
  wordStyle,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <span style={{ display: "inline", ...style }}>
      {words.map((word, i) => {
        const localFrame = frame - startFrame - i * staggerFrames;
        const opacity = interpolate(localFrame, [0, fadeDuration], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = interpolate(localFrame, [0, fadeDuration], [14, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `translateY(${y}px)`,
              marginRight: "0.28em",
              ...wordStyle,
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};
