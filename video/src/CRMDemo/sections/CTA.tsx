// CTA — 225 frames (7.5s) — final brand moment + call to action
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { NAV, PRM, POS, BLUE, ff, SPRING_SNAP, SPRING_SOFT } from "../tokens";

const T_LOGO     = 0;
const T_HEADLINE = 28;
const T_SUB      = 56;
const T_BUTTON   = 80;
const T_URL      = 104;
const T_VO_CAP   = 120;

// Floating particle — uses deterministic position from index
const Particle: React.FC<{ idx: number; frame: number }> = ({ idx, frame }) => {
  const cols = ["#3B82F6", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B"];
  const col = cols[idx % 5];
  const cx = 120 + (idx * 137) % 1680;
  const cy = 80 + (idx * 211) % 920;
  const r = 2 + (idx % 3);
  const drift = Math.sin(frame * 0.02 + idx) * 8;

  const opacity = interpolate(frame, [0, 30], [0, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy + drift,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        background: col,
        opacity,
      }}
    />
  );
};

interface Props {
  showCaptions?: boolean;
}

export const CTA: React.FC<Props> = ({ showCaptions = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame: frame - T_LOGO, fps, config: SPRING_SNAP });
  const logoOpacity = interpolate(frame, [T_LOGO, T_LOGO + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headlineOpacity = interpolate(frame, [T_HEADLINE, T_HEADLINE + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineY = interpolate(
    spring({ frame: frame - T_HEADLINE, fps, config: SPRING_SOFT }),
    [0, 1], [24, 0]
  );

  const subOpacity = interpolate(frame, [T_SUB, T_SUB + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const buttonScale = spring({ frame: frame - T_BUTTON, fps, config: SPRING_SNAP });
  const buttonOpacity = interpolate(frame, [T_BUTTON, T_BUTTON + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const urlOpacity = interpolate(frame, [T_URL, T_URL + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const vo = "Zopkit B2B CRM — one system for sales, support, and marketing. Start your free 14-day trial at zopkit.com.";

  return (
    <AbsoluteFill style={{ background: NAV }}>
      {/* Background particles */}
      {Array.from({ length: 20 }, (_, i) => (
        <Particle key={i} idx={i} frame={frame} />
      ))}

      {/* Subtle radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 900px 600px at 50% 40%, rgba(59,130,246,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Logo wordmark */}
      <div
        style={{
          position: "absolute",
          top: 220,
          left: "50%",
          transform: `translateX(-50%) scale(${logoScale})`,
          opacity: logoOpacity,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "#3B82F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(59,130,246,0.4)",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              border: "3px solid #FFFFFF",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#FFFFFF",
              }}
            />
          </div>
        </div>
        {/* Wordmark */}
        <div
          style={{
            fontFamily: ff,
            fontSize: 36,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: -1,
          }}
        >
          Zopkit
        </div>
        <div
          style={{
            fontFamily: ff,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            marginLeft: 4,
            paddingTop: 14,
          }}
        >
          B2B CRM
        </div>
      </div>

      {/* Headline */}
      <div
        style={{
          position: "absolute",
          top: 332,
          left: "50%",
          transform: `translateX(-50%) translateY(${headlineY}px)`,
          opacity: headlineOpacity,
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            fontFamily: ff,
            fontSize: 62,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: -2.5,
            lineHeight: 1.1,
          }}
        >
          Sales. Support. Marketing.
        </div>
        <div
          style={{
            fontFamily: ff,
            fontSize: 62,
            fontWeight: 800,
            color: "#10B981",
            letterSpacing: -2.5,
            lineHeight: 1.1,
          }}
        >
          Finally in one place.
        </div>
      </div>

      {/* Subtext */}
      <div
        style={{
          position: "absolute",
          top: 500,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: subOpacity,
          fontFamily: ff,
          fontSize: 20,
          color: "rgba(255,255,255,0.55)",
          textAlign: "center",
          letterSpacing: -0.2,
          whiteSpace: "nowrap",
        }}
      >
        14-day free trial · No credit card required · Set up in under 10 minutes
      </div>

      {/* CTA button */}
      <div
        style={{
          position: "absolute",
          top: 572,
          left: "50%",
          transform: `translateX(-50%) scale(${buttonScale})`,
          opacity: buttonOpacity,
        }}
      >
        <div
          style={{
            background: "#10B981",
            borderRadius: 14,
            padding: "20px 52px",
            fontFamily: ff,
            fontSize: 22,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: -0.3,
            boxShadow: "0 16px 48px rgba(16,185,129,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          Start Free Trial →
        </div>
      </div>

      {/* URL */}
      <div
        style={{
          position: "absolute",
          top: 672,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: urlOpacity,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 100,
          padding: "10px 28px",
          fontFamily: ff,
          fontSize: 16,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
        }}
      >
        zopkit.com
      </div>

      <Caption
        text={vo}
        startFrame={T_VO_CAP}
        endFrame={223}
        showCaptions={showCaptions}
      />
    </AbsoluteFill>
  );
};
