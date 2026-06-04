import { Composition } from "remotion";
import { HelloWorld }       from "./HelloWorld";
import { CRMDemoPreview }   from "./CRMDemo";
import { CRMDemoFull }      from "./CRMDemo";
import { AgentChat }        from "./CRMDemo/sections/AgentChat";

export const Root = () => {
  return (
    <>
      {/* ── Dev sandbox ─────────────────────────────────────────────────── */}
      <Composition
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* ── AgentChat · standalone 6s preview ──────────────────────────── */}
      <Composition
        id="AgentChatPreview"
        component={AgentChat}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ showCaptions: true }}
      />

      {/* ── Zopkit CRM · 18s pacing preview (Hero + Problem + Promise) ─── */}
      <Composition
        id="ZopkitCRMPreview"
        component={CRMDemoPreview}
        durationInFrames={540}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ showCaptions: true }}
      />

      {/* ── Zopkit CRM · Full 91s production video ──────────────────────── */}
      <Composition
        id="ZopkitCRMFull"
        component={CRMDemoFull}
        durationInFrames={2730}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ showCaptions: true }}
      />
    </>
  );
};
