// Timeline of "ขนมจีนน้ำยา 30 vs 50 บาท": 11 shots timed to the Thai narration (voice/words.json, voice starts at
// VO_OFFSET). Camera grammar from the skill: smootherstep glides 18-40 f, hard cuts on big reframes, every hold creeps
// in 0.15-0.35 %/f (0.6 %/f on punch words), impact kicks flip sign every frame and decay over 7 f.
// Every reaction lands 0-3 f before its word.
import { SET, V3, STALL, BOWL_B, BOWL_C, POT_C, SIGN_C, LABT, SCAN } from "./sets";
import type { Light } from "./lights";
export type { V3 };

export const FPS = 30;
export const VO_OFFSET = 0.3;
export const vf = (t: number) => Math.round((t + VO_OFFSET) * FPS);
export const TOTAL = 1682;

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;

// ---- word-locked beats (words.json times) ----
export const OFF = 99999; // beats of the long cut that the short script no longer has (never reached)
export const BEAT = {
  youtube: 99,      // "ยูทูบ": the same recipe video pops up between both stalls
  p30: 142,         // "สามสิบ"
  p50: 202,         // "ห้าสิบ"
  queue: 243,       // "คิวยาวกว่า"
  flash: 270,
  old: 356,         // "เจ้าเก่าห้าสิบปี": the sign glints
  bowl: 428,        // "ชามดินเผา"
  wine1: 536,       // "ไวน์"
  wine2: 545,       // "ขวดเดียวกัน": insert
  d10: 590,         // "ราคาต่างกัน": the cheap tag first
  d90: 682,         // "ขวดแพง": the $90 tag, the brain lights
  tasty: 722,       // "อร่อยกว่าจริงๆ"
  brain: 792,       // "คำสัญญา"
  mustBeTasty: 841, // "ต้องดี"
  discount: OFF, fewer: OFF, fullPrice: OFF, same: OFF,
  years: 881,       // "ห้าสิบปีก็เหมือนกัน"
  choc: 940,        // "คนเชื่อว่า"
  study2010: 961,   // "อยู่มานาน": the hourglass
  better: 1006,     // "ผ่านการพิสูจน์"
  longer: 1020,
  proof: 1068,      // "คิวยาว"
  joinQ: 1105,      // "ต่อแถว"
  good: 1125,       // "ก็ยิ่ง"
  longerQ: 1141,    // "อยากต่อ"
  mouth: OFF, head: OFF,
  seller: 1197,     // "คนขาย"
  recipe: 1208,     // "สูตร"
  story: 1254,      // "เรื่องราว"
  yours: 1286,      // "ของคุณ"
  simmer: 1326,     // "เคี่ยวน้ำยา"
  fish: 1393,       // "ปลา"
  who: OFF, putBowl: OFF, price: OFF,
  fake50: 1454,     // "ห้าสิบปี"
  yesterday: 1515,  // "เมื่อวาน"
  because: 1534,    // "เพราะลูกค้า"
  never: 1605,      // "ไม่เคยให้อภัย"
  liar: 1631,       // "คนโกหก"
  voiceEnd: 1642,
  black: 1668,
};

// ---------------- shots ----------------
export type ShotDef = { id: number; a: number; b: number; light: Light; set: keyof typeof SET };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 272, light: "day", set: "mkt" },        // two stalls, same video; 30 vs 50, the queue
  { id: 2, a: 272, b: 483, light: "day", set: "mkt" },      // stall B: the old sign, the clay bowl on banana leaf
  { id: 3, a: 483, b: 756, light: "day", set: "lab" },      // wine: same bottle, $10 vs $90, the brain lights
  { id: 4, a: 756, b: 859, light: "day", set: "mkt" },      // the price is a promise
  { id: 6, a: 859, b: 928, light: "day", set: "mkt" },      // "50 years" sign punch
  { id: 7, a: 928, b: 1050, light: "day", set: "lab" },     // older = proven: the old chocolate tastes better
  { id: 8, a: 1050, b: 1155, light: "day", set: "mkt" },    // social proof: the queue grows
  { id: 10, a: 1155, b: 1415, light: "golden", set: "mkt" },// the honest seller's own stall and story
  { id: 11, a: 1415, b: TOTAL, light: "golden", set: "mkt" },// the fake "50" next door; customers walk away
];
export const shotById = (id: number) => SHOTS.find((s) => s.id === id)!;
export const XFADE: Record<number, number> = { 10: 10 };
export const FLASH_AT = BEAT.flash;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: SHOTS[SHOTS.indexOf(s) - 1].id, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

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
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const at = (o: V3, d: V3): V3 => [o[0] + d[0], o[1] + d[1], o[2] + d[2]];

const M = SET.mkt, LB = SET.lab;
const A = STALL.A, B = STALL.B, C = STALL.C, F = STALL.F;
/** customers at B's counter (shots 4 and 9) */
export const EATER: V3 = [B[0] - 0.25, 0, 1.05];

const S1a = (f: number) => dolly([M + 0.0, 2.0, 9.0], [M + 0.0, 1.3, 0.0], pushK(f, 0, 0.0016), { fov: 58 });
const S1b = (f: number) => dolly(at(A, [0.45, 1.6, 4.3]), at(A, [0, 1.55, -0.3]), pushK(f, BEAT.p30 - 12, 0.0025), { fov: 40, roll: 0.03 });
const S1c = (f: number) => dolly(at(B, [1.9, 1.75, 6.4]), at(B, [0.2, 1.25, 1.2]), pushK(f, BEAT.p50 - 10, 0.0022, 0.005, 30), { fov: 46, roll: -0.035 });
const S2a = (f: number) => dolly(at(B, [-0.45, 1.7, 4.3]), at(B, [0, 1.75, -0.45]), pushK(f, 272, 0.0022, 0.006, 26), { fov: 44, roll: 0.02 });
const S2b = (f: number) => dolly(at(BOWL_B, [0.15, 0.55, 0.78]), BOWL_B, pushK(f, BEAT.bowl - 3, 0.0028), { fov: 34, roll: -0.04 });
const S3a = (f: number) => dolly([LB - 3.3, 1.65, 3.3], [LB - 0.4, 1.0, -1.25], pushK(f, 483, 0.002), { fov: 52 });
const S3b = (f: number) => dolly(at(LABT, [0.35, 0.45, 1.75]), at(LABT, [0.3, 0.42, 0]), pushK(f, BEAT.wine2 - 2, 0.0018), { fov: 42 });
const S4a = (f: number) => dolly(at(EATER, [0.35, 1.7, 3.0]), at(EATER, [0, 1.8, 0]), pushK(f, 756, 0.0022, 0.006, 30), { fov: 38, roll: -0.03 });
const S5a = (f: number) => dolly([LB + 6.0, 1.75, 3.4], [LB + 6.0, 0.95, -0.9], pushK(f, 882, 0.002), { fov: 50 });
const S5b = (f: number) => dolly([LB + 6.0, 1.3, 1.25], [LB + 6.0, 0.86, -0.55], pushK(f, BEAT.same - 8, 0.0025), { fov: 46, roll: 0.03 });
const S6a = (f: number) => dolly(at(B, [0.25, 2.05, 3.3]), at(B, [0, 2.1, -0.4]), pushK(f, 859, 0.003, 0.008, 24), { fov: 38, roll: -0.04 });
const S7a = (f: number) => dolly([LB + 10.2, 1.55, 1.7], [LB + 10.1, 1.15, -1.1], pushK(f, 928, 0.002), { fov: 46 });
const S8a = (f: number): Shot => {
  const u = glide((f - 1050) / 105);
  const p: V3 = [M + 6.2 - 0.8 * u, 3.6 + 1.2 * u, 9.6 + 0.6 * u], l: V3 = [M + 1.6, 0.9, 1.6];
  return { pos: p, look: l, fov: 48, roll: 0 };
};
const S9a = (f: number) => dolly(at(EATER, [0.25, 1.75, 2.7]), at(EATER, [0, 1.8, 0]), pushK(f, 1500, 0.0022, 0.006, 30), { fov: 38 });
const S10a = (f: number) => dolly(at(C, [0.6, 1.65, 4.2]), at(C, [0, 1.5, -0.5]), pushK(f, 1155, 0.0018), { fov: 44 });
const S10b = (f: number) => dolly(at(C, [-0.2, 1.75, 3.2]), at(C, [0.05, 1.8, -0.6]), pushK(f, BEAT.story - 6, 0.0025, 0.005, 26), { fov: 40, roll: 0.03 });
const S10c = (f: number) => dolly(at(POT_C, [-0.1, 0.95, 1.75]), at(POT_C, [0.05, 0.68, 0]), pushK(f, BEAT.simmer - 4, 0.0025), { fov: 42, roll: -0.03 });
const S10d = (f: number) => dolly(at(C, [0.25, 1.62, 2.4]), at(C, [0, 1.72, -0.9]), pushK(f, BEAT.who - 4, 0.0025), { fov: 36 });
const S10e = (f: number) => dolly(at(BOWL_C, [0.05, 0.6, 0.85]), BOWL_C, pushK(f, BEAT.putBowl - 4, 0.0025), { fov: 36, roll: 0.03 });
const S10f = (f: number) => dolly(at(SIGN_C, [0.2, 0.35, 1.5]), at(SIGN_C, [-0.15, -0.05, 0]), pushK(f, BEAT.price - 4, 0.0025, 0.005, 26), { fov: 38 });
const S11a = (f: number) => dolly([(C[0] + F[0]) / 2 + 0.2, 1.9, 9.2], [(C[0] + F[0]) / 2, 1.3, 0.0], pushK(f, 1415, 0.0018), { fov: 58 });
const S11b = (f: number) => dolly(at(F, [0.5, 1.9, 3.6]), at(F, [0, 2.05, -0.4]), pushK(f, BEAT.liar - 8, 0.003, 0.007, 26), { fov: 40, roll: 0.03 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: BEAT.p30 - 14, dur: 26, s: S1b }, { f: BEAT.p50 - 12, dur: 30, s: S1c }],
  2: [{ f: 272, s: S2a }, { f: BEAT.bowl - 3, cut: true, s: S2b }],
  3: [{ f: 483, s: S3a }, { f: BEAT.wine2 - 2, cut: true, s: S3b }],
  4: [{ f: 756, s: S4a }],
  5: [{ f: 882, s: S5a }, { f: BEAT.same - 10, dur: 30, s: S5b }],
  6: [{ f: 859, s: S6a }],
  7: [{ f: 928, s: S7a }],
  8: [{ f: 1050, s: S8a }],
  9: [{ f: 1500, s: S9a }],
  10: [{ f: 1155, s: S10a }, { f: BEAT.story - 8, dur: 26, s: S10b }, { f: BEAT.simmer - 4, cut: true, s: S10c },
    { f: BEAT.who - 4, cut: true, s: S10d }, { f: BEAT.putBowl - 4, cut: true, s: S10e }, { f: BEAT.price - 4, cut: true, s: S10f }],
  11: [{ f: 1415, s: S11a }, { f: BEAT.liar - 8, dur: 22, s: S11b }],
};
export const KICKS: { f: number; k: number }[] = [
  { f: BEAT.d90, k: 0.35 }, { f: BEAT.years, k: 0.3 }, { f: BEAT.liar, k: 0.8 },
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
    case 1: return { cInf: f < BEAT.p30 - 14 ? 0 : 8 };
    case 2: return { cInf: f < BEAT.bowl - 3 ? 11 : 15 };
    case 3: return { cInf: f < BEAT.wine2 - 2 ? 6 : 12 };
    case 4: return { cInf: 14, focus: () => [EATER[0], 1.7, EATER[2]] };
    case 5: return { cInf: f < BEAT.same - 10 ? 6 : 10 };
    case 6: return { cInf: 14 };
    case 7: return { cInf: 10 };
    case 8: return { cInf: 0 };
    case 9: return { cInf: 15, focus: () => [EATER[0], 1.7, EATER[2]] };
    case 10: return { cInf: f < BEAT.story - 8 ? 7 : 12 };
    case 11: return { cInf: f < BEAT.liar - 8 ? 4 : 12 };
    default: return { cInf: 0 };
  }
};
export { SCAN };
