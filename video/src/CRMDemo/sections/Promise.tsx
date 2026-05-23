import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { WordReveal } from "../components/WordReveal";
import { NAV, PRM, BLUE, TEAL, VIOLET, ff, SPRING_SNAP } from "../tokens";

// ─── timing ────────────────────────────────────────────────────────────────────
const T_BG_OUT   = 0;   // dark overlay fades away (bg transitions dark → light)
const T_CARD_IN  = 20;  // customer card springs up
const T_RIB1     = 48;  // Sales ribbon slides in
const T_RIB2     = 64;  // Support ribbon
const T_RIB3     = 80;  // Marketing ribbon
const T_LABEL    = 102; // "One record." tagline
const T_VO_CAP   = 112; // Caption

// ── Ribbon row ─────────────────────────────────────────────────────────────────
interface RibbonProps {
  startFrame: number;
  accentColor: string;
  bgColor: string;
  teamLabel: string;
  detail: string;
}

const Ribbon: React.FC<RibbonProps> = ({
  startFrame,
  accentColor,
  bgColor,
  teamLabel,
  detail,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: t,
        transform: `translateX(${interpolate(t, [0, 1], [-24, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 4,
          height: 46,
          borderRadius: 2,
          background: accentColor,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          flex: 1,
          background: bgColor,
          borderRadius: 12,
          padding: "10px 18px",
          fontFamily: ff,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: accentColor,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 3,
          }}
        >
          {teamLabel}
        </div>
        <div style={{ fontSize: 14, color: "#0F172A", lineHeight: 1.3 }}>
          {detail}
        </div>
      </div>
    </div>
  );
};

// ── Section ────────────────────────────────────────────────────────────────────
export const Promise: React.FC<{ showCaptions?: boolean }> = ({
  showCaptions = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Dark overlay fades OUT revealing the light background
  const darkOverlay = interpolate(frame, [T_BG_OUT, T_BG_OUT + 38], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Card spring
  const cardScale = spring({ frame: frame - T_CARD_IN, fps, config: SPRING_SNAP });
  const cardOpacity = interpolate(frame, [T_CARD_IN, T_CARD_IN + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "One record." line
  const taglineOpacity = interpolate(frame, [T_LABEL, T_LABEL + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const vo =
    "Zopkit B2B CRM runs your entire customer lifecycle in one system — from first webform to closed invoice to open ticket.";

  return (
    <AbsoluteFill>
      {/* Light background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(150deg, #f0f4ff 0%, #e8f0ff 100%)",
        }}
      />

      {/* Dark overlay fades out — creates the dark-to-light transition */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: NAV,
          opacity: darkOverlay,
          pointerEvents: "none",
        }}
      />

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
          color: "rgba(27,46,90,0.38)",
          textTransform: "uppercase",
          opacity: interpolate(frame, [32, 52], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        The solution
      </div>

      {/* ── Central customer card ─────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 560,
          transform: `translate(-50%, -54%) scale(${cardScale})`,
          opacity: cardOpacity,
        }}
      >
        {/* Card shell */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 22,
            border: "1.5px solid #E2E8F0",
            boxShadow:
              "0 24px 72px rgba(27,46,90,0.13), 0 4px 16px rgba(0,0,0,0.06)",
            padding: "32px 36px",
          }}
        >
          {/* Avatar + name row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#EFF6FF",
                border: "2.5px solid #3B82F6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 800,
                color: BLUE,
                fontFamily: ff,
                flexShrink: 0,
              }}
            >
              SC
            </div>
            <div>
              <div
                style={{
                  fontFamily: ff,
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#0F172A",
                  letterSpacing: -0.2,
                }}
              >
                Sarah Chen
              </div>
              <div style={{ fontFamily: ff, fontSize: 14, color: "#64748B", marginTop: 2 }}>
                VP Sales · Acme Holdings
              </div>
            </div>
            {/* "One record" chip */}
            <div
              style={{
                marginLeft: "auto",
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 100,
                padding: "4px 14px",
                fontFamily: ff,
                fontSize: 12,
                fontWeight: 700,
                color: BLUE,
                whiteSpace: "nowrap",
              }}
            >
              1 record
            </div>
          </div>

          {/* Three team ribbons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Ribbon
              startFrame={T_RIB1}
              accentColor={BLUE}
              bgColor="#EFF6FF"
              teamLabel="Sales"
              detail="Acme Q2 Renewal · $340K · Stage: Negotiate"
            />
            <Ribbon
              startFrame={T_RIB2}
              accentColor={TEAL}
              bgColor="#ECFEFF"
              teamLabel="Support"
              detail="TKT-4218 · Gmail sync issue · High · SLA: 2h 12m"
            />
            <Ribbon
              startFrame={T_RIB3}
              accentColor={VIOLET}
              bgColor="#F5F3FF"
              teamLabel="Marketing"
              detail="Spring Webinar Series · Lead source · $420K influenced"
            />
          </div>
        </div>

        {/* Tagline below card */}
        <div
          style={{
            textAlign: "center",
            marginTop: 36,
            fontFamily: ff,
            fontSize: 22,
            fontWeight: 700,
            color: PRM,
            letterSpacing: -0.3,
            opacity: taglineOpacity,
          }}
        >
          One record. Three teams. Zero tab-switching.
        </div>
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
