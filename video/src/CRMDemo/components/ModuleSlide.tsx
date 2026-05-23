/**
 * ModuleSlide — the standard wrapper for every one of the 21 CRM module beats.
 *
 * Layout:
 *   • Headline fades up (WordReveal) at frame 0
 *   • BrowserFrame lifts in at frame 8 with spring scale
 *   • CalloutChip slides in at frame 25
 *   • StatChip rises at frame 25
 *   • Caption appears at frame 20 (VO line)
 *
 * The SVG content is passed as `children` and fills the BrowserFrame.
 * Each SVG component receives `localFrame` so it can self-animate.
 */
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrowserFrame } from "./BrowserFrame";
import { CalloutChip } from "./CalloutChip";
import { StatChip } from "./StatChip";
import { Caption } from "./Caption";
import { WordReveal } from "./WordReveal";
import { PRM, ff, SPRING_SNAP } from "../tokens";

interface ModuleSlideProps {
  headline: string;
  url: string;
  calloutLabel: string;
  calloutValue: string;
  calloutColor?: string;
  stat: string;
  vo: string;
  showCaptions?: boolean;
  children: React.ReactNode;
}

export const ModuleSlide: React.FC<ModuleSlideProps> = ({
  headline,
  url,
  calloutLabel,
  calloutValue,
  calloutColor = PRM,
  stat,
  vo,
  showCaptions = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // BrowserFrame lift-in
  const frameScale = spring({ frame: frame - 8, fps, config: SPRING_SNAP });
  const frameTranslateY = interpolate(
    spring({ frame: frame - 8, fps, config: SPRING_SNAP }),
    [0, 1],
    [40, 0]
  );
  const frameOpacity = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Headline fade
  const headlineOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)" }}>
      {/* Module headline */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: ff,
          fontSize: 24,
          fontWeight: 700,
          color: PRM,
          letterSpacing: -0.3,
          opacity: headlineOpacity,
          whiteSpace: "nowrap",
        }}
      >
        <WordReveal text={headline} startFrame={0} staggerFrames={3} fadeDuration={8} />
      </div>

      {/* Browser frame wrapping the SVG */}
      <BrowserFrame
        url={url}
        scale={frameScale}
        translateY={frameTranslateY}
        opacity={frameOpacity}
      >
        {children}
      </BrowserFrame>

      {/* Callout chip — top-right of canvas */}
      <CalloutChip
        label={calloutLabel}
        value={calloutValue}
        color={calloutColor}
        startFrame={25}
        top={148}
        right={52}
      />

      {/* Stat chip — bottom-left of canvas */}
      <StatChip value={stat} startFrame={25} bottom={44} left={52} />

      {/* VO caption */}
      <Caption text={vo} startFrame={20} endFrame={74} showCaptions={showCaptions} />
    </AbsoluteFill>
  );
};
