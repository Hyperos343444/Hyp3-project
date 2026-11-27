// usage: node scripts/stills.mjs <outPrefix> <frame,frame,...> [scale]  (bundles once, software GL, jpeg)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const browserExecutable = process.env.CHROME || "/opt/pw-browsers/chromium";
const chromiumOptions = { gl: process.env.GL || "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const inputProps = { post: { msaa: 0, ...(scale !== "1" ? { dpr: Number(scale) } : {}) } };
const composition = await selectComposition({ serveUrl, id: "KhanomShort", browserExecutable, chromiumOptions, inputProps });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 240000, onBrowserLog, inputProps });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
