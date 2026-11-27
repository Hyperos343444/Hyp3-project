"""Generate Thai narration with Edge TTS, piece by piece, with fixed silences and word timings."""
import asyncio, json, re, subprocess, sys, os
import edge_tts, edge_tts.communicate as _cm, ssl, numpy as np, soundfile as sf
_cm._SSL_CTX = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE", "/root/.ccr/ca-bundle.crt"))
HERE = os.path.dirname(os.path.abspath(__file__))
VOICE, RATE, SR = "th-TH-NiwatNeural", "-4%", 48000
GAP_ELLIPSIS, GAP_LINE = 0.55, 0.38
LINES = [l.split(". ", 1)[1] for l in open(os.path.join(HERE, "..", "SCRIPT.md"), encoding="utf8").read().split("## สคริปต์ (ล็อก)")[1].strip().splitlines()]

async def synth(text, path):
    c = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary", proxy=os.environ.get("HTTPS_PROXY"))
    words = []
    with open(path, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "t0": ch["offset"] / 1e7, "t1": (ch["offset"] + ch["duration"]) / 1e7})
    return words

def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)

def trim(a, words, thr=0.004):
    """Trim leading/trailing silence; shift word times."""
    idx = np.where(np.abs(a) > thr)[0]
    s = max(0, idx[0] - int(0.02 * SR)); e = min(len(a), idx[-1] + int(0.06 * SR))
    off = s / SR
    return a[s:e], [{**w, "t0": max(0, w["t0"] - off), "t1": min((e - s) / SR, w["t1"] - off)} for w in words]

async def main():
    out, allw, segs, t = [], [], [], 0.0
    for li, line in enumerate(LINES):
        parts = [p.strip() for p in line.split("…")]
        for pi, p in enumerate(parts):
            if not p: continue
            mp = os.path.join(HERE, f"seg_{li+1:02d}_{pi}.mp3")
            w = await synth(p, mp)
            a, w = trim(load(mp), w)
            segs.append({"line": li + 1, "part": pi, "text": p, "t0": t, "t1": t + len(a) / SR})
            for x in w: allw.append({"line": li + 1, "part": pi, "w": x["w"], "t0": round(t + x["t0"], 3), "t1": round(t + x["t1"], 3)})
            out.append(a); t += len(a) / SR
            gap = GAP_ELLIPSIS if pi < len(parts) - 1 else (GAP_LINE if li < len(LINES) - 1 else 0.0)
            out.append(np.zeros(int(round(gap * SR)), np.float32)); t += gap
    v = np.concatenate(out)
    sf.write(os.path.join(HERE, "voice.wav"), v, SR, subtype="PCM_24")
    json.dump({"duration": len(v) / SR, "segments": segs, "words": allw}, open(os.path.join(HERE, "words.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print("duration", len(v) / SR, "words", len(allw))
asyncio.run(main())
