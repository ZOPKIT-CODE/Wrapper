import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const HelloWorld = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    fps,
    frame,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0f0f0f",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          color: "white",
          fontSize: 80,
          fontWeight: "bold",
          fontFamily: "sans-serif",
        }}
      >
        Hello, Remotion!
      </div>
    </AbsoluteFill>
  );
};
