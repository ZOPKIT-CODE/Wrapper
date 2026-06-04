/**
 * AgentChat — Zopkit AI chat scene: agent creates a sales pipeline live
 * and syncs across wrapper, crm, and fa in one conversation.
 *
 * Timing (30fps / 180 frames = 6s):
 *   0–14    BrowserFrame lifts in
 *   15      nav bar
 *   22      date separator
 *   28      user message slides in
 *   42      AI avatar + typing dots
 *   56      AI response text
 *   66      table header
 *   70–96   7 pipeline rows stagger in (5f gap each)
 *   106     confirmation text
 *   114     settings chip + app source pills
 *   126     quick-action chips
 *   138     input bar
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Caption } from "../components/Caption";
import { BLUE, VIOLET, TEAL, PRM, ff, SPRING_SNAP, SPRING_SOFT } from "../tokens";

// ─── timing ────────────────────────────────────────────────────────────────────
const T_FRAME    = 6;
const T_NAV      = 15;
const T_DATE     = 22;
const T_USER     = 28;
const T_AI_META  = 42;
const T_AI_TEXT  = 56;
const T_TH       = 66;
const T_ROW_0    = 70;
const T_CONFIRM  = 106;
const T_CHIPS    = 114;
const T_QACTIONS = 126;
const T_INPUT    = 138;
const T_CAP      = 60;

// ─── data ──────────────────────────────────────────────────────────────────────
const PIPELINE_ROWS = [
  { order: 1, stage: "Prospecting",    badge: "Active",      badgeColor: "#16A34A", badgeBg: "#DCFCE7" },
  { order: 2, stage: "Qualification",  badge: "Active",      badgeColor: "#16A34A", badgeBg: "#DCFCE7" },
  { order: 3, stage: "Demo Scheduled", badge: "Active",      badgeColor: "#16A34A", badgeBg: "#DCFCE7" },
  { order: 4, stage: "Proposal Sent",  badge: "Active",      badgeColor: "#16A34A", badgeBg: "#DCFCE7" },
  { order: 5, stage: "Negotiation",    badge: "Negotiation", badgeColor: "#D97706", badgeBg: "#FEF3C7" },
  { order: 6, stage: "Closed Won",     badge: "Won",         badgeColor: "#059669", badgeBg: "#D1FAE5" },
  { order: 7, stage: "Closed Lost",    badge: "Lost",        badgeColor: "#DC2626", badgeBg: "#FEE2E2" },
] as const;

const APP_SOURCES = [
  { app: "wrapper", color: BLUE,   iconBg: "#2563EB", label: "Opportunity count synced" },
  { app: "crm",     color: VIOLET, iconBg: "#7C3AED", label: "Pipeline created" },
  { app: "fa",      color: TEAL,   iconBg: "#0891B2", label: "Field reps notified" },
] as const;

const QUICK_ACTIONS = ["Summarize pipeline", "Stuck deals", "Draft follow-up", "Create lead"] as const;

// ─── animation helpers ─────────────────────────────────────────────────────────
function useFadeIn(start: number, dur = 12) {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
}

function useSlideUp(start: number, dist = 14, dur = 14) {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return interpolate(t, [0, 1], [dist, 0]);
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
const Avatar: React.FC<{ label: string; bg: string; size?: number }> = ({
  label, bg, size = 28,
}) => (
  <div
    style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <span style={{ fontFamily: ff, fontSize: size * 0.38, fontWeight: 700, color: "#fff", letterSpacing: -0.3 }}>
      {label}
    </span>
  </div>
);

// ─── Status badge ──────────────────────────────────────────────────────────────
const Badge: React.FC<{ label: string; color: string; bg: string }> = ({ label, color, bg }) => (
  <span
    style={{
      display: "inline-block", background: bg, color, borderRadius: 6,
      padding: "2px 9px", fontFamily: ff, fontSize: 11, fontWeight: 700,
    }}
  >
    {label}
  </span>
);

// ─── Pipeline table row ────────────────────────────────────────────────────────
const PipelineRow: React.FC<{
  order: number; stage: string; badge: string;
  badgeColor: string; badgeBg: string;
  startFrame: number; isEven: boolean;
}> = ({ order, stage, badge, badgeColor, badgeBg, startFrame, isEven }) => {
  const opacity = useFadeIn(startFrame, 10);
  const ty = useSlideUp(startFrame, 8, 10);

  return (
    <div
      style={{
        display: "flex", alignItems: "center",
        padding: "8px 14px",
        background: isEven ? "#F8FAFF" : "#FFFFFF",
        borderBottom: "1px solid #F1F5F9",
        opacity, transform: `translateY(${ty}px)`,
      }}
    >
      <span style={{ width: 52, fontFamily: ff, fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>{order}</span>
      <span style={{ flex: 1, fontFamily: ff, fontSize: 13, color: "#0F172A", fontWeight: 500 }}>{stage}</span>
      <Badge label={badge} color={badgeColor} bg={badgeBg} />
    </div>
  );
};

// ─── Typing dots ───────────────────────────────────────────────────────────────
const TypingDots: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const visible = frame >= startFrame && frame < T_AI_TEXT;
  const opacity = useFadeIn(startFrame, 8);
  if (!visible) return null;

  const dot = (offset: number) => {
    const phase = ((frame - startFrame + offset) % 18) / 18;
    const y = Math.sin(phase * Math.PI) * 4;
    return (
      <div
        style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#CBD5E1",
          transform: `translateY(${-y}px)`, flexShrink: 0,
        }}
      />
    );
  };

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 4,
        background: "#F8FAFC", border: "1px solid #E2E8F0",
        borderRadius: "18px 18px 18px 4px",
        padding: "10px 14px", width: "fit-content", opacity,
      }}
    >
      {dot(0)}{dot(6)}{dot(12)}
    </div>
  );
};

// ─── App source pill ───────────────────────────────────────────────────────────
const AppSourcePill: React.FC<{
  app: string; color: string; iconBg: string; label: string; startFrame: number;
}> = ({ app, color: _color, iconBg, label, startFrame }) => {
  const opacity = useFadeIn(startFrame, 10);
  const ty = useSlideUp(startFrame, 8, 10);

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "#F8FAFC", border: "1px solid #E2E8F0",
        borderRadius: 8, padding: "5px 10px",
        opacity, transform: `translateY(${ty}px)`,
      }}
    >
      <div
        style={{
          width: 16, height: 16, borderRadius: 4, background: iconBg,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: ff, fontSize: 8, fontWeight: 800, color: "#fff" }}>Z</span>
      </div>
      <span style={{ fontFamily: ff, fontSize: 10, fontWeight: 600, color: "#64748B" }}>
        zopkit · {app}
      </span>
      <span style={{ width: 1, height: 10, background: "#E2E8F0" }} />
      <span style={{ fontFamily: ff, fontSize: 10, color: "#94A3B8" }}>{label}</span>
    </div>
  );
};

// ─── Quick action chip ─────────────────────────────────────────────────────────
const QuickChip: React.FC<{ label: string; startFrame: number }> = ({ label, startFrame }) => {
  const opacity = useFadeIn(startFrame, 10);
  const ty = useSlideUp(startFrame, 8, 10);

  return (
    <div
      style={{
        background: "#F8FAFC", border: "1px solid #E2E8F0",
        borderRadius: 100, padding: "5px 12px",
        fontFamily: ff, fontSize: 11, fontWeight: 500,
        color: "#475569", whiteSpace: "nowrap",
        opacity, transform: `translateY(${ty}px)`,
      }}
    >
      + {label}
    </div>
  );
};

// ─── Chat content (inside BrowserFrame 1360 × 816) ────────────────────────────
const ChatContent: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const navOpacity     = useFadeIn(T_NAV, 12);
  const dateOpacity    = useFadeIn(T_DATE, 10);
  const userOpacity    = useFadeIn(T_USER, 10);
  const userTy         = useSlideUp(T_USER, 10, 10);
  const aiMetaOpacity  = useFadeIn(T_AI_META, 10);
  const aiMetaTy       = useSlideUp(T_AI_META, 8, 10);
  const aiTextOpacity  = useFadeIn(T_AI_TEXT, 10);
  const thOpacity      = useFadeIn(T_TH, 8);
  const confirmOpacity = useFadeIn(T_CONFIRM, 12);
  const confirmTy      = useSlideUp(T_CONFIRM, 10, 12);
  const settingsOpacity = useFadeIn(T_CHIPS, 10);
  const inputOpacity   = useFadeIn(T_INPUT, 12);
  const inputScale     = spring({ frame: frame - T_INPUT, fps, config: SPRING_SOFT });

  return (
    <div
      style={{
        width: "100%", height: "100%",
        background: "#FFFFFF",
        display: "flex", flexDirection: "column",
        fontFamily: ff, overflow: "hidden",
      }}
    >
      {/* ── Nav bar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 40, background: "#FFFFFF",
          borderBottom: "1px solid #F1F5F9",
          display: "flex", alignItems: "center",
          padding: "0 24px", flexShrink: 0,
          opacity: navOpacity,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>connected</span>
          <span style={{ color: "#E2E8F0" }}>·</span>
          <span style={{ fontSize: 11, color: "#94A3B8" }}>live data</span>
        </div>
        <div
          style={{
            marginLeft: "auto",
            fontSize: 10, fontWeight: 600, color: "#94A3B8",
            background: "#F8FAFC", border: "1px solid #E2E8F0",
            borderRadius: 6, padding: "2px 8px",
          }}
        >
          Clear session ↑
        </div>
      </div>

      {/* ── Message area ─────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1, overflow: "hidden",
          padding: "16px 28px 10px",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Date separator */}
        <div
          style={{
            textAlign: "center", fontSize: 11, color: "#94A3B8",
            fontWeight: 500, marginBottom: 16, opacity: dateOpacity,
          }}
        >
          Mon 25 May · 1 message
        </div>

        {/* User message */}
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            marginBottom: 20,
            opacity: userOpacity, transform: `translateY(${userTy}px)`,
          }}
        >
          <Avatar label="ME" bg={PRM} size={30} />
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>You</span>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>11:11</span>
            </div>
            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6, maxWidth: 820 }}>
              Create a sales pipeline for opportunities with stages: Prospecting, Qualification,
              Demo Scheduled, Proposal Sent, Negotiation, Closed Won, Closed Lost. Create it now.
            </div>
          </div>
        </div>

        {/* AI message */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              flexShrink: 0,
              opacity: aiMetaOpacity,
              transform: `translateY(${aiMetaTy}px)`,
            }}
          >
            <Avatar label="ZP" bg="#7C3AED" size={30} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex", alignItems: "baseline", gap: 8,
                marginBottom: 6,
                opacity: aiMetaOpacity,
                transform: `translateY(${aiMetaTy}px)`,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Zop</span>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>11:11</span>
            </div>

            <TypingDots startFrame={T_AI_META + 2} />

            <div style={{ opacity: aiTextOpacity }}>
              <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6, marginBottom: 12 }}>
                The sales pipeline is live. Here is what was set up:
              </div>

              {/* Pipeline table */}
              <div
                style={{
                  border: "1px solid #E2E8F0", borderRadius: 10,
                  overflow: "hidden", marginBottom: 12,
                  opacity: thOpacity,
                }}
              >
                <div
                  style={{
                    display: "flex", padding: "8px 14px",
                    background: "#F8FAFC", borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  <span style={{ width: 52, fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8 }}>Order</span>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8 }}>Stage</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8 }}>Type</span>
                </div>

                {PIPELINE_ROWS.map((row, i) => (
                  <PipelineRow
                    key={row.order}
                    order={row.order}
                    stage={row.stage}
                    badge={row.badge}
                    badgeColor={row.badgeColor}
                    badgeBg={row.badgeBg}
                    startFrame={T_ROW_0 + i * 5}
                    isEven={i % 2 === 1}
                  />
                ))}
              </div>

              {/* Confirmation */}
              <div
                style={{
                  opacity: confirmOpacity,
                  transform: `translateY(${confirmTy}px)`,
                }}
              >
                <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6, marginBottom: 4 }}>
                  This is now the default pipeline applied to all new opportunity records.
                  You can view or edit it in{" "}
                  <span style={{ color: BLUE, textDecoration: "underline" }}>Pipelines settings</span>.
                </div>
                <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6, marginBottom: 10 }}>
                  If you want to enforce rules on stage transitions — for example, requiring a phone
                  number before Qualification, or auto-creating a task at Negotiation — I can set up
                  a blueprint on top of this pipeline.
                </div>
              </div>

              {/* Settings chip */}
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "#F8FAFC", border: "1px solid #E2E8F0",
                  borderRadius: 8, padding: "5px 10px",
                  marginBottom: 10,
                  opacity: settingsOpacity,
                }}
              >
                <span style={{ fontSize: 12 }}>⚙</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Pipelines settings</span>
                <span style={{ color: "#CBD5E1", fontSize: 10 }}>↗</span>
              </div>

              {/* App source pills */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {APP_SOURCES.map((src, i) => (
                  <AppSourcePill
                    key={src.app}
                    app={src.app}
                    color={src.color}
                    iconBg={src.iconBg}
                    label={src.label}
                    startFrame={T_CHIPS + 5 + i * 5}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick action chips ────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid #F1F5F9",
          padding: "7px 20px", display: "flex", gap: 8,
          flexShrink: 0, background: "#FFFFFF",
        }}
      >
        {QUICK_ACTIONS.map((label, i) => (
          <QuickChip key={label} label={label} startFrame={T_QACTIONS + i * 5} />
        ))}
      </div>

      {/* ── Input + footer ────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "6px 16px 8px", background: "#FFFFFF", flexShrink: 0,
          opacity: inputOpacity, transform: `scaleY(${inputScale})`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center",
            border: "1.5px solid #E2E8F0", borderRadius: 10,
            padding: "8px 14px", gap: 12, background: "#FAFAFA",
          }}
        >
          <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>🖇 Attach</span>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>⚙ Tools</span>
          </div>
          <span
            style={{
              flex: 1, fontSize: 12, color: "#94A3B8",
              borderLeft: "1px solid #E2E8F0", paddingLeft: 12,
            }}
          >
            Ask about a deal, account, forecast — or type / for commands
          </span>
          <div
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: "#E2E8F0", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, color: "#94A3B8" }}>↑</span>
          </div>
        </div>
        <div
          style={{
            textAlign: "center", fontSize: 10, color: "#CBD5E1",
            marginTop: 5, fontWeight: 400,
          }}
        >
          Zopkit AI · Powered by live data · Responses may be inaccurate
        </div>
      </div>
    </div>
  );
};

// ─── Section ───────────────────────────────────────────────────────────────────
export const AgentChat: React.FC<{ showCaptions?: boolean }> = ({
  showCaptions = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameScale   = spring({ frame: frame - T_FRAME, fps, config: SPRING_SNAP });
  const frameTy      = interpolate(
    spring({ frame: frame - T_FRAME, fps, config: SPRING_SNAP }),
    [0, 1], [36, 0]
  );
  const frameOpacity = useFadeIn(T_FRAME, 14);

  const headlineOpacity = useFadeIn(0, 12);
  const orbOpacity = interpolate(frame, [8, 36], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const vo =
    "One prompt. Zopkit's AI creates the pipeline, syncs the wrapper dashboard, and alerts field reps — all in one reply.";

  return (
    <AbsoluteFill style={{ background: "linear-gradient(145deg, #f0f4ff 0%, #e8eeff 100%)" }}>
      <div style={{ position: "absolute", top: "4%", right: "4%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)", opacity: orbOpacity, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", left: "3%", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)", opacity: orbOpacity, pointerEvents: "none" }} />

      <div
        style={{
          position: "absolute", top: 44, left: "50%",
          transform: "translateX(-50%)",
          fontFamily: ff, fontSize: 22, fontWeight: 700,
          color: PRM, letterSpacing: -0.3,
          opacity: headlineOpacity, whiteSpace: "nowrap",
        }}
      >
        AI that acts — not just answers
      </div>

      <BrowserFrame
        url="app.zopkit.com/ai"
        scale={frameScale}
        translateY={frameTy}
        opacity={frameOpacity}
      >
        <ChatContent />
      </BrowserFrame>

      <Caption text={vo} startFrame={T_CAP} endFrame={178} showCaptions={showCaptions} />
    </AbsoluteFill>
  );
};
