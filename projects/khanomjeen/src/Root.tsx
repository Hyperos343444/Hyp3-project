import React from "react";
import { Composition } from "remotion";
import { KhanomShort, SHORT_FRAMES } from "./videos/khanom/Short";

export const RemotionRoot: React.FC = () => (
  <Composition id="KhanomShort" component={KhanomShort} durationInFrames={SHORT_FRAMES} fps={30} width={1080} height={1920} />
);
