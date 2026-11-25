# Sound for "ปริศนาขวานแห่งฟอลริเวอร์": every effect and the score are synthesized here (no samples), timed to the
# picture beats of src/videos/lizzie/story.ts (same formula: frame = round((t + 0.3) * 30) for a narration time t).
# Score: low haunted D-minor pad + a 6-note music-box motif (the kids later "sing" the same motif without words).
# Mix: voice untouched and on top, music ducked under the voice, SFX under the voice; master -16 LUFS integrated,
# true peak <= -1 dBTP. Outputs: audio/mix.wav (48 kHz stereo, exact picture length) + stems/*.wav + cues.md.
import json, os, sys
import numpy as np
from scipy.ndimage import minimum_filter1d
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from dsp import SR, TAU, ns, tt, rng, lp, hp, bp, peq, colored, smooth_noise, ramp, fades, modal, place, widen, make_ir, convolve_st, integrated, true_peak, dbg, read_wav, write_wav, st, phase
from instruments import musicbox, pad, cymbal, m2f
from sfx_gen import clink, whoosh, babble, vox, vowel_track, WOOD

FPS, TOTAL, VO = 30, 1545, 0.3
DUR = TOTAL / FPS
vf = lambda t: int(np.floor((t + VO) * FPS + 0.5))
fr = lambda f: f / FPS
B = dict(flash=vf(6.75), stingy=vf(8.008), gives=vf(8.438), cyanide=vf(15.09), chop1=vf(17.551), chop2=vf(20.916), axe=vf(22.857),
         unlucky=vf(24.549), burn=vf(28.174), verdict=vf(33.269), shun=vf(36.196), rumour=vf(38.506), another=vf(45.727), voiceEnd=vf(48.712), black=1492)
SHOT = {1: (0, 155), 2: (155, 211), 3: (211, 381), 4: (381, 487), 5: (487, 572), 6: (572, 663), 7: (663, 815), 8: (815, 929), 9: (929, 1029), 10: (1029, 1247), 11: (1247, TOTAL)}
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
venv = np.sqrt(lp(np.mean(voice, 0) ** 2, 8, 1).clip(0))  # ~ RMS envelope
venv = venv / (venv.max() + 1e-9)

# ---------------------------------------------------------------- score
music = buf()
r = rng(7)
# pad: Dm - Bb - Gm - A (3.2 s per chord), low and warm; darker drone (D + A only) during the murders (shots 5-8)
CH = [[38, 45, 53, 57], [34, 41, 50, 53], [31, 38, 46, 50], [33, 40, 49, 52]]
cl = 3.2
t0 = 0.0
k = 0
while t0 < DUR:
    f0 = t0 * FPS
    dark = SHOT[5][0] <= f0 < SHOT[9][0]
    notes = [38, 45, 50] if dark else CH[k % 4]
    y = pad([m2f(n) for n in notes], cl + 0.2, vel=0.5, r=r, att=0.9, rel=1.4, warm=520 if dark else 760, detune=9)
    place(music, y, t0)
    t0 += cl; k += 1
# sub drone under the dark section, swelling in the cellar/kitchen
dr = buf()
n = ns(DUR)
tA = np.arange(n) / SR
drone = np.sin(TAU * m2f(26) * tA) * 0.6 + np.sin(TAU * m2f(33) * tA + 1) * 0.3
env = np.interp(tA, [0, fr(480), fr(500), fr(925), fr(945), fr(1240), fr(1260), DUR], [0, 0, 1, 1, 0, 0, 0.7, 0.7])
dr += st(drone * env * 0.35)
music += dr
# music box motif: D5 F5 A5 G#5 E5 D5, a little detuned and slow
MOTIF = [74, 77, 81, 80, 76, 74]
def motif(t, step=0.36, vel=0.55, detune=-0.18, slow=1.0, rr=None):
    rr = rr or rng(int(t * 100))
    for i, m in enumerate(MOTIF):
        f = m2f(m + detune + rr.uniform(-0.06, 0.06))
        tn = t + i * step * slow * (1 + 0.15 * (i == 5))
        place(music, widen(musicbox(f, vel * (0.85 if i % 2 else 1.0), rr, dur=2.2), rr, 9, 0.6), tn, 0.9)
        cue("musicbox", tn, f"{m}")
for t in [0.35, 3.55, 6.9, 10.3, 13.5]:          # shots 1-4
    motif(t)
for t in [fr(1250) + 0.3, fr(1250) + 3.6]:      # shot 11
    motif(t, vel=0.45)
motif(fr(B["voiceEnd"]) - 1.4, step=0.5, vel=0.5, slow=1.25)  # the last, slower statement under "ที่ไม่เคยถูกตั้งข้อหาเลย"

# ---------------------------------------------------------------- effects
sfx = buf()
def heartbeat(t, bpm, vel=1.0):
    rr = rng(int(t * 1000))
    for dt, a in [(0.0, 1.0), (0.24 * 70 / bpm, 0.7)]:
        d = 0.32
        tb = tt(d)
        y = np.sin(TAU * (52 + 30 * np.exp(-tb / 0.03)) * tb) * np.exp(-tb / 0.08) * (1 - np.exp(-tb / 0.004))
        y += 0.25 * lp(rr.standard_normal(len(tb)), 200) * np.exp(-tb / 0.02)
        place(sfx, y * a * vel, t + dt)
def heart_run(f0, f1, bpm0, bpm1, vel=1.0):
    t, t1 = fr(f0), fr(f1)
    while t < t1:
        u = (t - fr(f0)) / max(1e-6, t1 - fr(f0))
        bpm = bpm0 + (bpm1 - bpm0) * u
        heartbeat(t, bpm, vel); cue("heartbeat", t, f"{bpm:.0f} bpm")
        t += 60 / bpm
heart_run(487, B["chop1"] - 2, 66, 96, 0.9)
heart_run(574, B["chop2"] - 2, 70, 104, 0.9)
heart_run(B["another"] - 30, B["black"] - 4, 60, 84, 0.75)

def wsh(peak_f, dur=0.55, vel=0.5, lo=300, hi=2600, seed=1):
    rr = rng(seed)
    y = whoosh(dur, rr, peak=dur * 0.7, f_lo=lo, f_hi=hi, tail=0.18)
    place(sfx, widen(y / (np.abs(y).max() + 1e-9), rr, 12, 0.8), fr(peak_f) - dur * 0.7, vel)
    cue("whoosh", fr(peak_f))
wsh(B["flash"], 0.7, 0.55, seed=2)                        # into the flash
wsh(B["chop1"] - 2, 0.32, 0.45, 200, 1600, 3)            # the axe swing (shadow)
wsh(B["chop2"] - 2, 0.32, 0.45, 200, 1600, 4)
wsh(B["unlucky"] - 2, 0.45, 0.35, 400, 3000, 5)          # zoom onto the hatchet head
wsh(B["burn"] - 2, 0.6, 0.35, 150, 1200, 6)              # the fire flares

# coins on "ขี้เหนียว"
rr = rng(11)
for i in range(5):
    t = fr(B["stingy"] - 2) + i * 0.055 + rr.uniform(0, 0.02)
    y = clink(rr, f0=rr.uniform(2600, 4200), dur=0.25, bright=1.2)
    place(sfx, y * 0.5 * (1 - 0.1 * i), t); cue("coin", t)
# glass bottle set down on the counter + a tiny pop
rr = rng(12)
t = fr(B["cyanide"] - 2)
y = modal(0.5, [(1180, 1.0, 0.09), (2930, 0.6, 0.05), (4750, 0.35, 0.03)], rr) + lp(rr.standard_normal(ns(0.5)), 900) * np.exp(-tt(0.5) / 0.006) * 0.8
place(sfx, y * 0.55, t); cue("bottle", t)
# the heavy dull thuds of the chops (low boom + body, never a wet sound)
def chop(f):
    rr = rng(f)
    d = 1.4
    tb = tt(d)
    y = np.sin(TAU * (38 + 70 * np.exp(-tb / 0.05)) * tb) * np.exp(-tb / 0.35) * 1.0
    y += lp(rr.standard_normal(len(tb)), 400) * np.exp(-tb / 0.05) * 0.8
    y += bp(rr.standard_normal(len(tb)), 600, 2500) * np.exp(-tb / 0.012) * 0.5
    place(sfx, widen(y, rr, 15, 0.4), fr(f) - 0.01, 0.95); cue("chop thud", fr(f))
chop(B["chop1"]); chop(B["chop2"])
# iron hatchet head clank in the cellar
rr = rng(13)
t = fr(B["axe"] - 1)
y = modal(1.6, [(420, 1.0, 0.5), (1130, 0.7, 0.3), (2210, 0.45, 0.18), (3570, 0.3, 0.1), (5200, 0.15, 0.06)], rr)
y += hp(rr.standard_normal(ns(1.6)), 2000) * np.exp(-tt(1.6) / 0.003) * 0.6
place(sfx, widen(y, rr, 8, 0.5) * 0.4, t); cue("iron clank", t)
# fire: crackles all through shot 8, denser after "เผา"; a roaring bed underneath
rr = rng(14)
f0, f1 = SHOT[8]
roar = lp(colored(ns(fr(f1 - f0) + 0.6), rr, 1.0), 600) * 0.25
roar *= np.interp(tt(fr(f1 - f0) + 0.6), [0, 0.2, fr(B["burn"] - f0), fr(B["burn"] - f0) + 0.8, fr(f1 - f0), fr(f1 - f0) + 0.6], [0, 0.3, 0.35, 1.0, 1.0, 0])
place(sfx, widen(roar, rr, 10, 0.8), fr(f0))
t = fr(f0)
while t < fr(f1) + 0.4:
    dense = t > fr(B["burn"])
    y = hp(rr.standard_normal(ns(0.03)), 1500) * np.exp(-tt(0.03) / rr.uniform(0.002, 0.008)) * rr.uniform(0.2, 0.7)
    place(sfx, widen(y, rr, 4, 0.9), t, 0.6)
    t += rr.exponential(0.05 if dense else 0.14)
cue("fire", fr(f0)); cue("fire flare", fr(B["burn"]))
# gavel: two hard wooden knocks in a big room
rr = rng(15)
room = make_ir(1.4, 21, pre=0.02, hf=1.4)
gav = buf()
for k2, f in enumerate([B["verdict"] - 2, B["verdict"] + 8]):
    y = modal(0.6, [(m[0] * 1.15, m[2], 0.02 + 0.03 / m[1]) for m in WOOD], rr) + lp(rr.standard_normal(ns(0.6)), 3000) * np.exp(-tt(0.6) / 0.002) * 1.2
    place(gav, y * 0.9, fr(f)); cue("gavel", fr(f))
sfx += gav + 0.35 * convolve_st(np.mean(gav, 0), room)
# townsfolk whispering (shot 10): several far babbles, breathy, plus little "hmph"s as backs turn
wh = buf()
f0, f1 = SHOT[10]
for k2 in range(5):
    rr = rng(30 + k2)
    y = babble(fr(f1 - f0) + 0.5, rr, base=rr.uniform(150, 230), scale=rr.uniform(0.95, 1.15), rate=5.0, active=0.6)
    y = hp(y, 300) * 0.5 + 0.8 * bp(rr.standard_normal(len(y)), 1500, 6000) * np.clip(np.abs(y) / (np.abs(y).max() + 1e-9) * 3, 0, 1)
    place(wh, widen(y / (np.abs(y).max() + 1e-9), rr, 10 + k2, 0.9) * 0.22, fr(f0) + 0.2 * k2)
whenv = np.interp(np.arange(N) / SR, [fr(f0), fr(f0) + 0.8, fr(f1) - 0.3, fr(f1) + 0.4], [0, 1, 1, 0], left=0, right=0)
sfx += wh * whenv[None, :]
cue("whispers", fr(f0))
for k2 in range(6):
    rr = rng(50 + k2)
    t = fr(B["shun"] - 10 + 8 * k2)
    nn = ns(0.25)
    y = bp(rr.standard_normal(nn), 300, 2500) * np.sin(np.linspace(0, np.pi, nn)) ** 2
    place(sfx, y * 0.18, t); cue("hmph", t)
# kids singing the motif without words ("la", "lu"), from when they appear
kids = buf()
t = fr(B["rumour"] - 14)
for kk in range(3):
    rr = rng(60 + kk)
    tn = t + kk * 0.05
    notes = MOTIF * 2
    dur_n = 0.34
    n_tot = ns(dur_n * len(notes) + 0.4)
    tl = np.arange(n_tot) / SR
    idx = np.minimum((tl / dur_n).astype(int), len(notes) - 1)
    f0t = np.array([m2f(m + 0.1 * (kk - 1)) for m in notes])[idx] * (1 + 0.012 * np.sin(TAU * 5.5 * tl))
    f0t = lp(f0t, 25, 1)
    ph = (tl / dur_n) % 1
    amp = np.clip(np.sin(np.pi * np.clip(ph * 1.15, 0, 1)) * 1.3, 0, 1) ** 0.7
    amp *= (tl < dur_n * len(notes))
    forms = vowel_track(n_tot, [(i * dur_n, "a" if i % 2 == 0 else "u") for i in range(len(notes) + 1)])
    y = vox(f0t, forms, amp, rr, scale=1.22, tilt=1.3, breath=0.18, fmax=7000)
    place(kids, widen(y / (np.abs(y).max() + 1e-9), rr, 7 + kk, 0.6) * 0.16, tn)
sfx += kids
cue("kids singing", t)
# evening wind (shot 11) and the closing cymbal on the cut to black
rr = rng(70)
f0 = SHOT[11][0]
wl = DUR - fr(f0) + 0.1
wind = bp(colored(ns(wl), rr, 1.2), 200, 1800) * (0.6 + 0.4 * smooth_noise(ns(wl), rr, 0.35))
wind *= np.interp(tt(wl), [0, 1.2, wl - 1.2, wl], [0, 1, 1, 0.2])
place(sfx, widen(wind / (np.abs(wind).max() + 1e-9), rr, 13, 0.9), fr(f0), 0.16); cue("wind", fr(f0))
rr = rng(71)
c = cymbal(0.9, rr, dur=DUR - fr(B["black"]) + 0.05)
c = c * np.interp(tt(len(c) / SR), [0, len(c) / SR - 0.2, len(c) / SR], [1, 1, 0])
# a soft reversed swell into it
rev = cymbal(0.5, rng(72), dur=1.2)[::-1] * np.linspace(0, 1, ns(1.2)) ** 2
place(sfx, widen(rev, rr, 9, 0.6) * 0.4, fr(B["black"]) - 1.2)
place(sfx, widen(c, rr, 11, 0.7) * 0.7, fr(B["black"])); cue("cymbal", fr(B["black"]))

# ---------------------------------------------------------------- mix
# duck music + bed sfx under the voice (up to -9 dB music, -4 dB effects), smoothed ~80 ms
duck = 1 - lp(np.clip(venv * 3.0, 0, 1), 6, 1).clip(0, 1)
gm = dbg(-9 * (1 - duck)); gs = dbg(-4 * (1 - duck))
music_bus = music * gm[None, :] * dbg(-6)
sfx_bus = sfx * gs[None, :]
# small room on the music box/pad
music_bus = music_bus + 0.25 * convolve_st(np.mean(music_bus, 0), make_ir(2.2, 5, pre=0.03, hf=1.6))
# bus levels relative to the narration (voice ~ -18 LUFS here): music well under it, effects under it with headroom
vI = integrated(voice)
music_bus *= dbg(vI - 10.0 - integrated(music_bus))
sfx_bus *= dbg(vI - 7.5 - integrated(sfx_bus))
mix = voice + music_bus + sfx_bus
# master: integrated -16 LUFS, true peak <= -1 dBTP: normalise, then a look-ahead peak limiter (min-filter over 2w,
# box-average over w, so the smoothed gain is never above the needed gain at a peak), repeat until both hold
from scipy.ndimage import uniform_filter1d
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
with open(os.path.join(HERE, "cues.md"), "w", encoding="utf8") as fcue:
    fcue.write("# Sound cues (time s / frame / cue)\n\n")
    for t, name, note in sorted(cues):
        fcue.write(f"- {t:7.3f} s  f{int(round(t * FPS)):5d}  {name} {note}\n")
