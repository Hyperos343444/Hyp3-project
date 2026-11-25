import React from "react";
import { Composition } from "remotion";
import { LizzieShort, LIZZIE_FRAMES } from "./videos/lizzie/Lizzie";

export const RemotionRoot: React.FC = () => (
  <Composition id="LizzieShort" component={LizzieShort} durationInFrames={LIZZIE_FRAMES} fps={30} width={1080} height={1920} />
);
