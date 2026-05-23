// CRMSvg — dispatcher: calls useCurrentFrame() inside the Sequence so lf is always 0-74
import React from "react";
import { useCurrentFrame } from "remotion";
import { Svg0, Svg1, Svg2, Svg3, Svg4, Svg5, Svg6, Svg7, Svg8, Svg9, Svg10 } from "./svgs0to10";
import { Svg11, Svg12, Svg13, Svg14, Svg15, Svg16, Svg17, Svg18, Svg19, Svg20 } from "./svgs11to20";

interface CRMSvgProps {
  index: number;
}

export const CRMSvg: React.FC<CRMSvgProps> = ({ index }) => {
  // Inside a Series.Sequence this returns the LOCAL frame (0 … durationInFrames-1)
  const lf = useCurrentFrame();

  switch (index) {
    case 0:  return <Svg0  lf={lf} />;
    case 1:  return <Svg1  lf={lf} />;
    case 2:  return <Svg2  lf={lf} />;
    case 3:  return <Svg3  lf={lf} />;
    case 4:  return <Svg4  lf={lf} />;
    case 5:  return <Svg5  lf={lf} />;
    case 6:  return <Svg6  lf={lf} />;
    case 7:  return <Svg7  lf={lf} />;
    case 8:  return <Svg8  lf={lf} />;
    case 9:  return <Svg9  lf={lf} />;
    case 10: return <Svg10 lf={lf} />;
    case 11: return <Svg11 lf={lf} />;
    case 12: return <Svg12 lf={lf} />;
    case 13: return <Svg13 lf={lf} />;
    case 14: return <Svg14 lf={lf} />;
    case 15: return <Svg15 lf={lf} />;
    case 16: return <Svg16 lf={lf} />;
    case 17: return <Svg17 lf={lf} />;
    case 18: return <Svg18 lf={lf} />;
    case 19: return <Svg19 lf={lf} />;
    case 20: return <Svg20 lf={lf} />;
    default: return null;
  }
};
