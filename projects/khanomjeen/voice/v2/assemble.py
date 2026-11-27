"""Assemble the F5-TTS-THAI lines into voice.wav (48 kHz) and estimate word timings into words.json.
Phrase boundaries come from the longest pauses inside each line; words inside a phrase are spread by syllable count."""
import itertools, json, os, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from pythainlp.tokenize import word_tokenize, syllable_tokenize
H = os.path.dirname(os.path.abspath(__file__)); SR = 48000; GAP = 0.45
LINES = [l.strip() for l in open(os.path.join(H, "script_v2.txt"), encoding="utf8") if l.strip()]

def env(a, sr):
    hop = int(.01 * sr); return np.array([np.sqrt((a[k:k + hop] ** 2).mean()) for k in range(0, len(a) - hop, hop)])

out, words, segs, t = [], [], [], 0.0
for i, line in enumerate(LINES):
    a, sr = sf.read(os.path.join(H, "lines", f"f5_{i:02d}.wav"))
    idx = np.where(np.abs(a) > 0.005)[0]; s, e = max(0, idx[0] - 480), idx[-1] + 1500
    a = resample_poly(a[s:e], SR, sr).astype(np.float32); dur = len(a) / SR
    en = env(a, SR); sil = en < 0.01; gaps = []; k = 0
    while k < len(sil):
        if sil[k]:
            j = k
            while j < len(sil) and sil[j]: j += 1
            if k > 5 and j < len(sil) - 5 and j - k >= 8: gaps.append((k / 100, j / 100))
            k = j
        else: k += 1
    phrases = line.split()
    syl = [sum(max(1, len(syllable_tokenize(w))) for w in word_tokenize(ph, engine="newmm") if w.strip()) for ph in phrases]
    best = None
    for comb in itertools.combinations(gaps, len(phrases) - 1):
        b = [0.0] + [x for g in comb for x in g] + [dur]
        speech = [b[2 * p + 1] - b[2 * p] for p in range(len(phrases))]
        rate = sum(speech) / sum(syl)
        cost = sum((sp - n * rate) ** 2 for sp, n in zip(speech, syl)) - 0.5 * sum(g[1] - g[0] for g in comb)
        if best is None or cost < best[0]: best = (cost, list(comb))
    cuts = best[1]
    bounds = [0.0] + [x for g in cuts for x in g] + [dur]
    for p, ph in enumerate(phrases):
        p0, p1 = bounds[2 * p], bounds[2 * p + 1] if 2 * p + 1 < len(bounds) else dur
        ws = [w for w in word_tokenize(ph, engine="newmm") if w.strip()]
        wt = [max(1, len(syllable_tokenize(w))) for w in ws]; tot = sum(wt); c = p0
        for w, n in zip(ws, wt):
            d = (p1 - p0) * n / tot
            words.append({"line": i + 1, "phrase": p, "w": w, "t0": round(t + c, 3), "t1": round(t + c + d, 3)}); c += d
    segs.append({"line": i + 1, "text": line, "t0": round(t, 3), "t1": round(t + dur, 3)})
    out += [a, np.zeros(int(GAP * SR), np.float32)]; t += dur + GAP
v = np.concatenate(out[:-1]); v = v / np.abs(v).max() * 0.89
sf.write(os.path.join(H, "voice.wav"), v, SR, subtype="PCM_24")
json.dump({"duration": len(v) / SR, "segments": segs, "words": words}, open(os.path.join(H, "words.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("duration", round(len(v) / SR, 3), "words", len(words))
for w in words: print(w["line"], w["phrase"], w["w"], round((w["t0"] + 0.3) * 30))
