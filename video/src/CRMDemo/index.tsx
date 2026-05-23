/**
 * CRMDemoFull — complete 85-second / 2550-frame composition
 *
 * Structure:
 *   Hero       0–179      180f   6s
 *   Problem  180–359      180f   6s
 *   Promise  360–539      180f   6s
 *   Modules  540–2114  21×75f  52.5s  (each module = 2.5s)
 *   Outcome 2115–2324     210f   7s
 *   CTA     2325–2549     225f   7.5s
 *   Total                2550f  85s
 *
 * Audio stubs: drop WAV/MP3 files into public/ then uncomment the Audio blocks.
 */
import React from "react";
import { AbsoluteFill, Series, useCurrentFrame } from "remotion";
import { Hero }              from "./sections/Hero";
import { Problem }           from "./sections/Problem";
import { Promise as Prms }   from "./sections/Promise";
import { Outcome }           from "./sections/Outcome";
import { CTA }               from "./sections/CTA";
import { ModuleSlide }       from "./components/ModuleSlide";
import { TransitionWipe }    from "./components/TransitionWipe";
import { CRMSvg }            from "./svgs";
import { MODULES }           from "./data";
import { PRM } from "./tokens";

// ─── timing ───────────────────────────────────────────────────────────────────
const HERO_DUR    = 180;
const PROBLEM_DUR = 180;
const PROMISE_DUR = 180;
const MODULE_DUR  = 75;
const OUTCOME_DUR = 210;
const CTA_DUR     = 225;

const MODULE_START = HERO_DUR + PROBLEM_DUR + PROMISE_DUR; // 540

// Wipe boundaries (global frame numbers — one per section transition)
const BOUNDARIES: number[] = [
  HERO_DUR,
  HERO_DUR + PROBLEM_DUR,
  MODULE_START,
  ...Array.from({ length: 21 }, (_, k) => MODULE_START + (k + 1) * MODULE_DUR),
  MODULE_START + 21 * MODULE_DUR + OUTCOME_DUR,
];

interface Props {
  showCaptions?: boolean;
}

export const CRMDemoFull: React.FC<Props> = ({ showCaptions = true }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {/* ── Sections ──────────────────────────────────────────────────── */}
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

        {MODULES.map((mod, idx) => (
          <Series.Sequence key={idx} durationInFrames={MODULE_DUR}>
            <ModuleSlide
              headline={mod.headline}
              url={mod.url}
              calloutLabel={mod.calloutLabel}
              calloutValue={mod.calloutValue}
              calloutColor={mod.calloutColor}
              stat={mod.stat}
              vo={mod.vo}
              showCaptions={showCaptions}
            >
              {/* CRMSvg calls useCurrentFrame() inside the Sequence — gets local frame 0-74 */}
              <CRMSvg index={idx} />
            </ModuleSlide>
          </Series.Sequence>
        ))}

        <Series.Sequence durationInFrames={OUTCOME_DUR}>
          <Outcome showCaptions={showCaptions} />
        </Series.Sequence>

        <Series.Sequence durationInFrames={CTA_DUR}>
          <CTA showCaptions={showCaptions} />
        </Series.Sequence>
      </Series>

      {/* ── Transition wipes ──────────────────────────────────────────── */}
      <TransitionWipe
        frame={frame}
        boundaries={BOUNDARIES}
        wipeDuration={8}
        color={PRM}
      />

      {/*
        ── Audio stubs (uncomment after dropping files into public/) ──────────
        import { Audio, staticFile } from "remotion";

        <Audio src={staticFile("music/bg-track.mp3")} volume={0.12} />
        <Audio src={staticFile("vo/hero.wav")}    startFrom={0}   />
        <Audio src={staticFile("vo/problem.wav")} startFrom={180} />
        <Audio src={staticFile("vo/promise.wav")} startFrom={360} />
        {MODULES.map((_, k) => (
          <Audio key={k} src={staticFile(`vo/module${k}.wav`)}
            startFrom={MODULE_START + k * MODULE_DUR} />
        ))}
        <Audio src={staticFile("vo/outcome.wav")} startFrom={2115} />
        <Audio src={staticFile("vo/cta.wav")}     startFrom={2325} />
      */}
    </AbsoluteFill>
  );
};

// 18-second pacing preview — keep for quick iteration
export { CRMDemoPreview } from "./preview";
