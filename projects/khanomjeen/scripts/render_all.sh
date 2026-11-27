#!/bin/bash
# Final render in 150-frame chunks (software GL, 720x1280 internal buffer upscaled to 1080x1920, no MSAA), so a
# container restart only loses the chunk in progress. Re-run to resume; finished chunks are skipped.
cd "$(dirname "$0")/.."
PROPS='{"post":{"msaa":0,"dpr":0.6667}}'
mkdir -p out/final2/chunks
for ((S = 0; S < 1682; S += 150)); do
  E=$((S + 149)); [ $E -gt 1681 ] && E=1681
  N=$(printf "%04d" $S)
  [ -f out/final2/chunks/c_$N.mp4 ] && continue
  npx remotion render src/index.ts KhanomShort out/final2/chunks/c_$N.tmp.mp4 --frames=$S-$E --gl=swangle \
    --browser-executable=/opt/pw-browsers/chromium --concurrency=1 --props="$PROPS" --codec=h264 --crf=16 \
    --jpeg-quality=95 --log=info 2>&1 | grep -E "Rendered|Encoded|Error|error" | tail -c 2000 > out/final2/chunks/log_$N.txt
  [ -f out/final2/chunks/c_$N.tmp.mp4 ] && mv out/final2/chunks/c_$N.tmp.mp4 out/final2/chunks/c_$N.mp4 || { echo "FAILED $N" > out/final2/STATUS; exit 1; }
done
echo DONE > out/final2/STATUS
