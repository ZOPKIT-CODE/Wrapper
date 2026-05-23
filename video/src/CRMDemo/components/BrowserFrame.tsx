import React from "react";

// The 800×480 SVG is scaled to fill a 1360-wide content area.
// Canvas: 1920×1080. Chrome header: 48px.
export const FRAME_W    = 1360;
export const CHROME_H   = 48;
export const CONTENT_H  = Math.round(FRAME_W * (480 / 800)); // 816px
export const FRAME_H    = CHROME_H + CONTENT_H;              // 864px
export const FRAME_LEFT = (1920 - FRAME_W) / 2;              // 280px
export const FRAME_TOP  = (1080 - FRAME_H) / 2;              // 108px

interface BrowserFrameProps {
  url?: string;
  children: React.ReactNode;
  scale?: number;
  opacity?: number;
  translateY?: number;
  bgGradient?: string;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  url = "app.zopkit.com",
  children,
  scale = 1,
  opacity = 1,
  translateY = 0,
  bgGradient = "linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)",
}) => (
  <div
    style={{
      position: "absolute",
      left: FRAME_LEFT,
      top: FRAME_TOP,
      width: FRAME_W,
      height: FRAME_H,
      borderRadius: 12,
      boxShadow:
        "0 32px 96px rgba(27,46,90,0.20), 0 4px 20px rgba(0,0,0,0.08)",
      border: "1px solid #D1D5DB",
      overflow: "hidden",
      transform: `scale(${scale}) translateY(${translateY}px)`,
      transformOrigin: "center center",
      opacity,
      background: bgGradient,
    }}
  >
    {/* macOS chrome bar */}
    <div
      style={{
        height: CHROME_H,
        background: "#F1F5F9",
        borderBottom: "1px solid #E2E8F0",
        display: "flex",
        alignItems: "center",
        paddingLeft: 18,
        gap: 7,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Traffic lights */}
      <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#FF5F57", boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }} />
      <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#FEBC2E", boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }} />
      <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#28C840", boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }} />

      {/* URL pill */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 7,
          padding: "4px 22px",
          fontFamily: "system-ui,-apple-system,sans-serif",
          fontSize: 12,
          color: "#64748B",
          fontWeight: 400,
          minWidth: 300,
          textAlign: "center",
          letterSpacing: 0.1,
        }}
      >
        🔒 {url}
      </div>
    </div>

    {/* SVG content area */}
    <div
      style={{
        width: FRAME_W,
        height: CONTENT_H,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {children}
    </div>
  </div>
);
