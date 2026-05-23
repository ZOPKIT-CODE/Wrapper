import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption } from "../components/Caption";
import { WordReveal } from "../components/WordReveal";
import { NAV, PRM, BLUE, GREEN, ff, SPRING_SNAP } from "../tokens";

// ─── timing constants (frames @ 30fps) ────────────────────────────────────────
const T_BG_IN       = 0;   // background fades in
const T_WORDMARK    = 8;   // wordmark springs in
const T_BADGE       = 42;  // "B2B CRM" badge fades up
const T_TAGLINE     = 68;  // tagline word-reveal starts
const T_VO_CAP      = 105; // caption appears

export const Hero: React.FC<{ showCaptions?: boolean }> = ({
  showCaptions = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background
  const bgOpacity = interpolate(frame, [T_BG_IN, T_BG_IN + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Wordmark
  const markScale = spring({ frame: frame - T_WORDMARK, fps, config: SPRING_SNAP });
  const markOpacity = interpolate(frame, [T_WORDMARK, T_WORDMARK + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Badge
  const badgeOpacity = interpolate(frame, [T_BADGE, T_BADGE + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const badgeY = interpolate(frame, [T_BADGE, T_BADGE + 14], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Decorative orbs follow bgOpacity
  const orbOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const vo = "Most companies pay three vendors to track one customer.";

  return (
    <AbsoluteFill style={{ background: NAV, opacity: bgOpacity }}>
      {/* Soft radial orbs — brand accent colours, very subtle */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          right: "8%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(59,130,246,0.16) 0%, transparent 70%)",
          opacity: orbOpacity,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "6%",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
          opacity: orbOpacity,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          right: "18%",
          width: 220,
          height: 220,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)",
          opacity: orbOpacity,
          pointerEvents: "none",
        }}
      />

      {/* ── Centre column ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          fontFamily: ff,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            fontSize: 108,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: -4,
            lineHeight: 1,
            opacity: markOpacity,
            transform: `scale(${markScale})`,
            transformOrigin: "center center",
            marginBottom: 20,
          }}
        >
          Zopkit
        </div>

        {/* B2B CRM badge */}
        <div
          style={{
            opacity: badgeOpacity,
            transform: `translateY(${badgeY}px)`,
            marginBottom: 52,
          }}
        >
          <span
            style={{
              display: "inline-block",
              background: PRM,
              color: "#FFFFFF",
              fontFamily: ff,
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: 4,
              padding: "6px 22px",
              borderRadius: 100,
              textTransform: "uppercase",
            }}
          >
            B2B CRM
          </span>
        </div>

        {/* Tagline — word-by-word reveal */}
        <div
          style={{
            fontSize: 40,
            fontWeight: 600,
            color: "rgba(255,255,255,0.90)",
            letterSpacing: -0.6,
            lineHeight: 1.3,
            maxWidth: 860,
          }}
        >
          <WordReveal
            text="One platform. Three teams. Zero tab-switching."
            startFrame={T_TAGLINE}
            staggerFrames={4}
            fadeDuration={10}
          />
        </div>
      </div>

      {/* VO caption */}
      <Caption
        text={vo}
        startFrame={T_VO_CAP}
        endFrame={178}
        showCaptions={showCaptions}
      />
    </AbsoluteFill>
  );
};
