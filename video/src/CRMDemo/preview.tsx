// CRMDemoPreview — 18s pacing preview (Hero + Problem + Promise only)
import React from "react";
import { AbsoluteFill, Series, useCurrentFrame } from "remotion";
import { Hero }            from "./sections/Hero";
import { Problem }         from "./sections/Problem";
import { Promise as Prms } from "./sections/Promise";
import { TransitionWipe }  from "./components/TransitionWipe";
import { PRM } from "./tokens";

const HERO_DUR    = 180;
const PROBLEM_DUR = 180;
const PROMISE_DUR = 180;
const BOUNDARIES  = [HERO_DUR, HERO_DUR + PROBLEM_DUR];

interface Props {
  showCaptions?: boolean;
}

export const CRMDemoPreview: React.FC<Props> = ({ showCaptions = true }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={HERO_DUR}>
          <Hero showCaptions={showCaptions} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={PROBLEM_DUR}>
          <Problem showCaptions={showCaptions} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={PROMISE_DUR}>
          <Prms showCaptions={showCaptions} />
        </Series.Sequence>
      </Series>
      <TransitionWipe frame={frame} boundaries={BOUNDARIES} wipeDuration={8} color={PRM} />
    </AbsoluteFill>
  );
};
