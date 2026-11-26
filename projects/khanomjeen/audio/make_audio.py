# Sound for "ขนมจีนน้ำยา 30 vs 50": every effect and the score are synthesized here (no samples), timed to the picture
# beats of src/videos/khanom/story.ts (frame = round((t + 0.3) * 30) for a narration time t).
# Score: a calm documentary bed: soft pad (Am-F-C-G), a pentatonic vibes/pluck motif, a low pulse in the lab; warmer
# major chords for the honest seller, a darker turn for the fake stall, one low hit on "คนโกหก".
# Mix: voice untouched and on top, music ducked under the voice, SFX under the voice; master -16 LUFS integrated,
# true peak <= -1 dBTP. Outputs: audio/mix.wav (48 kHz stereo, exact picture length) + stems/*.wav + cues.md.
import json, os, sys
import numpy as np
from scipy.ndimage import minimum_filter1d, uniform_filter1d
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from dsp import SR, TAU, ns, tt, rng, lp, hp, bp, colored, smooth_noise, fades, modal, place, widen, make_ir, convolve_st, integrated, true_peak, dbg, read_wav, write_wav, st, phase
from instruments import vibes, glock, pluck, pad, cymbal, timpani, m2f
from sfx_gen import clink, whoosh, babble, bubbles, bird_chirps, breeze, stroll_step, wood_crack

FPS, TOTAL, VO = 30, 2190, 0.3
DUR = TOTAL / FPS
vf = lambda t: int(np.floor((t + VO) * FPS + 0.5))
fr = lambda f: f / FPS
B = dict(youtube=vf(2.462), p30=vf(5.077), p50=vf(6.457), flash=252, old=vf(10.091), bowl=vf(11.614), wine2=vf(17.518),
         d90=vf(19.409), tasty=vf(21.687), d10=vf(23.419), brain=vf(27.156), mustBeTasty=vf(28.262), discount=vf(31.936),
         fewer=vf(32.704), fullPrice=vf(33.525), years=vf(36.584), study2010=vf(37.444), better=vf(40.764), longer=vf(42.73),
         proof=vf(44.517), joinQ=vf(46.869), good=vf(48.028), longerQ=vf(48.679), mouth=vf(50.907), head=vf(52.058),
         recipe=vf(53.83), story=vf(55.471), simmer=vf(58.03), fish=vf(58.824), who=vf(59.54), putBowl=vf(61.12),
         price=vf(62.901), dont=vf(65.249), yesterday=vf(66.904), because=vf(68.241), never=vf(69.952), liar=vf(70.955),
         voiceEnd=vf(71.363), black=2176)
SHOT = {1: (0, 256), 2: (256, 413), 3: (413, 746), 4: (746, 882), 5: (882, 1090), 6: (1090, 1128), 7: (1128, 1320),
        8: (1320, 1500), 9: (1500, 1597), 10: (1597, 1966), 11: (1966, TOTAL)}
MKT_DAY = [1, 2, 4, 6, 8, 9]
N = ns(DUR)
cues = []
def cue(name, t, note=""):
    cues.append((t, name, note))
def buf():
    return np.zeros((2, N))

# ---------------------------------------------------------------- voice
v, sr = read_wav(os.path.join(HERE, "..", "voice", "voice.wav"))
assert sr == SR
voice = buf()
place(voice, v.mean(0) if v.shape[0] > 1 else v[0], VO)
venv = np.sqrt(lp(np.mean(voice, 0) ** 2, 8, 1).clip(0))
venv = venv / (venv.max() + 1e-9)

# ---------------------------------------------------------------- score
music = buf()
r = rng(7)
PROG_A = [[45, 52, 57, 60, 64], [41, 48, 57, 60, 65], [36, 48, 55, 60, 64], [43, 50, 55, 59, 62]]   # Am F C G
PROG_W = [[36, 48, 55, 60, 64], [43, 50, 55, 59, 62], [45, 52, 57, 60, 64], [41, 48, 57, 60, 65]]   # C G Am F (warm)
PROG_D = [[38, 50, 53, 57, 62], [45, 52, 57, 60, 64], [38, 50, 53, 57, 62], [40, 52, 55, 59, 64]]   # Dm Am Dm Em
cl = 3.0
t0, k = 0.0, 0
while t0 < fr(B["black"]) + 0.5:
    f0 = t0 * FPS
    prog = PROG_W if SHOT[10][0] - 15 <= f0 < B["dont"] - 10 else PROG_D if f0 >= B["dont"] - 10 else PROG_A
    lab = SHOT[3][0] <= f0 < SHOT[4][0] or SHOT[5][0] <= f0 < SHOT[6][0] or SHOT[7][0] <= f0 < SHOT[8][0]
    y = pad([m2f(n) for n in prog[k % 4]], cl + 0.3, vel=0.42, r=r, att=0.8, rel=1.3, warm=620 if lab else 820, detune=7)
    place(music, y, t0)
    t0 += cl; k += 1
# a soft low pulse under the experiments (curiosity, not dread)
for (a, b) in [SHOT[3], SHOT[5], SHOT[7]]:
    t = fr(a) + 0.2
    while t < fr(b) - 0.2:
        y = timpani(m2f(33), 0.22, rng(int(t * 100)), dur=0.9)
        place(music, st(y), t, 0.5)
        t += 0.75
# pentatonic motif on vibes (A C E D C A), then on a plucked string for the seller's part
MOTIF = [69, 72, 76, 74, 72, 69]
def motif(t, inst="vibes", vel=0.5, step=0.3, shift=0):
    rr = rng(int(t * 100) + 3)
    for i, m in enumerate(MOTIF):
        f = m2f(m + shift)
        y = vibes(f, vel * (0.85 if i % 2 else 1), rr, dur=1.6) if inst == "vibes" else pluck(f, vel, rr, dur=1.0, bright=0.6)
        place(music, widen(y, rr, 9, 0.6), t + i * step * (1 + 0.2 * (i == 5)), 0.9)
    cue("motif " + inst, t)
for f in [6, 420, 890, 1135]:
    motif(fr(f))
for f in [1605, 1735, 1850]:
    motif(fr(f), "pluck", 0.6, 0.26, shift=-9)
motif(fr(B["voiceEnd"]) - 0.4, "vibes", 0.45, 0.4)

# ---------------------------------------------------------------- effects
sfx = buf()
def put(y, t, g=1.0, seed=1, w=0.7, name="", note=""):
    rr = rng(seed)
    place(sfx, widen(y, rr, 9, w), t, g)
    if name: cue(name, t, note)
def chime(t, notes, vel=0.5, gap=0.05, seed=1, name="chime"):
    rr = rng(seed)
    for i, m in enumerate(notes):
        put(glock(m2f(m), vel, rr, dur=1.4), t + i * gap, 0.6, seed + i)
    cue(name, t)
def wsh(t_peak, dur=0.55, vel=0.5, lo=300, hi=2600, seed=1, name="whoosh"):
    rr = rng(seed)
    y = whoosh(dur, rr, peak=dur * 0.7, f_lo=lo, f_hi=hi, tail=0.18)
    put(y / (np.abs(y).max() + 1e-9), t_peak - dur * 0.7, vel, seed, 0.8, name)
def popsnd(t, f0=600, vel=0.5, seed=1, name="pop"):
    d = 0.18; tb = tt(d)
    y = np.sin(phase(f0 * (1 + 1.5 * tb / d))) * np.exp(-tb / 0.035) * (1 - np.exp(-tb / 0.002))
    put(y, t, vel, seed, 0.4, name)
def clay(t, vel=0.6, seed=1, name="bowl down"):
    rr = rng(seed)
    y = modal(0.5, [(620, 1.0, 0.05), (1480, 0.6, 0.03), (2650, 0.3, 0.015)], rr) + lp(rr.standard_normal(ns(0.5)), 1500) * np.exp(-tt(0.5) / 0.004) * 0.9
    put(y, t, vel, seed, 0.4, name)
def coins(t, n, seed=1):
    rr = rng(seed)
    for i in range(n):
        put(clink(rr, f0=rr.uniform(2600, 4200), dur=0.25, bright=1.1), t + i * 0.07, 0.4 * (1 - 0.08 * i), seed + i)
    cue("coins", t, str(n))

# market ambience (day) and morning ambience (golden): far chatter, birds, a moped passing now and then
amb = buf()
for (a, b), sid in [(SHOT[i], i) for i in MKT_DAY + [10, 11]]:
    d = fr(b - a) + 0.6
    rr = rng(100 + sid)
    bed = np.zeros((2, ns(d)))
    for k2 in range(4 if sid < 10 else 2):
        y = babble(d, rng(200 + sid * 10 + k2), base=rr.uniform(140, 240), scale=rr.uniform(0.95, 1.15), rate=4.5, active=0.55)
        bed += widen(hp(y, 250) / (np.abs(y).max() + 1e-9), rr, 10 + k2, 0.9) * (0.10 if sid < 10 else 0.06)
    bed += breeze(d, rr, 0.05, bright=700)
    bed += st(bird_chirps(d, rr, 0.5 if sid < 10 else 0.9) * (0.05 if sid < 10 else 0.08))
    bed *= np.interp(tt(d), [0, 0.15, d - 0.45, d], [0, 1, 1, 0])[None, :]
    place(amb, bed, fr(a))
sfx += amb
cue("market ambience", 0.0)

# shot 1: phone pops, the same video; 30 (one coin) vs 50 (coins); the queue murmurs
popsnd(fr(B["youtube"] - 2), 520, 0.45, 2, "phone pop"); chime(fr(B["youtube"]), [81, 88], 0.35, 0.06, 3, "phone ding")
coins(fr(B["p30"] - 1), 1, 10); coins(fr(B["p50"] - 1), 4, 11)
wsh(fr(B["flash"]), 0.7, 0.5, seed=4, name="whoosh into flash")
# shot 2: the sign shimmer, the clay bowl set down
chime(fr(B["old"] - 1), [76, 81, 83, 88, 93], 0.3, 0.045, 20, "sign shimmer")
clay(fr(B["bowl"] - 2), 0.6, 21)
# shot 3: scanner hum + soft rhythmic knocks; tag pops; the pleasure swell on $90, the drop on $10
a, b = SHOT[3]
d = fr(b - a)
tb = tt(d)
hum = (np.sin(TAU * 60 * tb) * 0.5 + np.sin(TAU * 120 * tb) * 0.25 + 0.2 * lp(colored(len(tb), rng(30), 1.0), 300)) * np.interp(tb, [0, 0.3, d - 0.3, d], [0, 1, 1, 0])
put(hum, fr(a), 0.12, 30, 0.3, "scanner hum")
t = fr(a) + 0.4
while t < fr(b) - 0.3:
    y = bp(rng(int(t * 50)).standard_normal(ns(0.06)), 800, 2400) * np.exp(-tt(0.06) / 0.012)
    put(y, t, 0.06, int(t * 10), 0.2); t += 0.42
popsnd(fr(B["d90"] - 6), 700, 0.45, 31, "tag $90")
def swell(t, up=True, d=1.4, vel=0.4, seed=1, name="swell"):
    tb = tt(d)
    f = (220 + 440 * (tb / d)) if up else (660 - 440 * (tb / d))
    y = (np.sin(phase(f)) + 0.5 * np.sin(phase(f * 1.5))) * np.sin(np.pi * tb / d) ** 2
    put(y, t, vel, seed, 0.6, name)
swell(fr(B["d90"]), True, 1.6, 0.25, 32, "brain swell up")
chime(fr(B["tasty"] - 1), [84, 88, 91], 0.3, 0.06, 33, "tasty chime")
popsnd(fr(B["d10"] - 2), 420, 0.45, 34, "tag $10")
swell(fr(B["d10"]), False, 1.2, 0.2, 35, "brain swell down")
# shot 4: brain lights before the bite
swell(fr(B["brain"] - 3), True, 1.0, 0.22, 40, "brain on")
chime(fr(B["mustBeTasty"] - 1), [79, 84, 88, 91], 0.3, 0.05, 41, "must be tasty")
# shot 5: pencils, discount tag, a dazed wobble, a bulb ding
rr = rng(50)
t = fr(SHOT[5][0]) + 0.3
while t < fr(SHOT[5][1]) - 0.3:
    y = bp(rr.standard_normal(ns(0.12)), 2500, 7000) * np.sin(np.pi * tt(0.12) / 0.12) ** 2
    put(y, t, 0.07, int(t * 10), 0.5); t += rr.uniform(0.2, 0.6)
cue("pencils", fr(SHOT[5][0]))
popsnd(fr(B["discount"] - 2), 560, 0.45, 51, "discount tag")
tb = tt(0.8); y = np.sin(phase(520 - 260 * tb / 0.8 + 40 * np.sin(TAU * 9 * tb))) * np.exp(-tb / 0.35)
put(y, fr(B["fewer"] - 2), 0.22, 52, 0.4, "dazed wobble")
chime(fr(B["fullPrice"] - 2), [88, 95], 0.4, 0.05, 53, "bulb ding")
# shot 6: shimmer on the old sign again
chime(fr(B["years"] - 1), [76, 81, 83, 88, 93], 0.28, 0.045, 60, "sign shimmer")
# shot 7: hourglass sand, wrapper crinkle, chime
d = 4.5
sand = bp(colored(ns(d), rng(70), 0.3), 3000, 9000) * np.interp(tt(d), [0, 0.2, d - 0.5, d], [0, 1, 1, 0])
put(sand, fr(B["study2010"]), 0.05, 70, 0.5, "hourglass sand")
rr = rng(71)
for i in range(14):
    y = hp(rr.standard_normal(ns(0.03)), 2500) * np.exp(-tt(0.03) / 0.006)
    put(y, fr(B["better"] - 12) + i * rr.uniform(0.02, 0.05), 0.12, 71 + i, 0.6)
cue("wrapper crinkle", fr(B["better"] - 12))
chime(fr(B["better"]), [81, 85, 88], 0.3, 0.06, 72, "better chime")
chime(fr(B["longer"] - 1), [88, 93], 0.25, 0.08, 73, "longer chime")
# shot 8: footsteps of the people joining, murmur rising
for k2, j in enumerate([B["proof"] - 6, B["joinQ"] - 10, B["joinQ"] + 8, B["good"] - 4, B["longerQ"] - 2]):
    rr = rng(80 + k2)
    t = fr(j - 45)
    while t < fr(j):
        put(stroll_step(rr, 0.4), t, 0.10, int(t * 100), 0.6); t += 1 / 1.6 / 2
cue("footsteps join", fr(B["proof"] - 51))
# shot 9: spoon clink + sparkle; the head lights up
put(clink(rng(90), f0=3600, dur=0.2, bright=0.8), fr(B["mouth"] - 18), 0.3, 90, 0.3, "spoon")
chime(fr(B["mouth"] - 1), [84, 88, 91, 96], 0.28, 0.04, 91, "mouth sparkle")
swell(fr(B["head"] - 3), True, 1.0, 0.25, 92, "head on")
# shot 10: phone pop, the sign rises (whoosh), pot simmering, clock ticking fast, fish, bowl, price
popsnd(fr(B["recipe"] - 2), 520, 0.4, 100, "phone pop")
wsh(fr(B["story"]), 0.6, 0.35, 300, 2000, 101, "sign up")
a = B["simmer"] - 4
put(bubbles(fr(B["who"] - a) + 0.3, rng(102), 14, 200, 900, (0.01, 0.04)) * 0.6, fr(a), 0.25, 102, 0.6, "pot simmer")
for i in range(int((fr(B["who"]) - fr(B["simmer"])) / 0.09)):
    put(clink(rng(103 + i), f0=2400, dur=0.05, bright=0.6), fr(B["simmer"]) + i * 0.09, 0.12, 103, 0.3)
cue("clock ticks", fr(B["simmer"]))
popsnd(fr(B["fish"] - 2), 380, 0.4, 104, "fish pop")
clay(fr(B["putBowl"] + 1), 0.6, 105)
popsnd(fr(B["price"] - 2), 640, 0.4, 106, "price sign")
# shot 11: balloon squeak, footsteps away, the crack + low hit, closing swell
tb = tt(0.35); y = np.sin(phase(900 + 300 * np.sin(TAU * 7 * tb))) * np.sin(np.pi * tb / 0.35) ** 2
put(y, fr(B["yesterday"] - 2), 0.12, 110, 0.4, "balloon squeak")
for k2 in range(3):
    rr = rng(111 + k2); t = fr(B["because"] + k2 * 8)
    while t < fr(B["because"] + k2 * 8 + 55):
        put(stroll_step(rr, 0.4), t, 0.10, int(t * 100), 0.6); t += 1 / 1.6 / 2
cue("customers leave", fr(B["because"]))
put(wood_crack(rng(120)) * 0.35, fr(B["liar"] - 1), 0.7, 120, 0.5, "sign crack")
put(timpani(m2f(26), 0.9, rng(121), dur=2.5), fr(B["liar"] - 1), 0.6, 121, 0.4, "low hit")
c = cymbal(0.5, rng(122), dur=3.0)[::-1] * np.linspace(0, 1, ns(3.0)) ** 2
put(c, fr(B["black"]) - 3.0, 0.3, 122, 0.7, "reverse swell")
cend = cymbal(0.6, rng(123), dur=DUR - fr(B["black"]) + 0.05)
cend = cend * np.interp(tt(len(cend) / SR), [0, len(cend) / SR - 0.15, len(cend) / SR], [1, 1, 0])
put(cend, fr(B["black"]), 0.45, 123, 0.7, "cymbal")

# ---------------------------------------------------------------- mix
duck = 1 - lp(np.clip(venv * 3.0, 0, 1), 6, 1).clip(0, 1)
gm = dbg(-9 * (1 - duck)); gs = dbg(-4 * (1 - duck))
music_bus = music * gm[None, :]
sfx_bus = sfx * gs[None, :]
music_bus = music_bus + 0.25 * convolve_st(np.mean(music_bus, 0), make_ir(2.0, 5, pre=0.03, hf=1.6))
vI = integrated(voice)
music_bus *= dbg(vI - 10.0 - integrated(music_bus))
sfx_bus *= dbg(vI - 9.0 - integrated(sfx_bus))
mix = voice + music_bus + sfx_bus
# fade everything to silence with the picture at the very end
mix *= np.interp(np.arange(N) / SR, [0, DUR - 0.25, DUR], [1, 1, 0])[None, :]
for _ in range(12):
    mix *= dbg(-16.0 - integrated(mix))
    tp = true_peak(mix)
    print(f"  pass: {integrated(mix):.2f} LUFS, {tp:.2f} dBTP")
    if tp <= -1.1:
        break
    lim = 10 ** ((-1.6 - 0.25 * _) / 20)
    a = np.abs(mix).max(0)
    g = np.minimum(1.0, lim / np.maximum(a, 1e-9))
    w = ns(0.005)
    g = uniform_filter1d(minimum_filter1d(g, 2 * w + 1), w + 1)
    mix *= g[None, :]
print(f"integrated {integrated(mix):.2f} LUFS, true peak {true_peak(mix):.2f} dBTP, {N / SR:.3f} s")
os.makedirs(os.path.join(HERE, "stems"), exist_ok=True)
write_wav(os.path.join(HERE, "mix.wav"), mix)
for name, x in [("voice", voice), ("music", music_bus), ("sfx", sfx_bus)]:
    write_wav(os.path.join(HERE, "stems", f"{name}.wav"), x)
    print(name, f"{integrated(x):.1f} LUFS")
with open(os.path.join(HERE, "cues.md"), "w", encoding="utf8") as fcue:
    fcue.write("# Sound cues (time s / frame / cue)\n\n")
    for t, name, note in sorted(cues):
        fcue.write(f"- {t:7.3f} s  f{int(round(t * FPS)):5d}  {name} {note}\n")
