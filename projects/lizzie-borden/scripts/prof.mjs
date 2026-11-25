import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const browserExecutable = "/opt/pw-browsers/chromium", chromiumOptions = { gl: "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const variants = JSON.parse(process.argv[2]);
const frame = Number(process.argv[3] || 545), scale = Number(process.argv[4] || 0.5);
for (const [name, post] of Object.entries(variants)) {
  const inputProps = { post: { ...(scale !== 1 ? { dpr: scale } : {}), ...post } };
  const composition = await selectComposition({ serveUrl, id: "LizzieShort", browserExecutable, chromiumOptions, inputProps });
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame, output: `out/prof/${name}.jpg`, imageFormat: "jpeg", scale, browserExecutable, chromiumOptions, inputProps, timeoutInMilliseconds: 300000 });
  console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
