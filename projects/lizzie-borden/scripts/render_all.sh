#!/bin/bash
# Final render in two chunks (software GL, 720x1280 internal buffer upscaled to 1080x1920, no MSAA), then concat.
cd "$(dirname "$0")/.."
PROPS='{"post":{"msaa":0,"dpr":0.6667}}'
for R in "0-772:a" "773-1544:b"; do
  FR=${R%%:*}; N=${R##*:}
  [ -f out/final/part_$N.mp4 ] && continue
  npx remotion render src/index.ts LizzieShort out/final/part_$N.tmp.mp4 --frames=$FR --gl=swangle \
    --browser-executable=/opt/pw-browsers/chromium --concurrency=1 --props="$PROPS" --codec=h264 --crf=16 \
    --jpeg-quality=95 --log=info 2>&1 | grep -E "Rendered|Encoded|Error|error" > out/final/log_$N.txt
  mv out/final/part_$N.tmp.mp4 out/final/part_$N.mp4
done
echo DONE > out/final/STATUS
