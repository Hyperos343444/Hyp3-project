// Timeline of "The Fall River Axe Mystery" (ปริศนาขวานแห่งฟอลริเวอร์): 11 shots timed to the Thai narration
// (voice/words.json, voice starts at VO_OFFSET). Camera grammar from the skill: smootherstep glides 18-40 f, hard cuts
// on big reframes, every hold creeps in 0.15-0.35 %/f (0.6 %/f on punch words), impact kicks flip sign every frame
// and decay over 7 f, no hand-held float. Every reaction lands 0-3 f before its word.
import { SET, CELLAR_AXE, STOVE, JUDGE, V3 } from "./sets";
import type { Light } from "./lights";
export type { V3 };

export const FPS = 30;
export const VO_OFFSET = 0.3; // s of picture before the first word
/** frame of a narration time (s, words.json clock) */
export const vf = (t: number) => Math.round((t + VO_OFFSET) * FPS);
export const TOTAL = 1545;

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;

// ---- word-locked beats (words.json times) ----
export const BEAT = {
  notGuilty1: vf(6.233),   // "ไม่ผิด" (line 1): smirk
  flash: vf(6.75),         // white flash after the hook
  stingy: vf(8.008),       // "ขี้เหนียว": coins
  gives: vf(8.438),        // "ยกบ้าน": the deed changes hands
  lizzie3: vf(10.209),     // "ลิซซี่" -> camera finds her
  angry: vf(10.56),        // "โกรธ"
  shop: vf(14.022),        // "ร้านขายยา"
  cyanide: vf(15.09),      // "ไซยาไนด์": skull bottle pops
  chop1: vf(17.551),       // "ฟัน"
  turn: vf(20.2),          // "ถึงคิวพ่อ"
  chop2: vf(20.916),       // "โซฟา"
  axe: vf(22.857),         // "ขวาน": iron clank, lantern points
  unlucky: vf(24.549),     // "โชคร้าย": insert on the hatchet head
  burn: vf(28.174),        // "เผา"
  paint: vf(29.736),       // "เปื้อนสี"
  notGuilty2: vf(33.269),  // "ไม่ผิด" (verdict): gavel x2
  shun: vf(36.196),        // "คน(ทั้งเมืองเมิน)": backs turn one by one
  rumour: vf(38.506),      // "ศาลปล่อยตัว..." kids appear
  another: vf(45.727),     // "ยังมีอีกคน": the window figure
  voiceEnd: vf(48.712),
  black: 1492,
};

// ---------------- shots ----------------
export type ShotDef = { id: number; a: number; b: number; light: Light; set: keyof typeof SET };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 155, light: "day", set: "ext" },
  { id: 2, a: 155, b: 211, light: "day", set: "ext" },
  { id: 3, a: 211, b: 381, light: "day", set: "liv" },
  { id: 4, a: 381, b: 487, light: "day", set: "pharm" },
  { id: 5, a: 487, b: 572, light: "night", set: "bed" },
  { id: 6, a: 572, b: 663, light: "night", set: "liv" },
  { id: 7, a: 663, b: 815, light: "night", set: "cellar" },
  { id: 8, a: 815, b: 929, light: "night", set: "kitchen" },
  { id: 9, a: 929, b: 1029, light: "day", set: "court" },
  { id: 10, a: 1029, b: 1247, light: "golden", set: "ext" },
  { id: 11, a: 1247, b: TOTAL, light: "golden", set: "ext" },
];
/** crossfades (frames) at time-of-day changes */
export const XFADE: Record<number, number> = { 10: 8, 11: 10 };
export const FLASH_AT = BEAT.flash;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story positions ----------------
const X = SET;
export const LIZZIE_GATE: V3 = [X.ext + 0.8, 0.04, 2.35];
/** shot 10: Lizzie strolls along the near sidewalk toward +x */
export const walkX = (f: number) => X.ext - 9 + 0.72 * ((f - 1029) / FPS);
export const WALK_Z = 2.45;
export const SOFA_ANDREW: V3 = [X.liv + 0.0, 0.43, -2.42];
export const WINDOW_UP: V3 = [X.ext - 2.27, 4.9, -2];

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** push-in factor since f0 (subject grows ~rate per frame; `punch` for the first n frames, 8 f soft edges) */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const ox = (o: number, p: V3): V3 => [p[0] + o, p[1], p[2]];

const E = X.ext, LV = X.liv, BD = X.bed, PH = X.pharm, CL = X.cellar, KT = X.kitchen, CT = X.court;
// 1: wide of the Borden house from across the street, slow creep toward Lizzie at the gate
const S1a = (f: number) => dolly(ox(E, [3.6, 1.75, 14.6]), ox(E, [0.2, 3.7, -2]), pushK(f, 0, 0.0028), { fov: 47 });
// 2: close-up of Lizzie; push harder on "ไม่ผิด"
const S2a = (f: number) => dolly(ox(E, [1.25, 1.52, 4.45]), [LIZZIE_GATE[0], 1.45, LIZZIE_GATE[2]], pushK(f, 155, 0.0022, 0.006, 30), { fov: 34, roll: -0.03 });
// 3: the deed scene, then glide right to Lizzie (on her name) and push on "โกรธ"
const S3a = (f: number) => dolly(ox(LV, [-0.5, 1.55, 2.7]), ox(LV, [-0.05, 1.15, -0.7]), pushK(f, 211, 0.0022), { fov: 52 });
const S3b = (f: number) => dolly(ox(LV, [0.9, 1.5, 2.6]), ox(LV, [2.4, 1.42, 0.5]), pushK(f, BEAT.lizzie3 - 10, 0.002, 0.006, 30), { fov: 36, roll: 0.04 });
// 4: pharmacy 3/4, punch toward the counter on "ไซยาไนด์"
const S4a = (f: number) => dolly(ox(PH, [-0.25, 1.58, 2.6]), ox(PH, [-0.15, 1.25, -1.0]), pushK(f, 381, 0.0022, 0.0065, 26), { fov: 46 });
const S4b = (f: number) => dolly(ox(PH, [0.55, 1.42, 1.15]), ox(PH, [0.25, 1.32, -1.15]), pushK(f, BEAT.cyanide - 6, 0.003), { fov: 40, roll: -0.04 });
// 5: bedroom, the shadow grows on the back wall; creep, punch on the chop
const S5a = (f: number) => dolly(ox(BD, [-0.7, 1.7, 2.3]), ox(BD, [0.55, 0.95, -1.0]), pushK(f, 487, 0.0025), { fov: 54 });
// 6: sofa, Andrew asleep; shadow over his head
const S6a = (f: number) => dolly(ox(LV, [0.55, 1.25, 0.9]), ox(LV, [0.05, 1.25, -2.6]), pushK(f, 572, 0.0025), { fov: 46, roll: 0.02 });
// 7: cellar: policeman with the lantern -> insert on the hatchet head on "โชคร้าย"
const S7a = (f: number) => dolly(ox(CL, [-1.45, 1.5, 1.95]), ox(CL, [-0.1, 0.95, -0.9]), pushK(f, 663, 0.0022), { fov: 50 });
const S7b = (f: number) => dolly([CELLAR_AXE[0] - 0.12, CELLAR_AXE[1] + 0.72, CELLAR_AXE[2] + 0.95], CELLAR_AXE, pushK(f, BEAT.unlucky - 2, 0.0025, 0.006, 30), { fov: 34, roll: 0.04 });
// 8: kitchen: Lizzie at the stove, push into the fire
const S8a = (f: number) => dolly(ox(KT, [-0.55, 1.4, 1.95]), ox(KT, [-0.05, 0.95, -1.2]), pushK(f, 815, 0.0022), { fov: 50 });
const S8b = (f: number) => dolly([STOVE[0] - 0.95, 1.1, STOVE[2] + 2.5], [STOVE[0] - 0.1, 0.62, STOVE[2] + 0.45], pushK(f, BEAT.burn - 4, 0.0025, 0.005, 28), { fov: 38, roll: -0.04 });
// 9: courtroom wide -> cut to the judge on the verdict
const S9a = (f: number) => dolly(ox(CT, [3.3, 2.15, 5.3]), ox(CT, [-1.1, 1.2, -1.6]), pushK(f, 929, 0.002), { fov: 58 });
const S9b = (f: number) => dolly([JUDGE[0] + 0.55, 2.45, JUDGE[2] + 2.9], [JUDGE[0], 2.3, JUDGE[2]], pushK(f, BEAT.notGuilty2 - 4, 0.0025, 0.006, 24), { fov: 36 });
// 10: golden street: track with Lizzie; widen to reveal the singing kids behind her
const S10a = (f: number) => { const x = walkX(f); return dolly([x + 1.9, 1.62, 8.7], [x + 0.9, 1.3, WALK_Z], pushK(f, 1029, 0.001), { fov: 44 }); };
const S10b = (f: number) => { const x = walkX(f); return dolly([x - 0.1, 1.9, 10.2], [x - 1.2, 1.15, WALK_Z], pushK(f, BEAT.rumour - 12, 0.0015), { fov: 50, roll: -0.03 }); };
// 11: the house at sunset; slow push into the lit upper window
const S11a = (f: number): Shot => {
  const u = glide((f - 1247) / (BEAT.voiceEnd + 10 - 1247));
  const p0: V3 = [E + 0.6, 1.9, 14.2], p1: V3 = [E - 1.7, 4.45, 3.2];
  const l0: V3 = [E - 1.0, 4.2, -2], l1: V3 = [WINDOW_UP[0], 4.85, -2];
  const L = (a: V3, b: V3) => a.map((v, i) => v + (b[i] - v) * u) as V3;
  return { pos: L(p0, p1), look: L(l0, l1), fov: 46 - 8 * u, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }],
  2: [{ f: 155, s: S2a }],
  3: [{ f: 211, s: S3a }, { f: BEAT.lizzie3 - 14, dur: 30, s: S3b }],
  4: [{ f: 381, s: S4a }, { f: BEAT.cyanide - 6, cut: true, s: S4b }],
  5: [{ f: 487, s: S5a }],
  6: [{ f: 572, s: S6a }],
  7: [{ f: 663, s: S7a }, { f: BEAT.unlucky - 2, cut: true, s: S7b }],
  8: [{ f: 815, s: S8a }, { f: BEAT.burn - 4, dur: 28, s: S8b }],
  9: [{ f: 929, s: S9a }, { f: BEAT.notGuilty2 - 4, cut: true, s: S9b }],
  10: [{ f: 1029, s: S10a }, { f: BEAT.rumour - 12, dur: 36, s: S10b }],
  11: [{ f: 1247, s: S11a }],
};
/** impact kicks: flip sign every frame, decay over 7 f (frame, strength in rad of roll + metres of lift) */
export const KICKS: { f: number; k: number }[] = [
  { f: BEAT.chop1, k: 1.0 }, { f: BEAT.chop2, k: 1.0 }, { f: BEAT.axe - 1, k: 0.35 },
  { f: BEAT.notGuilty2, k: 0.6 }, { f: BEAT.notGuilty2 + 10, k: 0.6 },
];
const kickAt = (f: number) => {
  let r = 0, y = 0;
  for (const k of KICKS) {
    const d = f - k.f;
    if (d < 0 || d >= 7) continue;
    const a = k.k * (1 - d / 7) * (d % 2 ? -1 : 1);
    r += 0.035 * a; y += 0.03 * a;
  }
  return { r, y };
};

export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f);
  const k = kickAt(f);
  return { ...c, pos: [c.pos[0], c.pos[1] + k.y, c.pos[2]], roll: c.roll + k.r };
};

// ---------------- lens blur per beat (cInf px at 1080; 0 = sharp) ----------------
export type Dof = { cInf: number; focus?: (f: number) => V3 };
export const dofAt = (f: number): Dof => {
  const s = shotAt(f);
  switch (s.id) {
    case 1: return { cInf: 0 };
    case 2: return { cInf: 14, focus: () => [LIZZIE_GATE[0], 1.45, LIZZIE_GATE[2]] };
    case 3: return { cInf: f < BEAT.lizzie3 ? 9 : 12, focus: f < BEAT.lizzie3 ? () => [LV - 0.2, 1.45, -0.6] : () => [LV + 2.4, 1.45, 0.5] };
    case 4: return { cInf: 10 };
    case 5: return { cInf: 7 };
    case 6: return { cInf: 8 };
    case 7: return { cInf: f < BEAT.unlucky - 2 ? 7 : 15 };
    case 8: return { cInf: 11 };
    case 9: return { cInf: f < BEAT.notGuilty2 - 4 ? 0 : 13 };
    case 10: return { cInf: 6, focus: (g) => [walkX(g), 1.45, WALK_Z] };
    default: return { cInf: 0 };
  }
};
